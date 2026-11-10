import { api } from '../api.js';
import { estado, rid, ehAdmin, ehLider, somenteLeitura } from '../estado.js';
import {
  esc, fmtPontos, fmtData, definirTitulo, vazio, etiqueta, modal, aoEnviar, toast, on, opcoes, opcoesTribos, opcoesCategorias,
  bolinha, confirmar, acao, semRally, hoje,
} from '../ui.js';
 
const formDinamica = (d = {}, admin = true) => `<form>
  ${admin ? `<label class="campo"><span>Tribo responsável *</span><select name="rally_tribo_id" required ${d.id ? 'disabled' : ''}>${opcoesTribos(d.rally_tribo_id, 'Escolha…')}</select></label>
  <label class="campo"><span>Título *</span><input name="titulo" required maxlength="150" value="${esc(d.titulo || '')}"></label>` : ''}
  <label class="campo"><span>Tema</span><input name="tema" maxlength="150" value="${esc(d.tema || '')}"></label>
  <label class="campo"><span>Descrição</span><textarea name="descricao" maxlength="3000">${esc(d.descricao || '')}</textarea></label>
  ${admin ? `<div class="grade"><label class="campo"><span>Data do encontro</span><input name="data_encontro" type="date" value="${esc(d.data_encontro || hoje())}"></label>
  <label class="campo"><span>Pontos previstos</span><input name="pontos_previstos" type="number" step="1" min="0" value="${d.pontos_previstos ?? ''}"></label></div>
  <label class="campo"><span>Categoria</span><select name="categoria_id">${opcoesCategorias(d.categoria_id ?? estado.categorias.find((c) => c.nome === 'Dinâmica')?.id, 'Dinâmica')}</select></label>` : ''}
  ${d.id ? `<label class="campo"><span>Resultado / como foi</span><textarea name="resultado" maxlength="3000">${esc(d.resultado || '')}</textarea></label>
  <label class="campo"><span>Link de evidência</span><input name="evidencia_url" type="url" maxlength="500" value="${esc(d.evidencia_url || '')}"></label>` : ''}
  <button class="btn btn--primario btn--bloco" type="submit">Salvar</button></form>`;
 
export default async function dinamicas(el, _p, query) {
  definirTitulo('Dinâmicas');
  if (!rid()) {
    el.innerHTML = semRally();
    return;
  }
  const admin = ehAdmin();
  const editavel = !somenteLeitura();
  let status = query.status || '';
  const lista = await api('GET', `/rallies/${rid()}/dinamicas${status ? `?status=${status}` : ''}`);
  const minha = estado.ctx?.rallyTriboId;
 
  el.innerHTML = `${admin && editavel ? '<button class="btn btn--primario btn--bloco" id="nova" style="margin-bottom:.85rem">+ Nova dinâmica</button>' : ''}
    <div class="chips">${[['', 'Todas'], ['pendente', 'Pendentes'], ['enviada', 'Enviadas'], ['realizada', 'Realizadas'], ['nao_realizada', 'Não realizadas']].map(([k, r]) => `<button class="chip${k === status ? ' ativo' : ''}" data-st="${k}">${r}</button>`).join('')}</div>
    ${lista.length ? lista.map((d) => `<div class="cartao">
      <div class="linha linha--entre"><div class="linha">${bolinha(d.tribo_cor)}<b>${esc(d.tribo_nome)}</b></div>${etiqueta(d.status)}</div>
      <h3 style="margin:.4rem 0 .2rem">${esc(d.titulo)}</h3>
      <div class="suave pequeno">${d.tema ? `Tema: ${esc(d.tema)} · ` : ''}${d.data_encontro ? fmtData(d.data_encontro) : 'sem data'}${d.responsavel_nome ? ` · ${esc(d.responsavel_nome)}` : ''}</div>
      ${d.descricao ? `<p class="pequeno quebra" style="white-space:pre-line">${esc(d.descricao)}</p>` : ''}
      ${d.resultado ? `<p class="pequeno quebra"><b>Resultado:</b> ${esc(d.resultado)}</p>` : ''}
      ${d.evidencia_url ? `<a class="pequeno" href="${esc(d.evidencia_url)}" target="_blank" rel="noopener">Ver evidência</a>` : ''}
      <div class="linha" style="margin-top:.4rem"><span class="cresce suave pequeno">Previsto: ${fmtPontos(d.pontos_previstos)} pts</span>
        ${d.pontos_lancados !== null && d.lancamento_status === 'ativo' ? `<b class="pontos pontos--pos">${fmtPontos(d.pontos_lancados, true)}</b>` : ''}</div>
      ${editavel && (admin || (ehLider() && d.rally_tribo_id === minha)) ? `<div class="botoes" style="margin-top:.6rem">
        ${admin ? `${d.status !== 'realizada' ? `<button class="btn btn--peq btn--verde" data-realizada="${d.id}">Realizada</button>` : `<button class="btn btn--peq" data-realizada="${d.id}">Ajustar pontos</button>`}
          ${d.status !== 'nao_realizada' ? `<button class="btn btn--peq btn--perigo" data-status="nao_realizada" data-id="${d.id}">Não realizada</button>` : ''}`
          : d.status === 'pendente' ? `<button class="btn btn--peq btn--ouro" data-status="enviada" data-id="${d.id}">Marcar como enviada</button>` : ''}
        <button class="btn btn--peq" data-editar="${d.id}">Editar</button></div>` : ''}
    </div>`).join('') : `<div class="cartao">${vazio('Nenhuma dinâmica aqui.')}</div>`}`;
 
  const recarregar = () => dinamicas(el, {}, { status });
  const achar = (id) => lista.find((d) => d.id === Number(id));
  on(el, 'click', '[data-st]', (b) => {
    status = b.dataset.st;
    recarregar();
  });
  el.querySelector('#nova')?.addEventListener('click', () => modal({
    titulo: 'Nova dinâmica',
    html: formDinamica(),
    aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (d) => {
      await api('POST', `/rallies/${rid()}/dinamicas`, d);
      toast('Dinâmica cadastrada.');
      fechar();
      recarregar();
    }),
  }));
  on(el, 'click', '[data-editar]', (b) => {
    const d = achar(b.dataset.editar);
    modal({
      titulo: 'Editar dinâmica',
      html: formDinamica(d, admin),
      aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (dados) => {
        await api('PATCH', `/dinamicas/${d.id}`, dados);
        toast('Dinâmica atualizada.');
        fechar();
        recarregar();
      }),
    });
  });
  on(el, 'click', '[data-realizada]', (b) => {
    const d = achar(b.dataset.realizada);
    modal({
      titulo: 'Dinâmica realizada',
      html: `<form><p><b>${esc(d.tribo_nome)}</b> · ${esc(d.titulo)}</p>
        <label class="campo"><span>Pontos para a tribo *</span><input name="pontos" type="number" step="1" required value="${d.pontos_lancados ?? d.pontos_previstos ?? ''}"></label>
        <label class="campo"><span>Resultado / observações</span><textarea name="resultado">${esc(d.resultado || '')}</textarea></label>
        <button class="btn btn--verde btn--bloco" type="submit">Confirmar e lançar pontos</button></form>`,
      aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (dados) => {
        await api('POST', `/dinamicas/${d.id}/status`, { ...dados, status: 'realizada' });
        toast('Pontos da dinâmica lançados.');
        fechar();
        recarregar();
      }),
    });
  });
  on(el, 'click', '[data-status]', async (b) => {
    const st = b.dataset.status;
    const ok = await confirmar({
      titulo: st === 'enviada' ? 'Marcar como enviada' : 'Não realizada',
      perigo: st === 'nao_realizada',
      botao: 'Confirmar',
      mensagem: st === 'nao_realizada' ? '<p>Se havia pontos lançados por esta dinâmica, eles serão cancelados (fica no histórico).</p>' : '<p>Avisar a coordenação que a dinâmica foi preparada/enviada?</p>',
    });
    if (ok) await acao(b, async () => { await api('POST', `/dinamicas/${b.dataset.id}/status`, { status: st }); recarregar(); });
  });
}
