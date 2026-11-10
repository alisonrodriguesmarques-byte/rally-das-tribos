import { icone } from '../icones.js';
import { estado, ehAdmin } from '../estado.js';
import { definirTitulo, esc } from '../ui.js';
import { sair } from '../main.js';
 
export default async function mais(el) {
  definirTitulo('Mais');
  const minha = estado.ctx?.rallyTriboId;
  const itens = ehAdmin()
    ? [
      ['#/lancamentos', '📒', 'Histórico de pontos', 'Editar e cancelar lançamentos'],
      ['#/pessoas', '👥', 'Pessoas', 'Jovens, líderes e acessos'],
      ['#/missoes', '🎯', 'Missões', 'Semanais e aprovações'],
      ['#/dinamicas', '🎲', 'Dinâmicas', 'Encontros das tribos'],
      ['#/provas', '📝', 'Provas e quizzes', 'Questões e correção'],
      ['#/rallies', '🏁', 'Rallies', 'Criar, ativar, encerrar'],
      ['#/categorias', '🏷️', 'Categorias', 'Tipos de pontuação'],
      ['#/senha', '🔑', 'Trocar senha', ''],
    ]
    : [
      ...(minha ? [[`#/tribos/${minha}`, '🛡️', 'Minha tribo', 'Pontos e membros']] : []),
      ['#/tribos', '🏕️', 'Todas as tribos', ''],
      ['#/dinamicas', '🎲', 'Dinâmicas', 'Da minha tribo'],
      ['#/senha', '🔑', 'Trocar senha', ''],
    ];
  el.innerHTML = `<div class="cartao linha"><div class="cresce"><b>${esc(estado.usuario.nome)}</b>
      <div class="suave">${esc(estado.usuario.email)} · ${ehAdmin() ? 'Administrador' : { cabeca: 'Cabeça', auxiliar: 'Auxiliar', participante: 'Participante' }[estado.ctx?.funcao] || 'Membro'}</div></div></div>
    <div class="menu-grade">${itens.map(([href, ico, t, s]) => `<a href="${href}"><span class="ico">${icone(ico)}</span>${esc(t)}${s ? `<small>${esc(s)}</small>` : ''}</a>`).join('')}
      <button type="button" id="sair"><span class="ico">${icone("🚪")}</span>Sair</button></div>`;
  el.querySelector('#sair').addEventListener('click', sair);
}
