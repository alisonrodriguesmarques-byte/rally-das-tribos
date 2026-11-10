import { api } from '../api.js';
import { estado, ehAdmin, somenteLeitura, recarregarTribos } from '../estado.js';
import {
  esc, fmtPontos, fmtData, definirTitulo, vazio, avatar, modal, confirmar, aoEnviar, on, toast, acao, opcoes, tratarErro,
} from '../ui.js';
import { itemLancamento, abrirLancamento } from './lancamentos.js';
import { escolherPessoa } from './pessoas.js';
 
export default async function tribo(el, { id }) {
  const t = await api('GET', `/rally-tribos/${id}`);
  definirTitulo(`Tribo de ${t.nome}`);
  const admin = ehAdmin();
  const editar = admin && !somenteLeitura();
  const max = Math.max(1, ...t.por_categoria.map((c) => c.pontos));
 
  el.innerHTML = `
    <div class="cartao" style="border-top:8px solid ${esc(t.cor)}">
      <div class="linha linha--entre"><h1 style="margin:0">${esc(t.nome)}</h1>
        <div class="direita"><div class="pontos" style="font-size:1.6rem">${fmtPontos(t.pontos)}</div><div class="suave">${t.posicao}º de ${t.total_tribos}</div></div></div>
      <ul class="lista" style="margin-top:.5rem">
        <li><span class="cresce suave">Cabeça</span><b>${esc(t.cabeca_nome || '—')}</b></li>
        <li><span class="cresce suave">Auxiliar</span><b>${esc(t.auxiliar_nome || '—')}</b></li>
        <li><span class="cresce suave">Participantes</span><b>${t.participantes}</b></li>
      </ul>
      ${editar ? `<div class="botoes" style="margin-top:.6rem"><a class="btn btn--ouro" href="#/lancar?tribo=${t.id}">+ Lançar pontos</a><button class="btn" data-lideranca>Cabeça e auxiliar</button></div>` : ''}
    </div>
 
    <div class="secao-titulo"><h2>Participantes</h2>${editar ? '<button class="btn btn--peq btn--primario" data-adicionar>+ Adicionar</button>' : ''}</div>
    <div class="cartao">${t.membros.length ? `<ul class="lista">${t.membros.map((m) => `
      <li>${avatar(m.apelido || m.nome_completo, t.cor, m.foto_url)}
        <div class="cresce">${admin ? `<a href="#/pessoas/${m.pessoa_id}"><b>${esc(m.nome_completo)}</b></a>` : `<b>${esc(m.apelido || m.nome_completo)}</b>`}
          ${m.entrou_em ? `<div class="suave pequeno">desde ${fmtData(m.entrou_em)}</div>` : ''}</div>
        ${editar ? `<button class="btn btn--peq" data-transferir="${m.id}" data-nome="${esc(m.nome_completo)}">Transferir</button>
          <button class="btn btn--peq btn--perigo" data-remover="${m.id}" data-nome="${esc(m.nome_completo)}" aria-label="Remover">✕</button>` : ''}</li>`).join('')}</ul>` : vazio('Nenhum participante ainda.')}</div>
 
    <div class="secao-titulo"><h2>Pontos por categoria</h2></div>
    <div class="cartao">${t.por_categoria.length ? t.por_categoria.map((c) => `
      <div style="margin-bottom:.6rem"><div class="linha linha--entre"><span>${esc(c.categoria)}</span><b class="pontos">${fmtPontos(c.pontos)}</b></div>
      <div class="ranking__barra" style="--cor:${esc(t.cor)}"><i style="width:${Math.max(2, Math.round((Math.max(0, c.pontos) / max) * 100))}%"></i></div></div>`).join('') : vazio('Sem pontos ainda.')}</div>
 
    ${t.historico.length || admin ? `<div class="secao-titulo"><h2>Histórico de pontos</h2>${admin ? `<a href="#/lancamentos?tribo=${t.id}">Completo</a>` : ''}</div>
    <div class="cartao"><ul class="lista" id="hist">${t.historico.length ? t.historico.slice(0, 30).map(itemLancamento).join('') : vazio('Nenhum lançamento.')}</ul></div>` : ''}`;
 
  const recarregar = async () => {
    await recarregarTribos();
    await tribo(el, { id });
  };
 
  if (admin) on(el.querySelector('#hist'), 'click', '[data-lanc]', (li) => abrirLancamento(Number(li.dataset.lanc), recarregar).catch(tratarErro));
  if (!editar) return;
 
  el.querySelector('[data-lideranca]').addEventListener('click', () => acao(null, async () => {
    const pessoas = await api('GET', '/pessoas?ativo=1');
    const lista = pessoas.map((p) => [p.id, p.apelido ? `${p.nome_completo} (${p.apelido})` : p.nome_completo]);
    modal({
      titulo: `Liderança de ${t.nome}`,
      html: `<form>
        <label class="campo"><span>Cabeça</span><select name="cabeca_pessoa_id">${opcoes(lista, t.cabeca_pessoa_id, 'Sem cabeça')}</select></label>
        <label class="campo"><span>Auxiliar</span><select name="auxiliar_pessoa_id">${opcoes(lista, t.auxiliar_pessoa_id, 'Sem auxiliar')}</select></label>
        <p class="suave pequeno">Não encontrou a pessoa? Cadastre em <a href="#/pessoas">Pessoas</a>. Para o líder entrar no sistema, crie o acesso dele no cadastro da pessoa.</p>
        <button class="btn btn--primario btn--bloco" type="submit">Salvar</button></form>`,
      aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (d) => {
        await api('PATCH', `/rally-tribos/${t.id}`, d);
        toast('Liderança atualizada.');
        fechar();
        await recarregar();
      }),
    });
  }));
 
  el.querySelector('[data-adicionar]').addEventListener('click', async () => {
    const p = await escolherPessoa({ titulo: `Adicionar a ${t.nome}`, semTribo: true, permitirNova: true });
    if (!p) return;
    await acao(null, async () => {
      await api('POST', `/rally-tribos/${t.id}/membros`, { pessoa_id: p.id });
      toast(`${p.nome_completo} entrou na tribo.`);
      await recarregar();
    });
  });
 
  on(el, 'click', '[data-transferir]', (b) => {
    modal({
      titulo: `Transferir ${b.dataset.nome}`,
      html: `<form><label class="campo"><span>Nova tribo</span><select name="rally_tribo_id" required>${opcoes(estado.tribos.filter((x) => x.id !== t.id).map((x) => [x.id, x.nome]), '', 'Escolha…')}</select></label>
        <p class="suave pequeno">O histórico fica guardado: os pontos já ganhos continuam com ${esc(t.nome)}.</p>
        <button class="btn btn--primario btn--bloco" type="submit">Transferir</button></form>`,
      aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (d) => {
        await api('POST', `/membros/${b.dataset.transferir}/transferir`, d);
        toast('Transferência registrada.');
        fechar();
        await recarregar();
      }),
    });
  });
 
  on(el, 'click', '[data-remover]', async (b) => {
    const r = await confirmar({
      titulo: 'Remover da tribo', perigo: true, botao: 'Remover', motivo: true, rotuloMotivo: 'Motivo (ex.: saiu do rally)',
      mensagem: `<p>Remover <b>${esc(b.dataset.nome)}</b> de ${esc(t.nome)}? O histórico continua guardado.</p>`,
    });
    if (!r) return;
    await acao(null, async () => {
      await api('POST', `/membros/${b.dataset.remover}/remover`, { motivo: r.motivo });
      toast('Participante removido.');
      await recarregar();
    });
  });
}
