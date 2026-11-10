import { api } from '../api.js';
import { somenteLeitura, estado } from '../estado.js';
import {
  esc, fmtPontos, fmtDataHora, definirTitulo, vazio, etiqueta, modal, aoEnviar, toast, on, opcoesTribos, confirmar, acao, bolinha,
} from '../ui.js';
import { formProva, ligarFormProva, MODOS, AGREGACOES } from './provas.js';
import { TIPOS_Q, gabarito, abrirQuestao } from './prova_editor.js';
 
export default async function prova(el, { id }, query) {
  const p = await api('GET', `/provas/${id}`);
  definirTitulo('Prova');
  const aba = query.aba || 'questoes';
  const editavel = !somenteLeitura();
  const bloqueada = p.total_tentativas > 0;
  el.innerHTML = `<div class="cartao">
      <div class="linha linha--entre"><h1 style="margin:0">${esc(p.titulo)}</h1>${etiqueta(p.status)}</div>
      <div class="suave pequeno">${p.questoes.length} questão(ões) · até ${fmtPontos(p.pontuacao_maxima)} pts · ${esc(MODOS[p.modo])}${p.modo === 'individual' ? ` (${esc(AGREGACOES[p.agregacao])})` : ''}</div>
      <div class="suave pequeno">${p.tempo_limite_seg ? `${Math.round(p.tempo_limite_seg / 60)} min · ` : ''}${p.max_tentativas ? `${p.max_tentativas} tentativa(s)` : 'tentativas ilimitadas'}${p.disponivel_de ? ` · de ${fmtDataHora(p.disponivel_de)}` : ''}${p.disponivel_ate ? ` até ${fmtDataHora(p.disponivel_ate)}` : ''}</div>
      ${editavel ? `<div class="botoes" style="margin-top:.6rem">
        ${p.status === 'rascunho' ? '<button class="btn btn--verde" data-status="publicada">Publicar</button>' : ''}
        ${p.status === 'publicada' ? '<button class="btn" data-status="encerrada">Encerrar</button>' : ''}
        ${p.status === 'encerrada' ? '<button class="btn" data-status="publicada">Reabrir</button>' : ''}
        <button class="btn" id="config">Configurações</button>
        <button class="btn btn--ouro" id="aplicar">Aplicar agora</button></div>` : ''}</div>
    <div class="chips"><a class="chip${aba === 'questoes' ? ' ativo' : ''}" href="#/provas/${id}?aba=questoes">Questões</a><a class="chip${aba === 'resultados' ? ' ativo' : ''}" href="#/provas/${id}?aba=resultados">Resultados (${p.total_tentativas})</a></div>
    <div id="aba"></div>`;
  const recarregar = () => prova(el, { id }, { aba });
  const corpo = el.querySelector('#aba');
 
  if (aba === 'questoes') {
    corpo.innerHTML = `${bloqueada ? '<div class="aviso">A prova já foi respondida: as questões não podem mais ser alteradas.</div>' : ''}
      ${p.questoes.length ? p.questoes.map((q, i) => `<div class="questao"><div class="questao__num">${i + 1}. ${esc(TIPOS_Q[q.tipo])} · ${q.pontos} pts</div>
        <p style="margin:.3rem 0"><b class="quebra">${esc(q.enunciado)}</b>${q.referencia_biblica ? ` <span class="suave">(${esc(q.referencia_biblica)})</span>` : ''}</p>
        <div class="suave pequeno quebra">${gabarito(q)}</div>
        ${editavel && !bloqueada ? `<div class="botoes" style="margin-top:.4rem"><button class="btn btn--peq" data-editar="${q.id}">Editar</button><button class="btn btn--peq btn--perigo" data-excluir="${q.id}">Excluir</button></div>` : ''}</div>`).join('')
    : `<div class="cartao">${vazio('Nenhuma questão ainda.')}</div>`}
      ${editavel && !bloqueada ? '<button class="btn btn--primario btn--bloco" id="nova-q">+ Adicionar questão</button>' : ''}`;
    corpo.querySelector('#nova-q')?.addEventListener('click', () => abrirQuestao(p.id, null, recarregar));
    on(corpo, 'click', '[data-editar]', (b) => abrirQuestao(p.id, p.questoes.find((q) => q.id === Number(b.dataset.editar)), recarregar));
    on(corpo, 'click', '[data-excluir]', async (b) => {
      if (!(await confirmar({ titulo: 'Excluir questão', perigo: true, botao: 'Excluir', mensagem: '<p>Excluir esta questão?</p>' }))) return;
      await acao(b, async () => { await api('DELETE', `/questoes/${b.dataset.excluir}`); toast('Questão excluída.'); recarregar(); });
    });
  } else {
    const r = await api('GET', `/provas/${id}/resultados`);
    corpo.innerHTML = `
      ${r.respostas_pendentes.length ? `<div class="secao-titulo"><h2>Para corrigir (${r.respostas_pendentes.length})</h2></div>
      ${r.respostas_pendentes.map((x) => `<div class="questao"><div class="questao__num">${esc(x.tribo_nome)} · até ${x.pontos} pts</div>
        <p style="margin:.3rem 0"><b>${esc(x.enunciado)}</b></p><p class="quebra" style="white-space:pre-line;margin:.2rem 0 .5rem">${esc(x.texto || '(em branco)')}</p>
        ${editavel ? `<div class="linha" style="flex-wrap:wrap"><button class="btn btn--peq btn--verde" data-nota="${x.pontos}" data-resp="${x.id}">Certa (${x.pontos})</button>
          <button class="btn btn--peq btn--perigo" data-nota="0" data-resp="${x.id}">Errada (0)</button>
          <input type="number" min="0" max="${x.pontos}" step="1" placeholder="outra nota" data-outra="${x.id}" style="max-width:120px">
          <button class="btn btn--peq" data-resp="${x.id}" data-usar-outra>Salvar</button></div>` : ''}</div>`).join('')}` : ''}
      <div class="secao-titulo"><h2>Resultado por tribo</h2></div>
      <div class="cartao">${r.resultados.length ? `<ul class="lista">${r.resultados.map((x) => `<li>${bolinha(x.tribo_cor)}<span class="cresce">${esc(x.tribo_nome)}</span><b class="pontos">${fmtPontos(x.pontos)}</b></li>`).join('')}</ul>` : vazio('Nenhum resultado ainda.')}</div>
      <div class="secao-titulo"><h2>Tentativas</h2></div>
      <div class="cartao">${r.tentativas.length ? `<ul class="lista">${r.tentativas.map((t) => `<li><a class="cresce" href="#/tentativas/${t.id}"><b>${esc(t.tribo_nome || '')}</b>${t.pessoa_nome ? ` · ${esc(t.pessoa_nome)}` : ''}<div class="suave pequeno">${fmtDataHora(t.finalizada_em || t.iniciada_em)}</div></a>
        ${etiqueta(t.status)}<b class="pontos">${t.pontos_obtidos ?? '-'}</b></li>`).join('')}</ul>` : vazio('Ninguém respondeu ainda.')}</div>`;
    on(corpo, 'click', '[data-resp]', (b) => {
      const nota = b.dataset.usarOutra !== undefined ? corpo.querySelector(`[data-outra="${b.dataset.resp}"]`).value : b.dataset.nota;
      if (nota === '') return toast('Informe a nota.', 'erro');
      return acao(b, async () => { await api('PATCH', `/respostas/${b.dataset.resp}`, { pontos_obtidos: Number(nota) }); toast('Correção salva.'); recarregar(); });
    });
  }
 
  on(el, 'click', '[data-status]', async (b) => {
    const st = b.dataset.status;
    if (st === 'publicada' && !p.questoes.length) return toast('Adicione pelo menos uma questão.', 'erro');
    const rot = { publicada: p.status === 'rascunho' ? 'Publicar' : 'Reabrir', encerrada: 'Encerrar' }[st];
    if (!(await confirmar({ titulo: `${rot} prova`, botao: rot, mensagem: st === 'publicada' ? '<p>As tribos poderão responder dentro do período configurado.</p>' : '<p>Ninguém mais poderá responder.</p>' }))) return undefined;
    return acao(b, async () => { await api('PATCH', `/provas/${p.id}`, { status: st }); recarregar(); });
  });
  el.querySelector('#config')?.addEventListener('click', () => modal({
    titulo: 'Configurações da prova',
    html: formProva(p),
    aoAbrir: (m, fechar) => {
      ligarFormProva(m);
      aoEnviar(m.querySelector('form'), async (d) => { await api('PATCH', `/provas/${p.id}`, d); toast('Prova atualizada.'); fechar(); recarregar(); });
    },
  }));
  el.querySelector('#aplicar')?.addEventListener('click', () => modal({
    titulo: 'Aplicar prova agora',
    html: `<form><p class="suave pequeno">Use para aplicar a prova presencialmente pelo seu celular. As respostas contam para a tribo escolhida.</p>
      <label class="campo"><span>Tribo *</span><select name="tribo" required>${opcoesTribos('', 'Escolha…')}</select></label>
      <button class="btn btn--ouro btn--bloco" type="submit">Começar</button></form>`,
    aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (d) => { fechar(); location.hash = `#/responder/${p.id}?tribo=${d.tribo}`; }),
  }));
  void estado;
}
