import { api } from '../api.js';
import { estado, rid, ehAdmin, ehLider, somenteLeitura } from '../estado.js';
import {
  esc, fmtPontos, fmtData, fmtDataHora, definirTitulo, vazio, etiqueta, modal, aoEnviar, toast, on, opcoes, opcoesCategorias,
  opcoesTribos, checksTribos, hoje, bolinha, confirmar, acao, semRally,
} from '../ui.js';
 
export const TIPOS = {
  fixa: 'Pontos fixos (cumpriu, ganhou)',
  quantidade: 'Por quantidade (ex.: 500 por convidado)',
  meta: 'Por meta (atingiu a meta, ganhou)',
  manual: 'Manual (você define os pontos na aprovação)',
};
 
export function regraMissao(m) {
  if (!ehAdmin()) return 'Resultado acompanhado pela coordenação';
  switch (m.tipo_pontuacao) {
    case 'fixa': return `${fmtPontos(m.pontos)} pts`;
    case 'quantidade': return `${fmtPontos(m.pontos)} pts por unidade${m.limite_por_tribo ? ` (máx. ${m.limite_por_tribo})` : ''}`;
    case 'meta': return `${fmtPontos(m.pontos)} pts ao atingir ${m.meta_quantidade}`;
    default: return 'Pontos definidos na aprovação';
  }
}
 
export function formMissao(m = {}) {
  return `<form>
    <label class="campo"><span>Título *</span><input name="titulo" required maxlength="150" value="${esc(m.titulo || '')}"></label>
    <label class="campo"><span>Descrição</span><textarea name="descricao" maxlength="3000">${esc(m.descricao || '')}</textarea></label>
    <label class="campo"><span>Como pontua</span><select name="tipo_pontuacao">${opcoes(Object.entries(TIPOS), m.tipo_pontuacao || 'fixa')}</select></label>
    <div class="grade">
      <label class="campo" data-p="fixa quantidade meta"><span>Pontos</span><input name="pontos" type="number" min="0" step="1" value="${m.pontos ?? ''}"></label>
      <label class="campo" data-p="meta"><span>Meta (quantidade)</span><input name="meta_quantidade" type="number" min="1" step="1" value="${m.meta_quantidade ?? ''}"></label>
      <label class="campo" data-p="quantidade"><span>Limite por tribo</span><input name="limite_por_tribo" type="number" min="1" step="1" value="${m.limite_por_tribo ?? ''}" placeholder="sem limite"></label>
    </div>
    <div class="grade"><label class="campo"><span>Início *</span><input name="data_inicio" type="date" required value="${esc(m.data_inicio || hoje())}"></label>
    <label class="campo"><span>Prazo</span><input name="data_limite" type="date" value="${esc(m.data_limite || '')}"></label></div>
    <label class="campo"><span>Categoria</span><select name="categoria_id">${opcoesCategorias(m.categoria_id ?? estado.categorias.find((c) => c.nome === 'Missões especiais')?.id, 'Missões especiais')}</select></label>
    <label class="check"><input type="checkbox" name="requer_aprovacao"${m.requer_aprovacao === false || m.requer_aprovacao === 0 ? '' : ' checked'}> Entregas dos cabeças precisam da sua aprovação</label>
    <details style="margin-bottom:.8rem"${m.tribos?.length ? ' open' : ''}><summary class="suave">Tribos participantes (vazio = todas)</summary>${checksTribos(m.tribos || [])}</details>
    <label class="campo"><span>Observações</span><textarea name="observacoes" maxlength="2000">${esc(m.observacoes || '')}</textarea></label>
    <button class="btn btn--primario btn--bloco" type="submit">Salvar missão</button></form>`;
}
 
export function ligarFormMissao(el) {
  const sel = el.querySelector('[name=tipo_pontuacao]');
  const atualizar = () => el.querySelectorAll('[data-p]').forEach((c) => { c.hidden = !c.dataset.p.split(' ').includes(sel.value); });
  sel.addEventListener('change', atualizar);
  atualizar();
}
 
export function abrirNovaMissao(aoSalvar) {
  modal({
    titulo: 'Nova missão',
    html: formMissao(),
    aoAbrir: (m, fechar) => {
      ligarFormMissao(m);
      aoEnviar(m.querySelector('form'), async (d) => {
        const r = await api('POST', `/rallies/${rid()}/missoes`, d);
        toast('Missão criada.');
        fechar();
        aoSalvar?.(r.id);
      });
    },
  });
}
 
/** Formulário de envio de resultado de missão (admin escolhe a tribo). */
export function abrirEntrega(m, aoSalvar) {
  const admin = ehAdmin();
  const campoQtd = ['quantidade', 'meta'].includes(m.tipo_pontuacao);
  modal({
    titulo: `Resultado: ${m.titulo}`,
    html: `<form>
      <p class="suave">${esc(regraMissao(m))}</p>
      ${admin ? `<label class="campo"><span>Tribo *</span><select name="rally_tribo_id" required>${opcoesTribos('', 'Escolha…')}</select></label>` : ''}
      ${campoQtd ? '<label class="campo"><span>Quantidade *</span><input name="quantidade" type="number" min="0" step="1" required inputmode="numeric"></label>' : ''}
      ${m.tipo_pontuacao === 'manual' && admin ? '<label class="campo"><span>Pontos *</span><input name="pontos_manual" type="number" step="1" required></label>' : ''}
      <label class="campo"><span>Link da evidência (foto, vídeo)</span><input name="evidencia_url" type="url" maxlength="500" placeholder="https://…"></label>
      <label class="campo"><span>Observação</span><textarea name="observacao" maxlength="2000"></textarea></label>
      ${admin ? '<label class="check"><input type="checkbox" name="aprovar" checked> Aprovar e lançar os pontos agora</label>' : ''}
      <button class="btn btn--primario btn--bloco" type="submit">Enviar</button></form>`,
    aoAbrir: (el, fechar) => aoEnviar(el.querySelector('form'), async (d) => {
      await api('POST', `/missoes/${m.id}/entregas`, d);
      toast(admin && d.aprovar ? 'Resultado registrado e pontos lançados.' : 'Resultado enviado!');
      fechar();
      aoSalvar?.();
    }),
  });
}
 
export function itemEntrega(e, { comMissao = false, admin = false } = {}) {
  return `<li style="flex-wrap:wrap">${bolinha(e.tribo_cor)}
    <div class="cresce"><b>${esc(e.tribo_nome)}</b>${comMissao ? ` · ${esc(e.missao_titulo)}` : ''}
      <div class="suave pequeno">${e.quantidade !== null && e.quantidade !== undefined ? `Quantidade: ${e.quantidade} · ` : ''}${e.pontos_manual !== null && e.pontos_manual !== undefined ? `Pontos: ${e.pontos_manual} · ` : ''}${esc(e.enviado_por_nome || '')} · ${fmtDataHora(e.enviado_em)}</div>
      ${e.observacao ? `<div class="pequeno quebra">${esc(e.observacao)}</div>` : ''}
      ${e.evidencia_url ? `<a class="pequeno" href="${esc(e.evidencia_url)}" target="_blank" rel="noopener">Ver evidência</a>` : ''}
      ${e.observacao_admin ? `<div class="pequeno suave">Coordenação: ${esc(e.observacao_admin)}</div>` : ''}</div>
    <div class="direita">${etiqueta(e.status)}${admin && e.status === 'aprovada' && e.pontos_lancados !== null && e.lancamento_status === 'ativo' ? `<div class="pontos pontos--pos">${fmtPontos(e.pontos_lancados, true)}</div>` : ''}</div>
    ${admin && !somenteLeitura() ? `<div class="botoes" style="width:100%">
      ${e.status !== 'aprovada' ? `<button class="btn btn--peq btn--verde" data-aprovar="${e.id}">Aprovar</button>` : `<button class="btn btn--peq" data-aprovar="${e.id}">Reavaliar</button>`}
      ${e.status !== 'rejeitada' ? `<button class="btn btn--peq btn--perigo" data-rejeitar="${e.id}">Rejeitar</button>` : ''}</div>` : ''}</li>`;
}
 
/** Liga os botões aprovar/rejeitar de uma lista de entregas. */
export function ligarEntregas(raiz, entregas, missoesPorId, aoMudar) {
  on(raiz, 'click', '[data-aprovar]', (b) => {
    const e = entregas.find((x) => x.id === Number(b.dataset.aprovar));
    const m = missoesPorId(e.missao_id);
    modal({
      titulo: 'Aprovar entrega',
      html: `<form><p><b>${esc(e.tribo_nome)}</b> · ${esc(m?.titulo || e.missao_titulo)}</p><p class="suave">${m ? esc(regraMissao(m)) : ''}</p>
        ${m && ['quantidade', 'meta'].includes(m.tipo_pontuacao) ? `<label class="campo"><span>Quantidade (pode corrigir)</span><input name="quantidade" type="number" min="0" step="1" value="${e.quantidade ?? ''}"></label>` : ''}
        ${m?.tipo_pontuacao === 'manual' ? `<label class="campo"><span>Pontos *</span><input name="pontos_manual" type="number" step="1" required value="${e.pontos_manual ?? ''}"></label>` : ''}
        <label class="campo"><span>Comentário para a tribo</span><input name="observacao_admin" maxlength="500" value="${esc(e.observacao_admin || '')}"></label>
        <button class="btn btn--verde btn--bloco" type="submit">Aprovar e lançar pontos</button></form>`,
      aoAbrir: (el, fechar) => aoEnviar(el.querySelector('form'), async (d) => {
        const r = await api('POST', `/entregas/${e.id}/aprovar`, d);
        toast(`Aprovada: ${fmtPontos(r.pontos, true)} pts.`);
        fechar();
        aoMudar();
      }),
    });
  });
  on(raiz, 'click', '[data-rejeitar]', async (b) => {
    const r = await confirmar({
      titulo: 'Rejeitar entrega', perigo: true, botao: 'Rejeitar', motivo: true, rotuloMotivo: 'Motivo (a tribo verá)',
      mensagem: '<p>Se a entrega já tinha sido aprovada, os pontos serão cancelados (fica no histórico).</p>',
    });
    if (!r) return;
    await acao(b, async () => {
      await api('POST', `/entregas/${b.dataset.rejeitar}/rejeitar`, { motivo: r.motivo });
      toast('Entrega rejeitada.');
      aoMudar();
    });
  });
}
 
export default async function missoes(el, _p, query) {
  definirTitulo('Missões');
  if (!rid()) {
    el.innerHTML = semRally();
    return;
  }
  const admin = ehAdmin();
  let status = query.status || (admin ? '' : 'aberta');
  const [lista, pendentes] = await Promise.all([
    api('GET', `/rallies/${rid()}/missoes${status ? `?status=${status}` : ''}`),
    admin ? api('GET', `/rallies/${rid()}/entregas-pendentes`) : [],
  ]);
  const podeEnviar = (admin || ehLider()) && !somenteLeitura();
  el.innerHTML = `
    ${admin && !somenteLeitura() ? '<button class="btn btn--primario btn--bloco" id="nova" style="margin-bottom:.85rem">+ Nova missão</button>' : ''}
    ${pendentes.length ? `<div class="secao-titulo"><h2>Aguardando aprovação (${pendentes.length})</h2></div><div class="cartao"><ul class="lista" id="pend">${pendentes.map((e) => itemEntrega(e, { comMissao: true, admin })).join('')}</ul></div>` : ''}
    <div class="chips">${[['', 'Todas'], ['aberta', 'Abertas'], ['encerrada', 'Encerradas'], ...(admin ? [['cancelada', 'Canceladas']] : [])].map(([k, r]) => `<button class="chip${k === status ? ' ativo' : ''}" data-st="${k}">${r}</button>`).join('')}</div>
    ${lista.length ? lista.map((m) => `<div class="cartao">
      <a href="#/missoes/${m.id}" style="text-decoration:none;color:inherit"><div class="linha linha--entre"><h3 style="margin:0">${esc(m.titulo)}</h3>${etiqueta(m.status)}</div>
      <div class="suave pequeno">${esc(regraMissao(m))} · ${fmtData(m.data_inicio)}${m.data_limite ? ` até ${fmtData(m.data_limite)}` : ''}</div>
      ${m.descricao ? `<p class="pequeno quebra" style="margin:.4rem 0 0">${esc(m.descricao.slice(0, 180))}${m.descricao.length > 180 ? '…' : ''}</p>` : ''}</a>
      <div class="linha" style="margin-top:.5rem;flex-wrap:wrap">
        ${admin ? `<span class="suave pequeno cresce">${m.entregas.aprovada} aprovada(s) · ${m.entregas.enviada} aguardando</span>`
          : `<span class="cresce">${m.minhas_entregas.length ? m.minhas_entregas.map((e) => etiqueta(e.status)).join(' ') : '<span class="suave pequeno">Nada enviado ainda</span>'}</span>`}
        ${podeEnviar && m.status === 'aberta' ? `<button class="btn btn--peq btn--ouro" data-enviar="${m.id}">${admin ? 'Registrar resultado' : 'Enviar resultado'}</button>` : ''}
      </div></div>`).join('') : `<div class="cartao">${vazio('Nenhuma missão aqui.')}</div>`}`;
 
  const recarregar = () => missoes(el, {}, { status });
  el.querySelector('#nova')?.addEventListener('click', () => abrirNovaMissao(recarregar));
  on(el, 'click', '[data-st]', (b) => {
    status = b.dataset.st;
    recarregar();
  });
  on(el, 'click', '[data-enviar]', (b) => abrirEntrega(lista.find((m) => m.id === Number(b.dataset.enviar)), recarregar));
  const pend = el.querySelector('#pend');
  if (pend) ligarEntregas(pend, pendentes, (id) => lista.find((m) => m.id === id), recarregar);
}
