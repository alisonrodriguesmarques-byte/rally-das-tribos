import { api } from '../api.js';
import { estado, rid, somenteLeitura, recarregarTribos } from '../estado.js';
import {
  esc, fmtPontos, fmtData, fmtDataHora, definirTitulo, vazio, bolinha, etiqueta, modal, confirmar, aoEnviar, on, opcoesTribos,
  opcoesCategorias, opcoes, ORIGENS, toast, semRally, acao,
} from '../ui.js';
 
export function itemLancamento(l) {
  const cancelado = l.status === 'cancelado';
  return `<li class="item item--link" data-lanc="${l.id}">
    ${bolinha(l.tribo_cor)}
    <div class="cresce${cancelado ? ' riscado' : ''}"><b>${esc(l.tribo_nome)}</b> · ${esc(l.motivo)}
      <div class="suave pequeno">${fmtData(l.data_referencia)} · ${esc(l.categoria_nome || 'Sem categoria')} · ${esc(ORIGENS[l.origem_tipo] || l.origem_tipo)}${l.criado_por_nome ? ` · por ${esc(l.criado_por_nome)}` : ''}</div></div>
    <div class="direita"><span class="pontos ${l.pontos >= 0 ? 'pontos--pos' : 'pontos--neg'}${cancelado ? ' riscado' : ''}">${fmtPontos(l.pontos, true)}</span>
      ${cancelado ? `<div>${etiqueta('cancelado')}</div>` : ''}</div></li>`;
}
 
const ACOES = { criacao: 'Criado', edicao: 'Editado', cancelamento: 'Cancelado', reativacao: 'Reativado' };
 
export async function abrirLancamento(id, aoMudar) {
  const { lancamento: l, historico } = await api('GET', `/lancamentos/${id}/historico`);
  const editavel = l.status === 'ativo' && !somenteLeitura();
  const automatico = l.origem_tipo !== 'manual';
  const m = modal({
    titulo: `Lançamento #${l.id}`,
    html: `<ul class="lista">
      <li><span class="cresce suave">Pontos</span><b class="pontos">${fmtPontos(l.pontos, true)}</b></li>
      <li><span class="cresce suave">Status</span>${etiqueta(l.status)}</li>
      <li><span class="cresce suave">Motivo</span><span class="direita quebra">${esc(l.motivo)}</span></li>
      <li><span class="cresce suave">Origem</span>${esc(ORIGENS[l.origem_tipo] || l.origem_tipo)}</li>
      <li><span class="cresce suave">Data de referência</span>${fmtData(l.data_referencia)}</li>
      ${l.motivo_cancelamento ? `<li><span class="cresce suave">Motivo do cancelamento</span><span class="direita quebra">${esc(l.motivo_cancelamento)}</span></li>` : ''}
    </ul>
    <h3 style="margin-top:1rem">Histórico de alterações</h3>
    <ul class="lista">${historico.map((h) => `<li><div class="cresce"><b>${ACOES[h.acao] || h.acao}</b>
      ${h.acao === 'edicao' ? ` de ${fmtPontos(h.pontos_anteriores)} para ${fmtPontos(h.pontos_novos)}` : ''}
      <div class="suave pequeno">${esc(h.motivo || '')}</div></div><div class="direita suave pequeno">${esc(h.usuario_nome || '')}<br>${fmtDataHora(h.em)}</div></li>`).join('')}</ul>
    ${editavel ? `${automatico ? '<p class="suave pequeno">Este ponto foi gerado automaticamente. Prefira corrigir pela origem (missão, dinâmica ou prova).</p>' : ''}
      <div class="botoes" style="margin-top:.8rem"><button class="btn" data-editar>Editar</button><button class="btn btn--perigo" data-cancelar>Cancelar lançamento</button></div>` : ''}`,
    aoAbrir: (el, fechar) => {
      el.querySelector('[data-cancelar]')?.addEventListener('click', async () => {
        const r = await confirmar({
          titulo: 'Cancelar lançamento', perigo: true, botao: 'Cancelar lançamento', motivo: true, rotuloMotivo: 'Motivo do cancelamento',
          mensagem: `<p>Os <b>${fmtPontos(l.pontos)}</b> pontos de <b>${esc(l.tribo_nome)}</b> deixam de contar no ranking. O registro continua no histórico.</p>`,
        });
        if (!r) return;
        await acao(null, async () => {
          await api('POST', `/lancamentos/${l.id}/cancelar`, { motivo: r.motivo });
          toast('Lançamento cancelado.');
          fechar();
          await recarregarTribos();
          aoMudar?.();
        });
      });
      el.querySelector('[data-editar]')?.addEventListener('click', () => {
        fechar();
        editarLancamento(l, aoMudar);
      });
    },
  });
  return m;
}
 
function editarLancamento(l, aoMudar) {
  modal({
    titulo: 'Editar lançamento',
    html: `<form>
      <label class="campo"><span>Pontos</span><input name="pontos" type="number" step="1" required value="${l.pontos}"></label>
      <label class="campo"><span>Motivo</span><input name="motivo" required maxlength="300" value="${esc(l.motivo)}"></label>
      <label class="campo"><span>Categoria</span><select name="categoria_id">${opcoesCategorias(l.categoria_id)}</select></label>
      <label class="campo"><span>Data de referência</span><input name="data_referencia" type="date" value="${esc(String(l.data_referencia).slice(0, 10))}"></label>
      <label class="campo"><span>Por que está alterando? *</span><input name="motivo_alteracao" required maxlength="300" placeholder="Ex.: valor digitado errado"></label>
      <button class="btn btn--primario btn--bloco" type="submit">Salvar alteração</button></form>`,
    aoAbrir: (el, fechar) => aoEnviar(el.querySelector('form'), async (d) => {
      await api('PATCH', `/lancamentos/${l.id}`, d);
      toast('Lançamento atualizado.');
      fechar();
      await recarregarTribos();
      aoMudar?.();
    }),
  });
}
 
export default async function lancamentos(el, _p, query) {
  definirTitulo('Histórico de pontos');
  if (!rid()) {
    el.innerHTML = semRally();
    return;
  }
  const f = { rally_tribo_id: query.tribo || '', status: 'ativo', origem_tipo: '', categoria_id: '' };
  el.innerHTML = `<div class="cartao">
      <div class="grade">
        <label class="campo"><span>Tribo</span><select name="rally_tribo_id">${opcoesTribos(f.rally_tribo_id, 'Todas')}</select></label>
        <label class="campo"><span>Situação</span><select name="status">${opcoes([['ativo', 'Valendo'], ['cancelado', 'Cancelados'], ['', 'Todos']], f.status)}</select></label>
        <label class="campo"><span>Origem</span><select name="origem_tipo">${opcoes(Object.entries(ORIGENS), '', 'Todas')}</select></label>
        <label class="campo"><span>Categoria</span><select name="categoria_id">${opcoes(estado.categorias.map((c) => [c.id, c.nome]), '', 'Todas')}</select></label>
      </div>
      <div class="linha linha--entre"><span class="suave" id="resumo"></span><a class="btn btn--peq" href="/api/rallies/${rid()}/exportar/lancamentos.csv">Exportar CSV</a></div>
    </div>
    <div class="cartao"><ul class="lista" id="lista"></ul></div>`;
  const lista = el.querySelector('#lista');
  async function carregar() {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '')).toString();
    const itens = await api('GET', `/rallies/${rid()}/lancamentos?${qs}`);
    const total = itens.filter((l) => l.status === 'ativo').reduce((a, l) => a + l.pontos, 0);
    el.querySelector('#resumo').textContent = `${itens.length} lançamento(s) · ${fmtPontos(total)} pts valendo`;
    lista.innerHTML = itens.length ? itens.map(itemLancamento).join('') : vazio('Nenhum lançamento encontrado.');
  }
  el.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => {
    f[s.name] = s.value;
    carregar();
  }));
  on(lista, 'click', '[data-lanc]', (li) => acao(null, () => abrirLancamento(Number(li.dataset.lanc), carregar)));
  await carregar();
}
