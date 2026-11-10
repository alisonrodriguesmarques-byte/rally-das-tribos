import { api } from '../api.js';
import { estado, carregarRallies, definirRally } from '../estado.js';
import {
  esc, fmtData, definirTitulo, vazio, etiqueta, modal, aoEnviar, toast, confirmar, on, acao, opcoes,
} from '../ui.js';
 
const form = (r = {}, novo = false) => `<form>
  <label class="campo"><span>Nome *</span><input name="nome" required maxlength="120" value="${esc(r.nome || '')}" placeholder="Ex.: Rally das Tribos 2026"></label>
  <div class="grade"><label class="campo"><span>Início *</span><input name="data_inicio" type="date" required value="${esc(r.data_inicio || '')}"></label>
  <label class="campo"><span>Fim *</span><input name="data_fim" type="date" required value="${esc(r.data_fim || '')}"></label></div>
  ${novo ? `<label class="campo"><span>Situação</span><select name="status">${opcoes([['planejado', 'Planejado'], ['ativo', 'Ativo (começa agora)']], 'ativo')}</select></label>
  ${estado.rallies.length ? `<label class="check"><input type="checkbox" name="copiar_lideres" checked> Manter os mesmos cabeças e auxiliares do rally anterior</label>
  <label class="check"><input type="checkbox" name="copiar_participantes"> Copiar também os participantes do rally anterior</label>` : ''}
  <p class="suave pequeno">As 12 tribos são criadas automaticamente. Ativar este rally encerra o rally ativo anterior (o histórico fica guardado).</p>` : ''}
  <button class="btn btn--primario btn--bloco" type="submit">${novo ? 'Criar rally' : 'Salvar'}</button></form>`;
 
export default async function rallies(el) {
  definirTitulo('Rallies');
  const lista = await api('GET', '/rallies');
  el.innerHTML = `<button class="btn btn--primario btn--bloco" id="novo" style="margin-bottom:.85rem">+ Novo rally</button>
    ${lista.length ? lista.map((r) => `<div class="cartao">
      <div class="linha linha--entre"><div><h2 style="margin:0">${esc(r.nome)}</h2><div class="suave">${fmtData(r.data_inicio)} a ${fmtData(r.data_fim)}</div></div>
      <div>${etiqueta(r.status)}${estado.rally?.id === r.id ? ' <span class="etiqueta etiqueta--azul">em uso</span>' : ''}</div></div>
      <div class="botoes" style="margin-top:.7rem">
        ${estado.rally?.id !== r.id ? `<button class="btn btn--peq" data-usar="${r.id}">Usar este</button>` : ''}
        ${r.status !== 'encerrado' ? `<button class="btn btn--peq" data-editar="${r.id}">Editar</button>` : ''}
        ${r.status === 'planejado' ? `<button class="btn btn--peq btn--verde" data-status="ativo" data-id="${r.id}">Ativar</button>` : ''}
        ${r.status === 'ativo' ? `<button class="btn btn--peq btn--perigo" data-status="encerrado" data-id="${r.id}">Encerrar</button>` : ''}
        ${r.status === 'encerrado' ? `<button class="btn btn--peq" data-status="ativo" data-id="${r.id}">Reabrir</button>` : ''}
        <a class="btn btn--peq" href="/api/rallies/${r.id}/exportar/ranking.csv">Ranking CSV</a>
        <a class="btn btn--peq" href="/api/rallies/${r.id}/exportar/lancamentos.csv">Pontos CSV</a>
      </div></div>`).join('') : vazio('Nenhum rally ainda.')}`;
 
  const recarregar = async (preferido) => {
    await carregarRallies(preferido);
    window.dispatchEvent(new Event('rally:recarregar'));
  };
 
  el.querySelector('#novo').addEventListener('click', () => modal({
    titulo: 'Novo rally',
    html: form({}, true),
    aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (d) => {
      const r = await api('POST', '/rallies', d);
      toast('Rally criado com as 12 tribos.');
      fechar();
      await recarregar(r.id);
    }),
  }));
  on(el, 'click', '[data-usar]', (b) => acao(b, async () => {
    await definirRally(Number(b.dataset.usar));
    window.dispatchEvent(new Event('rally:recarregar'));
  }));
  on(el, 'click', '[data-editar]', (b) => {
    const r = lista.find((x) => x.id === Number(b.dataset.editar));
    modal({
      titulo: 'Editar rally',
      html: form(r),
      aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (d) => {
        await api('PATCH', `/rallies/${r.id}`, d);
        toast('Rally atualizado.');
        fechar();
        await recarregar(estado.rally?.id);
      }),
    });
  });
  on(el, 'click', '[data-status]', async (b) => {
    const r = lista.find((x) => x.id === Number(b.dataset.id));
    const st = b.dataset.status;
    const msgs = {
      encerrado: ['Encerrar rally', `<p>Encerrar <b>${esc(r.nome)}</b>? Os dados ficam guardados, mas ninguém poderá lançar ou alterar pontos.</p>`],
      ativo: [r.status === 'encerrado' ? 'Reabrir rally' : 'Ativar rally', `<p>${r.status === 'encerrado' ? 'Reabrir' : 'Ativar'} <b>${esc(r.nome)}</b>? Se houver outro rally ativo, ele será encerrado.</p>`],
    };
    const ok = await confirmar({ titulo: msgs[st][0], mensagem: msgs[st][1], perigo: st === 'encerrado', botao: msgs[st][0].split(' ')[0] });
    if (!ok) return;
    await acao(b, async () => {
      await api('PATCH', `/rallies/${r.id}`, { status: st });
      toast('Situação atualizada.');
      await recarregar(r.id);
    });
  });
}
