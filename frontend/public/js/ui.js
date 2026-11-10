import { estado, ehAdmin } from './estado.js';
 
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
 
export function definirTitulo(titulo) {
  document.getElementById('topo-titulo').textContent = titulo;
  document.title = `${titulo} · Rally das Tribos`;
}
 
let timerToast;
export function toast(msg, tipo = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast${tipo === 'erro' ? ' toast--erro' : ''}`;
  t.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { t.hidden = true; }, tipo === 'erro' ? 5000 : 2600);
}
 
export const hoje = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
export const fmtPontos = (n, sinal = false) => `${sinal && Number(n) > 0 ? '+' : ''}${Number(n || 0).toLocaleString('pt-BR')}`;
export const fmtData = (s) => {
  if (!s) return '';
  const [a, m, d] = String(s).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};
export const fmtDataHora = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
export const paraLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
export const deLocalInput = (v) => (v ? new Date(v).toISOString() : '');
export const iniciais = (nome) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const bolinha = (cor) => `<span class="bolinha" style="background:${esc(cor || '#ccc')}"></span>`;
export const avatar = (nome, cor = '#2d3b5e', foto = null) => (foto
  ? `<img class="avatar" src="${esc(foto)}" alt="">`
  : `<span class="avatar" style="background:${esc(cor)}">${esc(iniciais(nome))}</span>`);
 
const STATUS = {
  ativo: ['Ativo', 'verde'], planejado: ['Planejado', 'azul'], encerrado: ['Encerrado', ''], cancelado: ['Cancelado', 'vermelho'],
  aberta: ['Aberta', 'verde'], encerrada: ['Encerrada', ''], cancelada: ['Cancelada', 'vermelho'],
  enviada: ['Aguardando aprovação', 'laranja'], aprovada: ['Aprovada', 'verde'], rejeitada: ['Rejeitada', 'vermelho'],
  pendente: ['Pendente', ''], realizada: ['Realizada', 'verde'], nao_realizada: ['Não realizada', 'vermelho'],
  rascunho: ['Rascunho', ''], publicada: ['Publicada', 'verde'],
  em_andamento: ['Em andamento', 'laranja'], aguardando_correcao: ['Aguardando correção', 'laranja'], corrigida: ['Corrigida', 'verde'], anulada: ['Anulada', 'vermelho'],
};
export function etiqueta(status, rotulo) {
  const [r, c] = STATUS[status] || [status, ''];
  return `<span class="etiqueta${c ? ` etiqueta--${c}` : ''}">${esc(rotulo || r)}</span>`;
}
export const ORIGENS = { manual: 'Manual', missao: 'Missão', dinamica: 'Dinâmica', prova: 'Prova', presenca: 'Presença', ajuste: 'Ajuste' };
 
export const vazio = (msg) => `<div class="vazio">${msg}</div>`;
export const carregando = () => '<div class="carregando">Carregando…</div>';
export const aviso = (msg, erro = false) => `<div class="aviso${erro ? ' aviso--erro' : ''}">${msg}</div>`;
 
export function opcoes(lista, selecionado, rotuloVazio) {
  const vazioHtml = rotuloVazio !== undefined ? `<option value="">${esc(rotuloVazio)}</option>` : '';
  return vazioHtml + lista.map(([v, r]) => `<option value="${esc(v)}"${String(v) === String(selecionado ?? '') ? ' selected' : ''}>${esc(r)}</option>`).join('');
}
export const opcoesTribos = (sel, rotuloVazio) => opcoes(estado.tribos.map((t) => [t.id, t.nome]), sel, rotuloVazio);
export const opcoesCategorias = (sel, rotuloVazio = 'Sem categoria') => opcoes(
  estado.categorias.filter((c) => c.ativa || String(c.id) === String(sel)).map((c) => [c.id, c.nome]), sel, rotuloVazio,
);
export const checksTribos = (selecionadas = []) => `<div class="tribos-grade">${estado.tribos.map((t) => `
  <label class="check" style="margin:0"><input type="checkbox" name="tribos" data-lista value="${t.id}"${selecionadas.includes(t.id) ? ' checked' : ''}> ${esc(t.nome)}</label>`).join('')}</div>`;
 
const delegados = new WeakMap();
 
/** Delegação de eventos; registrar de novo na mesma raiz substitui o handler (views que se re-renderizam). */
export function on(raiz, evento, seletor, fn) {
  let mapa = delegados.get(raiz);
  if (!mapa) {
    mapa = new Map();
    delegados.set(raiz, mapa);
  }
  const chave = `${evento}|${seletor}`;
  if (mapa.has(chave)) {
    mapa.get(chave).fn = fn;
    return;
  }
  const registro = { fn };
  mapa.set(chave, registro);
  raiz.addEventListener(evento, (e) => {
    const alvo = e.target.closest(seletor);
    if (alvo && raiz.contains(alvo)) registro.fn(alvo, e);
  });
}
 
export function modal({ titulo, html, aoAbrir, aoFechar }) {
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="modal__topo"><h2>${esc(titulo)}</h2><button type="button" class="modal__fechar" aria-label="Fechar">&times;</button></div>
    <div class="modal__corpo">${html}</div></div>`;
  const teclas = (e) => { if (e.key === 'Escape') fechar(); };
  function fechar() {
    if (!fundo.isConnected) return;
    fundo.remove();
    document.removeEventListener('keydown', teclas);
    aoFechar?.();
  }
  fundo.querySelector('.modal__fechar').addEventListener('click', fechar);
  fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(); });
  document.addEventListener('keydown', teclas);
  document.body.append(fundo);
  const corpo = fundo.querySelector('.modal__corpo');
  aoAbrir?.(corpo, fechar);
  return { el: corpo, fechar };
}
 
export const fecharModais = () => document.querySelectorAll('.modal-fundo').forEach((m) => m.remove());
 
export function confirmar({ titulo = 'Confirmar', mensagem = '', botao = 'Confirmar', perigo = false, motivo = false, rotuloMotivo = 'Motivo' } = {}) {
  return new Promise((resolve) => {
    let resposta = null;
    modal({
      titulo,
      html: `<form><div class="pilha" style="margin-bottom:1rem">${mensagem}</div>
        ${motivo ? `<label class="campo"><span>${esc(rotuloMotivo)} *</span><input name="motivo" required maxlength="300" autocomplete="off"></label>` : ''}
        <div class="botoes"><button type="button" class="btn" data-nao>Voltar</button>
        <button type="submit" class="btn ${perigo ? 'btn--perigo' : 'btn--primario'}">${esc(botao)}</button></div></form>`,
      aoAbrir: (el, fechar) => {
        el.querySelector('[data-nao]').addEventListener('click', fechar);
        el.querySelector('form').addEventListener('submit', (e) => {
          e.preventDefault();
          resposta = { motivo: el.querySelector('[name=motivo]')?.value.trim() };
          fechar();
        });
      },
      aoFechar: () => resolve(resposta),
    });
  });
}
 
export function lerForm(form) {
  const dados = {};
  for (const c of form.elements) {
    if (!c.name || c.disabled) continue;
    if (c.type === 'checkbox') {
      if (c.dataset.lista !== undefined) {
        dados[c.name] ||= [];
        if (c.checked) dados[c.name].push(Number(c.value));
      } else dados[c.name] = c.checked;
    } else if (c.type === 'radio') {
      if (c.checked) dados[c.name] = c.value;
    } else if (c.dataset.tipo === 'datahora') {
      dados[c.name] = deLocalInput(c.value);
    } else if (c.dataset.tipo === 'minutos') {
      dados[c.name] = c.value === '' ? '' : Math.round(Number(c.value) * 60);
    } else {
      dados[c.name] = typeof c.value === 'string' ? c.value.trim() : c.value;
    }
  }
  return dados;
}
 
export function tratarErro(err, form) {
  if (!err.status) console.error(err);
  toast(err.message || 'Erro inesperado.', 'erro');
  if (form && err.detalhes && typeof err.detalhes === 'object') {
    for (const [campo, msg] of Object.entries(err.detalhes)) {
      const c = form.querySelector(`[name="${campo}"]`);
      if (c) {
        const d = document.createElement('div');
        d.className = 'erro-campo';
        d.textContent = msg;
        (c.closest('.campo') || c).append(d);
      }
    }
  }
}
 
export function aoEnviar(form, fn) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    form.querySelectorAll('.erro-campo').forEach((x) => x.remove());
    if (btn) btn.disabled = true;
    try {
      await fn(lerForm(form), form);
    } catch (err) {
      tratarErro(err, form);
    } finally {
      if (btn && btn.isConnected) btn.disabled = false;
    }
  });
}
 
/** Executa uma ação de botão com tratamento de erro e bloqueio de clique duplo. */
export async function acao(btn, fn) {
  if (btn) btn.disabled = true;
  try {
    return await fn();
  } catch (err) {
    tratarErro(err);
    return undefined;
  } finally {
    if (btn && btn.isConnected) btn.disabled = false;
  }
}
 
const graficos = [];
export async function grafico(canvas, config) {
  if (!canvas) return null;
  if (!window.Chart) await new Promise((r) => window.addEventListener('load', r, { once: true }));
  if (!canvas.isConnected || !window.Chart) return null;
  const c = new window.Chart(canvas, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
      ...config.options,
    },
  });
  graficos.push(c);
  return c;
}
export function limparGraficos() {
  while (graficos.length) graficos.pop().destroy();
}
 
export function itemRanking(t, max) {
  const pct = max > 0 ? Math.max(2, Math.round((Math.max(0, t.pontos) / max) * 100)) : 0;
  const lideres = [t.cabeca_nome, t.auxiliar_nome].filter(Boolean).join(' · ');
  return `<a class="ranking__item ranking__item--${t.posicao}" style="--cor:${esc(t.cor)}" href="#/tribos/${t.rally_tribo_id}">
    <span class="ranking__pos">${t.posicao}º</span>
    <div class="cresce"><div class="ranking__nome">${esc(t.tribo)}</div>
      ${lideres ? `<div class="suave pequeno">${esc(lideres)}</div>` : ''}
      <div class="ranking__barra"><i style="width:${pct}%"></i></div></div>
    <span class="ranking__pontos">${fmtPontos(t.pontos)}</span></a>`;
}
 
export function semRally() {
  return ehAdmin()
    ? `${aviso('Nenhum rally cadastrado ainda. Crie o primeiro rally para começar.')}<a class="btn btn--primario btn--bloco" href="#/rallies">Criar rally</a>`
    : vazio('Nenhum rally disponível no momento.');
}
 
export function debounce(fn, ms = 300) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
