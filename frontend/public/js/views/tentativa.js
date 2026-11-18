import { api } from '../api.js';
import { ehAdmin, somenteLeitura } from '../estado.js';
import { esc, fmtPontos, definirTitulo, etiqueta, toast, on, acao, confirmar } from '../ui.js';
import { renderizarQuiz } from './responder.js';
 
function respostaDada(q) {
  const r = q.resposta;
  if (!r) return '<i class="suave">em branco</i>';
  if (r.alternativa_id) return esc(q.alternativa_escolhida || q.alternativas?.find((a) => a.id === r.alternativa_id)?.texto || '');
  if (r.texto) return esc(r.texto);
  if (r.resposta_json && q.alternativas) {
    const v = JSON.parse(r.resposta_json);
    const nome = (id) => q.alternativas.find((a) => a.id === Number(id))?.texto || '?';
    if (Array.isArray(v)) return v.map((id) => esc(nome(id))).join(' → ');
    return Object.entries(v).map(([a, b]) => `${esc(nome(a))} ↔ ${esc(nome(b))}`).join('; ');
  }
  return r.resposta_json ? 'respondida' : '<i class="suave">em branco</i>';
}
 
export default async function tentativa(el, { id }) {
  const d = await api('GET', `/tentativas/${id}`);
  if (d.tentativa.status === 'em_andamento') {
    renderizarQuiz(el, d);
    return;
  }
  const t = d.tentativa;
  const admin = ehAdmin();
  definirTitulo(d.prova.titulo);
  el.innerHTML = `<div class="cartao" style="text-align:center">
      <div class="suave">${esc(t.tribo_nome || '')}${t.pessoa_nome ? ` · ${esc(t.pessoa_nome)}` : ''}</div>
      <div class="pontos" style="font-size:2.2rem">${fmtPontos(t.pontos_obtidos)}<span class="suave" style="font-size:1rem"> / ${fmtPontos(d.pontuacao_maxima)}</span></div>
      ${etiqueta(t.status)}${t.fora_do_tempo ? ' <span class="etiqueta etiqueta--vermelho">fora do tempo</span>' : ''}
      ${t.status === 'aguardando_correcao' ? '<p class="suave pequeno">Algumas respostas serão corrigidas pela coordenação.</p>' : ''}
      ${admin && !somenteLeitura() && t.status !== 'anulada' ? '<button class="btn btn--perigo btn--peq" id="anular" style="margin-top:.5rem">Anular tentativa</button>' : ''}</div>
    ${d.questoes.map((q, i) => {
    const r = q.resposta;
    const cls = r?.correta === true ? 'correta' : r?.correta === false ? 'errada' : '';
    return `<div class="questao ${cls}"><div class="questao__num">Questão ${i + 1} · ${r?.pontos_obtidos ?? '?'} de ${q.pontos} pts</div>
      <p style="margin:.3rem 0"><b>${esc(q.enunciado)}</b></p><div class="pequeno">Resposta: ${respostaDada(q)}</div>
      ${r?.correta === null ? '<span class="etiqueta etiqueta--laranja">aguardando correção</span>' : ''}
      ${admin && r && q.tipo === 'aberta' && !somenteLeitura() ? `<div class="linha" style="margin-top:.5rem"><input type="number" min="0" max="${q.pontos}" step="1" value="${r.pontos_obtidos ?? ''}" data-pts="${r.id}" style="max-width:110px">
        <button class="btn btn--peq btn--verde" data-corrigir="${r.id}">Salvar nota</button></div>` : ''}</div>`;
  }).join('')}`;
  el.querySelector('#anular')?.addEventListener('click', async () => {
    const ok = await confirmar({ titulo: 'Anular tentativa', perigo: true, botao: 'Anular', mensagem: '<p>Os pontos desta tentativa deixam de contar e o resultado da tribo é recalculado.</p>' });
    if (ok) await acao(null, async () => { await api('POST', `/tentativas/${t.id}/anular`); toast('Tentativa anulada.'); tentativa(el, { id }); });
  });
  on(el, 'click', '[data-corrigir]', (b) => acao(b, async () => {
    const v = el.querySelector(`[data-pts="${b.dataset.corrigir}"]`).value;
    await api('PATCH', `/respostas/${b.dataset.corrigir}`, { pontos_obtidos: Number(v) });
    toast('Nota salva.');
    tentativa(el, { id });
  }));
}
