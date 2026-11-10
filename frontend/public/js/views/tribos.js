import { api } from '../api.js';
import { rid, estado, ehAdmin } from '../estado.js';
import { esc, fmtPontos, definirTitulo, semRally } from '../ui.js';
 
export default async function tribos(el) {
  definirTitulo('Tribos');
  if (!rid()) {
    el.innerHTML = semRally();
    return;
  }
  const lista = await api('GET', `/rallies/${rid()}/tribos`);
  const minha = estado.ctx?.rallyTriboId;
  el.innerHTML = lista.map((t) => `
    <a class="ranking__item" style="--cor:${esc(t.cor)}" href="#/tribos/${t.id}">
      <div class="cresce"><div class="ranking__nome">${esc(t.nome)}${t.id === minha ? ' <span class="etiqueta etiqueta--azul">sua tribo</span>' : ''}</div>
        <div class="suave pequeno">Cabeça: ${esc(t.cabeca_nome || '—')} · Auxiliar: ${esc(t.auxiliar_nome || '—')}</div>
        <div class="suave pequeno">${t.participantes} participante(s)${ehAdmin() ? ` · ${t.posicao}º lugar` : ''}</div></div>
      ${ehAdmin() ? `<span class="ranking__pontos">${fmtPontos(t.pontos)}</span>` : ''}</a>`).join('');
}
