import { api } from '../api.js';
import { estado, rid, ehLider } from '../estado.js';
import { esc, fmtPontos, definirTitulo, vazio, aviso, itemRanking, semRally, fmtData, etiqueta } from '../ui.js';
 
export default async function inicio(el) {
  definirTitulo('Início');
  if (!rid()) {
    el.innerHTML = semRally();
    return;
  }
  const minha = estado.ctx?.rallyTriboId;
  const [ranking, missoes, provas] = await Promise.all([
    api('GET', `/rallies/${rid()}/ranking`),
    minha ? api('GET', `/rallies/${rid()}/missoes?status=aberta`) : [],
    minha ? api('GET', `/rallies/${rid()}/provas`) : [],
  ]);
  const max = Math.max(1, ...ranking.map((t) => t.pontos));
  const eu = ranking.find((t) => t.rally_tribo_id === minha);
  const funcao = { cabeca: 'Cabeça', auxiliar: 'Auxiliar', participante: 'Participante' }[estado.ctx?.funcao];
  const disponiveis = provas.filter((p) => p.disponivel);
 
  el.innerHTML = `<h1>Olá, ${esc(estado.usuario.nome.split(' ')[0])}!</h1>
    ${!minha ? aviso('Você ainda não está em nenhuma tribo deste rally. Fale com a coordenação.') : `
    <a class="cartao linha" href="#/tribos/${minha}" style="text-decoration:none;color:inherit;border-left:8px solid ${esc(eu?.cor)}">
      <div class="cresce"><div class="suave">${esc(funcao || '')} da tribo</div><h2 style="margin:0">${esc(eu?.tribo || '')}</h2></div>
      <div class="direita"><div class="pontos" style="font-size:1.4rem">${fmtPontos(eu?.pontos)}</div><div class="suave">${eu?.posicao}º lugar</div></div></a>`}
    ${minha ? `<div class="secao-titulo"><h2>Missões abertas</h2><a href="#/missoes">Ver todas</a></div>
    <div class="cartao">${missoes.length ? `<ul class="lista">${missoes.slice(0, 4).map((m) => `
      <li><a class="cresce item--link" href="#/missoes/${m.id}"><b>${esc(m.titulo)}</b><div class="suave">${m.data_limite ? `até ${fmtData(m.data_limite)}` : 'sem prazo'}</div></a>
      ${m.minhas_entregas.length ? etiqueta(m.minhas_entregas[0].status) : ehLider() ? '<span class="etiqueta etiqueta--azul">Enviar</span>' : ''}</li>`).join('')}</ul>` : vazio('Nenhuma missão aberta agora.')}</div>
    <div class="secao-titulo"><h2>Provas disponíveis</h2><a href="#/provas">Ver todas</a></div>
    <div class="cartao">${disponiveis.length ? `<ul class="lista">${disponiveis.map((p) => `
      <li><div class="cresce"><b>${esc(p.titulo)}</b><div class="suave">${p.total_questoes} questões · ${fmtPontos(p.pontuacao_maxima)} pts</div></div>
      <a class="btn btn--peq btn--primario" href="#/provas">Abrir</a></li>`).join('')}</ul>` : vazio('Nenhuma prova disponível agora.')}</div>` : ''}
    <div class="secao-titulo"><h2>Ranking</h2><a href="#/ranking">Completo</a></div>
    ${ranking.slice(0, 3).map((t) => itemRanking(t, max)).join('')}`;
}
