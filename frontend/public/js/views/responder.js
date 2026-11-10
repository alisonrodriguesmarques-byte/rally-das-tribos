import { api } from '../api.js';
import { esc, definirTitulo, confirmar, toast, tratarErro, on, vazio } from '../ui.js';
 
const chave = (id) => `rascunho-tentativa-${id}`;
 
function blocoQuestao(q, i, r = {}) {
  const cab = `<div class="questao__num">Questão ${i + 1} · ${q.pontos} pts</div><p style="margin:.3rem 0 .6rem"><b class="quebra" style="white-space:pre-line">${esc(q.enunciado)}</b>${q.referencia_biblica ? ` <span class="suave">(${esc(q.referencia_biblica)})</span>` : ''}</p>
    ${q.imagem_url ? `<img src="${esc(q.imagem_url)}" alt="" style="max-width:100%;border-radius:10px;margin-bottom:.5rem">` : ''}
    ${q.video_url ? `<a href="${esc(q.video_url)}" target="_blank" rel="noopener" class="pequeno">Abrir vídeo</a>` : ''}`;
  let corpo = '';
  if (q.alternativas) {
    corpo = q.alternativas.map((a) => `<label class="opcao"><input type="radio" name="q${q.id}" value="${a.id}"${Number(r.alternativa_id) === a.id ? ' checked' : ''}> <span class="quebra">${esc(a.texto)}</span></label>`).join('');
  } else if (q.tipo === 'complete' || q.tipo === 'aberta') {
    corpo = q.tipo === 'complete'
      ? `<input name="q${q.id}" autocomplete="off" placeholder="Sua resposta" value="${esc(r.texto || '')}">`
      : `<textarea name="q${q.id}" placeholder="Escreva sua resposta">${esc(r.texto || '')}</textarea>`;
  } else if (q.tipo === 'ordem') {
    const ordem = r.ordem?.length ? r.ordem.map((id) => q.itens.find((x) => x.id === id)).filter(Boolean) : q.itens;
    corpo = `<p class="suave pequeno">Use as setas para colocar na ordem certa.</p><div data-ordem="${q.id}">${ordem.map((it) => `
      <div class="ordem-item" data-item="${it.id}"><span class="cresce quebra">${esc(it.texto)}</span>
      <button type="button" class="btn" data-mover="-1" aria-label="Subir">↑</button><button type="button" class="btn" data-mover="1" aria-label="Descer">↓</button></div>`).join('')}</div>`;
  } else if (q.tipo === 'associacao') {
    corpo = q.lado_a.map((a) => `<label class="campo"><span>${esc(a.texto)}</span><select name="q${q.id}-${a.id}"><option value="">Escolha…</option>
      ${q.lado_b.map((b) => `<option value="${b.id}"${String(r.pares?.[a.id]) === String(b.id) ? ' selected' : ''}>${esc(b.texto)}</option>`).join('')}</select></label>`).join('');
  }
  return `<div class="questao">${cab}${corpo}</div>`;
}
 
function coletar(form, questoes) {
  return questoes.map((q) => {
    const r = { questao_id: q.id };
    if (q.alternativas) r.alternativa_id = form.querySelector(`[name=q${q.id}]:checked`)?.value || null;
    else if (q.tipo === 'complete' || q.tipo === 'aberta') r.texto = form.elements[`q${q.id}`].value;
    else if (q.tipo === 'ordem') r.ordem = [...form.querySelectorAll(`[data-ordem="${q.id}"] [data-item]`)].map((x) => Number(x.dataset.item));
    else if (q.tipo === 'associacao') {
      r.pares = {};
      q.lado_a.forEach((a) => { const v = form.elements[`q${q.id}-${a.id}`].value; if (v) r.pares[a.id] = Number(v); });
    }
    return r;
  });
}
 
/** Renderiza o formulário de resposta de uma tentativa em andamento. */
export function renderizarQuiz(el, dados) {
  const { tentativa: t, prova, questoes } = dados;
  definirTitulo(prova.titulo);
  let rascunho = {};
  try { rascunho = JSON.parse(localStorage.getItem(chave(t.id)) || '{}'); } catch { rascunho = {}; }
  const fim = prova.tempo_limite_seg ? Date.parse(t.iniciada_em) + prova.tempo_limite_seg * 1000 + (Date.now() - Date.parse(dados.agora)) : null;
 
  el.innerHTML = `${fim ? '<div class="cronometro" id="crono"></div>' : ''}
    ${prova.descricao ? `<div class="aviso">${esc(prova.descricao)}</div>` : ''}
    <form id="quiz">${questoes.length ? questoes.map((q, i) => blocoQuestao(q, i, rascunho[q.id])).join('') : vazio('Esta prova não tem questões.')}
    <button class="btn btn--verde btn--bloco" type="submit">Enviar respostas</button></form>`;
  const form = el.querySelector('#quiz');
  const salvar = () => {
    const rs = Object.fromEntries(coletar(form, questoes).map((r) => [r.questao_id, r]));
    localStorage.setItem(chave(t.id), JSON.stringify(rs));
  };
  form.addEventListener('input', salvar);
  form.addEventListener('change', salvar);
  on(form, 'click', '[data-mover]', (b) => {
    const item = b.closest('[data-item]');
    const alvo = Number(b.dataset.mover) < 0 ? item.previousElementSibling : item.nextElementSibling;
    if (alvo) {
      if (Number(b.dataset.mover) < 0) alvo.before(item); else alvo.after(item);
      salvar();
    }
  });
 
  let enviando = false;
  const enviar = async (automatico = false) => {
    if (enviando) return;
    enviando = true;
    try {
      const r = await api('POST', `/tentativas/${t.id}/finalizar`, { respostas: coletar(form, questoes) });
      localStorage.removeItem(chave(t.id));
      toast(automatico ? 'Tempo esgotado: respostas enviadas.' : 'Respostas enviadas!');
      const destino = `#/tentativas/${r.tentativa.id}`;
      if (location.hash === destino) window.dispatchEvent(new HashChangeEvent('hashchange'));
      else location.replace(destino);
    } catch (err) {
      enviando = false;
      tratarErro(err);
    }
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rs = coletar(form, questoes);
    const embranco = rs.filter((r) => !r.alternativa_id && !r.texto && !r.ordem && !(r.pares && Object.keys(r.pares).length)).length;
    const ok = await confirmar({
      titulo: 'Enviar respostas', botao: 'Enviar',
      mensagem: `<p>Depois de enviar não dá para mudar.</p>${embranco ? `<p class="aviso">${embranco} questão(ões) em branco.</p>` : ''}`,
    });
    if (ok) enviar();
  });
 
  if (fim) {
    const crono = el.querySelector('#crono');
    const tick = () => {
      if (!el.isConnected) return clearInterval(timer);
      const resta = Math.max(0, Math.round((fim - Date.now()) / 1000));
      crono.textContent = `Tempo restante: ${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, '0')}`;
      if (resta <= 0) {
        clearInterval(timer);
        enviar(true);
      }
      return undefined;
    };
    const timer = setInterval(tick, 1000);
    tick();
  }
}
 
export default async function responder(el, { id }, query) {
  definirTitulo('Prova');
  const corpo = {};
  if (query.tribo) corpo.rally_tribo_id = Number(query.tribo);
  if (query.pessoa) corpo.pessoa_id = Number(query.pessoa);
  const dados = await api('POST', `/provas/${id}/tentativas`, corpo);
  history.replaceState(null, '', `#/tentativas/${dados.tentativa.id}`);
  renderizarQuiz(el, dados);
}
