import { icone } from './icones.js';
import { api } from './api.js';
import { estado, carregarSessao, ehAdmin, definirRally, somenteLeitura } from './estado.js';
import { esc, modal, carregando, aviso, limparGraficos, fecharModais, fmtData, etiqueta, on, acao } from './ui.js';
 
const ROTAS = [
  ['/login', 'login', { publica: true }],
  ['/', 'inicio'],
  ['/ranking', 'ranking'],
  ['/lancar', 'lancar', { admin: true }],
  ['/lancamentos', 'lancamentos', { admin: true }],
  ['/tribos', 'tribos'],
  ['/tribos/:id', 'tribo', { voltar: true }],
  ['/pessoas', 'pessoas', { admin: true }],
  ['/pessoas/:id', 'pessoa', { admin: true, voltar: true }],
  ['/missoes', 'missoes'],
  ['/missoes/:id', 'missao', { voltar: true }],
  ['/dinamicas', 'dinamicas'],
  ['/provas', 'provas'],
  ['/provas/:id', 'prova', { admin: true, voltar: true }],
  ['/responder/:id', 'responder', { voltar: true }],
  ['/tentativas/:id', 'tentativa', { voltar: true }],
  ['/rallies', 'rallies', { admin: true }],
  ['/categorias', 'categorias', { admin: true }],
  ['/mais', 'mais'],
  ['/senha', 'senha', { voltar: true }],
].map(([padrao, vista, opcoes = {}]) => ({
  vista,
  ...opcoes,
  regex: new RegExp(`^${padrao.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
}));
 
const NAV_ADMIN = [['/', '🏠', 'Painel'], ['/ranking', '🏆', 'Ranking'], ['/lancar', '+', 'Lançar', true], ['/tribos', '🛡️', 'Tribos'], ['/mais', '☰', 'Mais']];
const NAV_MEMBRO = [['/', '🏠', 'Início'], ['/ranking', '🏆', 'Ranking'], ['/missoes', '🎯', 'Missões'], ['/provas', '📝', 'Provas'], ['/mais', '☰', 'Mais']];
 
const app = document.getElementById('app');
const topo = document.getElementById('topo');
const nav = document.getElementById('nav');
let execucao = 0;
 
function atualizarLayout(rota, caminho) {
  const publica = Boolean(rota.publica);
  topo.hidden = publica;
  nav.hidden = publica;
  app.className = publica ? '' : 'conteudo';
  if (publica) return;
  const r = estado.rally;
  document.getElementById('topo-rally').textContent = r ? `${r.nome}${r.status === 'encerrado' ? ' (encerrado)' : ''}` : 'Nenhum rally';
  document.getElementById('btn-voltar').hidden = !rota.voltar;
  const itens = ehAdmin() ? NAV_ADMIN : NAV_MEMBRO;
  const raiz = `/${caminho.split('/')[1] || ''}`;
  nav.innerHTML = itens.map(([href, ico, rotulo, destaque]) => `
    <a href="#${href}" class="${raiz === href ? 'ativo' : ''}${destaque ? ' destaque' : ''}"><span class="ico">${icone(ico)}</span>${esc(rotulo)}</a>`).join('');
}
 
async function renderizar() {
  const id = ++execucao;
  const hash = location.hash.slice(1) || '/';
  const [caminho, qs] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
 
  let rota = ROTAS.find((r) => r.regex.test(caminho)) || ROTAS.find((r) => r.vista === 'inicio');
  if (!rota.publica && !estado.usuario) {
    app.innerHTML = carregando();
    if (!(await carregarSessao())) {
      location.replace('#/login');
      return;
    }
    if (id !== execucao) return;
  }
  if (rota.publica && estado.usuario) {
    location.replace('#/');
    return;
  }
  if (rota.admin && !ehAdmin()) {
    location.replace('#/');
    return;
  }
  let vista = rota.vista;
  if (vista === 'inicio' && ehAdmin()) vista = 'painel';
  const params = caminho.match(rota.regex)?.groups || {};
 
  fecharModais();
  limparGraficos();
  atualizarLayout(rota, caminho);
  window.scrollTo(0, 0);
 
  const container = document.createElement('div');
  app.replaceChildren();
  if (!rota.publica && somenteLeitura()) {
    app.insertAdjacentHTML('beforeend', aviso('Este rally está <b>encerrado</b>: os dados ficam guardados, mas não podem ser alterados.'));
  }
  container.innerHTML = carregando();
  app.append(container);
  try {
    const mod = await import(`./views/${vista}.js`);
    if (id !== execucao) return;
    await mod.default(container, params, query);
  } catch (err) {
    if (id !== execucao) return;
    console.error(err);
    container.innerHTML = aviso(esc(err.message || 'Não foi possível carregar esta tela.'), true);
  }
}
 
function escolherRally() {
  const lista = estado.rallies.map((r) => `
    <li class="item item--link" data-rally="${r.id}">
      <div class="cresce"><b>${esc(r.nome)}</b><div class="suave">${fmtData(r.data_inicio)} a ${fmtData(r.data_fim)}</div></div>
      ${etiqueta(r.status)}${estado.rally?.id === r.id ? ' ✓' : ''}</li>`).join('');
  modal({
    titulo: 'Escolher rally',
    html: `${lista ? `<ul class="lista">${lista}</ul>` : '<p class="suave">Nenhum rally cadastrado.</p>'}
      ${ehAdmin() ? '<a class="btn btn--bloco" href="#/rallies" style="margin-top:.8rem">Gerenciar rallies</a>' : ''}`,
    aoAbrir: (el, fechar) => {
      on(el, 'click', '[data-rally]', (li) => acao(null, async () => {
        await definirRally(Number(li.dataset.rally));
        fechar();
        renderizar();
      }));
      el.querySelector('a')?.addEventListener('click', fechar);
    },
  });
}
 
export async function sair() {
  await api('POST', '/auth/logout').catch(() => {});
  estado.usuario = null;
  location.hash = '#/login';
}
 
document.getElementById('btn-voltar').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else location.hash = '#/';
});
document.getElementById('btn-rally').addEventListener('click', escolherRally);
window.addEventListener('hashchange', renderizar);
window.addEventListener('rally:recarregar', renderizar);
renderizar();
