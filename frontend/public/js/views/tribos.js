import { api } from '../api.js';
import { rid, estado, ehAdmin } from '../estado.js';
import { esc, fmtPontos, definirTitulo, semRally, vazio } from '../ui.js';
import { emblema } from '../emblemas.js';
export default async function tribos(el) {
  definirTitulo('Tribos');
  if (!rid()) { el.innerHTML = semRally(); return; }
  const lista = await api('GET', `/rallies/${rid()}/tribos`); const minha = estado.ctx?.rallyTriboId;
  el.innerHTML = `<div class="pagina-cabecalho"><div><div class="sobretitulo">UMA SÓ FAMÍLIA</div><h1>Tribos participantes</h1><p>Conheça as ${lista.length} tribos que fazem parte deste rally.</p></div><span class="etiqueta etiqueta--azul">${lista.length} tribos</span></div>
    <label class="busca-tribos campo"><span class="sr-only">Buscar tribo</span><input id="busca-tribo" type="search" placeholder="Buscar tribo…" autocomplete="off"></label><div id="lista-tribos" class="tribos-catalogo"></div>`;
  const desenhar = (valor = '') => {
    const termo = valor.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const filtradas = lista.filter((t) => t.nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(termo));
    el.querySelector('#lista-tribos').innerHTML = filtradas.length ? filtradas.map((t) => `<a class="tribo-card" style="--cor:${esc(t.cor)}" href="#/tribos/${t.id}">${emblema(t, 'emblema--catalogo')}<h2>${esc(t.nome)}</h2>${t.id === minha ? '<span class="etiqueta etiqueta--azul">Sua tribo</span>' : ''}<p>${t.participantes} participante(s)</p><div class="tribo-card__lider">${esc(t.cabeca_nome || 'Cabeça a definir')}</div>${ehAdmin() ? `<div class="tribo-card__pontos"><b>${fmtPontos(t.pontos)}</b><span>pontos · ${t.posicao}º lugar</span></div>` : ''}<span class="tribo-card__link">Conhecer a tribo <span aria-hidden="true">↗</span></span></a>`).join('') : vazio('Nenhuma tribo encontrada.');
  };
  desenhar();el.querySelector('#busca-tribo').addEventListener('input', (e) => desenhar(e.target.value));
}
