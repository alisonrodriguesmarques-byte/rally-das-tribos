import { api } from '../api.js';
import { estado, rid, somenteLeitura, recarregarTribos, triboPorId } from '../estado.js';
import {
  esc, fmtPontos, definirTitulo, aviso, hoje, opcoesCategorias, confirmar, toast, on, tratarErro, semRally, vazio,
} from '../ui.js';
import { itemLancamento, abrirLancamento } from './lancamentos.js';
 
const RAPIDOS = [100, 200, 300, 500, 1000, 1500, 2000, 5000];
 
export default async function lancar(el, _p, query) {
  definirTitulo('Lançar pontos');
  if (!rid()) {
    el.innerHTML = semRally();
    return;
  }
  if (somenteLeitura()) {
    el.innerHTML = aviso('Rally encerrado: não é possível lançar pontos.');
    return;
  }
  const st = { tribo: triboPorId(query.tribo)?.id || null, valor: null, sinal: 1 };
 
  el.innerHTML = `<form id="f">
    <div class="cartao"><h3>1. Tribo</h3><div class="tribos-grade" id="tribos"></div></div>
    <div class="cartao"><h3>2. Pontos</h3>
      <div class="chips"><button type="button" class="chip ativo" data-sinal="1">+ Adicionar</button><button type="button" class="chip" data-sinal="-1">− Retirar (penalidade)</button></div>
      <div class="valores">${RAPIDOS.map((v) => `<button type="button" class="chip" data-valor="${v}">${fmtPontos(v)}</button>`).join('')}</div>
      <label class="campo" style="margin:0"><span>Outro valor</span><input name="valor" type="number" inputmode="numeric" min="1" step="1" placeholder="Ex.: 750"></label>
    </div>
    <div class="cartao"><h3>3. Detalhes</h3>
      <label class="campo"><span>Motivo *</span><input name="motivo" required maxlength="300" list="motivos" autocomplete="off" placeholder="Ex.: Vitória na dinâmica de sábado"></label>
      <datalist id="motivos"></datalist>
      <label class="campo"><span>Categoria</span><select name="categoria_id">${opcoesCategorias('')}</select></label>
      <label class="campo"><span>Data de referência</span><input name="data_referencia" type="date" value="${hoje()}"></label>
      <label class="campo"><span>Jovem relacionado (opcional)</span><select name="pessoa_id"><option value="">Ninguém em específico</option></select></label>
    </div>
    <button class="btn btn--ouro btn--bloco" type="submit" id="enviar" disabled>Escolha a tribo e os pontos</button>
  </form>
  <div class="secao-titulo"><h2>Últimos lançamentos</h2><a href="#/lancamentos">Histórico completo</a></div>
  <div class="cartao"><ul class="lista" id="ultimos"></ul></div>`;
 
  const form = el.querySelector('#f');
  const btn = el.querySelector('#enviar');
  const inputValor = form.elements.valor;
 
  const desenharTribos = () => {
    el.querySelector('#tribos').innerHTML = estado.tribos.map((t) => `
      <button type="button" class="tribo-btn${st.tribo === t.id ? ' ativo' : ''}" data-tribo="${t.id}" style="--cor:${esc(t.cor)}">
        <span class="bolinha" style="background:${esc(t.cor)}"></span>${esc(t.nome)}<span class="suave pequeno">${fmtPontos(t.pontos)}</span></button>`).join('');
  };
  const atualizarBotao = () => {
    const t = triboPorId(st.tribo);
    const v = st.valor;
    btn.disabled = !t || !v;
    btn.textContent = !t || !v ? 'Escolha a tribo e os pontos' : `Lançar ${fmtPontos(st.sinal * v, true)} para ${t.nome}`;
    el.querySelectorAll('[data-valor]').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.valor) === v && !inputValor.value));
    el.querySelectorAll('[data-sinal]').forEach((b) => b.classList.toggle('ativo', Number(b.dataset.sinal) === st.sinal));
  };
  const carregarPessoas = async () => {
    const sel = form.elements.pessoa_id;
    sel.innerHTML = '<option value="">Ninguém em específico</option>';
    if (!st.tribo) return;
    const p = await api('GET', `/rally-tribos/${st.tribo}`);
    const pessoas = [
      ...(p.cabeca_pessoa_id ? [[p.cabeca_pessoa_id, `${p.cabeca_nome} (cabeça)`]] : []),
      ...(p.auxiliar_pessoa_id ? [[p.auxiliar_pessoa_id, `${p.auxiliar_nome} (auxiliar)`]] : []),
      ...p.membros.map((m) => [m.pessoa_id, m.apelido || m.nome_completo]),
    ];
    sel.innerHTML += pessoas.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('');
  };
  const carregarUltimos = async () => {
    const itens = await api('GET', `/rallies/${rid()}/lancamentos?limite=40`);
    el.querySelector('#ultimos').innerHTML = itens.length ? itens.slice(0, 8).map(itemLancamento).join('') : vazio('Nenhum lançamento ainda.');
    el.querySelector('#motivos').innerHTML = [...new Set(itens.map((l) => l.motivo))].map((m) => `<option value="${esc(m)}">`).join('');
  };
  const recarregar = async () => {
    await recarregarTribos();
    desenharTribos();
    await carregarUltimos();
  };
 
  on(el, 'click', '[data-tribo]', (b) => {
    st.tribo = Number(b.dataset.tribo);
    desenharTribos();
    atualizarBotao();
    carregarPessoas().catch(tratarErro);
  });
  on(el, 'click', '[data-valor]', (b) => {
    st.valor = Number(b.dataset.valor);
    inputValor.value = '';
    atualizarBotao();
  });
  on(el, 'click', '[data-sinal]', (b) => {
    st.sinal = Number(b.dataset.sinal);
    atualizarBotao();
  });
  inputValor.addEventListener('input', () => {
    st.valor = Math.abs(parseInt(inputValor.value, 10)) || null;
    atualizarBotao();
  });
  on(el.querySelector('#ultimos'), 'click', '[data-lanc]', (li) => abrirLancamento(Number(li.dataset.lanc), recarregar).catch(tratarErro));
 
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = triboPorId(st.tribo);
    const motivo = form.elements.motivo.value.trim();
    if (!t || !st.valor) return;
    if (!motivo) {
      form.elements.motivo.focus();
      toast('Informe o motivo.', 'erro');
      return;
    }
    const pontos = st.sinal * st.valor;
    const ok = await confirmar({
      titulo: 'Confirmar lançamento',
      botao: 'Lançar',
      perigo: pontos < 0,
      mensagem: `<p style="font-size:1.1rem"><b class="pontos ${pontos < 0 ? 'pontos--neg' : 'pontos--pos'}">${fmtPontos(pontos, true)}</b> pontos para <b>${esc(t.nome)}</b></p><p class="suave">${esc(motivo)}</p>`,
    });
    if (!ok) return;
    btn.disabled = true;
    try {
      await api('POST', `/rallies/${rid()}/lancamentos`, {
        rally_tribo_id: t.id,
        pontos,
        motivo,
        categoria_id: form.elements.categoria_id.value,
        data_referencia: form.elements.data_referencia.value,
        pessoa_id: form.elements.pessoa_id.value,
      });
      toast(`${fmtPontos(pontos, true)} para ${t.nome}!`);
      st.valor = null;
      inputValor.value = '';
      form.elements.motivo.value = '';
      await recarregar();
    } catch (err) {
      tratarErro(err, form);
    }
    atualizarBotao();
  });
 
  desenharTribos();
  atualizarBotao();
  if (st.tribo) carregarPessoas().catch(tratarErro);
  await carregarUltimos();
}
