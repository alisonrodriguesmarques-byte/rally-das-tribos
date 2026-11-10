import { api } from '../api.js';
import { estado, rid, ehLider } from '../estado.js';
import { esc, definirTitulo, vazio, aviso, semRally, fmtData, etiqueta } from '../ui.js';
export default async function inicio(el) {
  definirTitulo('Início');
  if (!rid()) { el.innerHTML = semRally(); return; }
  const minha = estado.ctx?.rallyTriboId;
  const tribo = estado.tribos.find((t) => t.id === minha);
  const missoes = minha ? await api('GET', `/rallies/${rid()}/missoes?status=aberta`) : [];
  const funcao = { cabeca: 'Cabeça', auxiliar: 'Auxiliar', participante: 'Participante' }[estado.ctx?.funcao];
  el.innerHTML = `<h1>Olá, ${esc(estado.usuario.nome.split(' ')[0])}!</h1>
    ${!minha ? aviso('Você ainda não está em nenhuma tribo deste rally. Fale com a coordenação.') : `
    <a class="cartao linha" href="#/tribos/${minha}" style="text-decoration:none;color:inherit;border-left:8px solid ${esc(tribo?.cor)}">
      <div><div class="suave">${esc(funcao)} da tribo</div><h2 style="margin:0">${esc(tribo?.nome)}</h2></div></a>
    ${ehLider() ? `<div class="cartao"><h2>Relatório semanal de almas</h2><p class="suave">Registre as almas novas e afastadas que vieram às reuniões desta semana.</p><a class="btn btn--ouro btn--bloco" href="#/almas">Preencher relatório</a></div>` : ''}
    <div class="secao-titulo"><h2>Missões abertas</h2><a href="#/missoes">Ver todas</a></div>
    <div class="cartao">${missoes.length ? `<ul class="lista">${missoes.slice(0, 4).map((m) => `<li><a class="cresce item--link" href="#/missoes/${m.id}"><b>${esc(m.titulo)}</b><div class="suave">${m.data_limite ? `até ${fmtData(m.data_limite)}` : 'sem prazo'}</div></a>${m.minhas_entregas.length ? etiqueta(m.minhas_entregas[0].status) : ''}</li>`).join('')}</ul>` : vazio('Nenhuma missão aberta agora.')}</div>`}`;
}
