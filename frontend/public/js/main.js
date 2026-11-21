import { iniciarTema } from './tema.js';
import { marca } from './marca.js';
import { icone } from './icones.js';
import { api } from './api.js';
import { estado, carregarSessao, ehAdmin, definirRally, somenteLeitura } from './estado.js';
import { esc, modal, carregando, aviso, limparGraficos, fecharModais, fmtData, etiqueta, on, acao } from './ui.js';
 
const ROTAS = [
  ['/login', 'login', { publica: true }],
  ['/cadastro', 'login', { publica: true }],
  ['/cadastros', 'cadastros', { admin: true }],
  ['/', 'inicio'],
  ['/ranking', 'ranking', { admin: true }],
  ['/lancar', 'lancar', { admin: true }],
  ['/lancamentos', 'lancamentos', { admin: true }],
  ['/tribos', 'tribos'],
  ['/tribos/:id', 'tribo', { voltar: true }],
  ['/pessoas', 'pessoas', { admin: true }],
  ['/pessoas/:id', 'pessoa', { admin: true, voltar: true }],
  ['/missoes', 'missoes'],
  ['/missoes/:id', 'missao', { voltar: true }],
  ['/almas', 'almas'],
  ['/rallies', 'rallies', { admin: true }],
  ['/categorias', 'categorias', { admin: true }],
  ['/mais', 'mais'],
  ['/senha', 'senha', { voltar: true }],
  ['/notificacoes', 'notificacoes'],
  ['/google-vinculos', 'google-vinculos', { admin: true }],
].map(([padrao, vista, opcoes = {}]) => ({
  vista,
  ...opcoes,
  regex: new RegExp(`^${padrao.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
}));
 
const NAV_ADMIN = [['/', '🏠', 'Painel'], ['/ranking', '🏆', 'Ranking'], ['/lancar', '+', 'Lançar', true], ['/tribos', '🛡️', 'Tribos'], ['/mais', '☰', 'Mais']];
const NAV_MEMBRO = [['/', '🏠', 'Início'], ['/almas', '📒', 'Almas'], ['/missoes', '🎯', 'Missões'], ['/tribos', '🛡️', 'Tribos'], ['/mais', '☰', 'Mais']];
 
const app = document.getElementById('app');
const topo = document.getElementById('topo');
const nav = document.getElementById('nav');
const lateral = document.getElementById('lateral');
let execucao = 0;
 
function atualizarLayout(rota, caminho) {
  const publica = Boolean(rota.publica);
  document.body.dataset.sessao = publica ? 'publica' : 'privada';
  topo.hidden = publica;
  lateral.hidden = publica;
  nav.hidden = publica;
  app.className = publica ? '' : 'conteudo';
  if (!publica) void atualizarNotificacoes();
  if (publica) { lateral.replaceChildren(); return; }
  const r = estado.rally;
  document.getElementById('topo-rally').textContent = r ? `${r.nome}${r.status === 'encerrado' ? ' (encerrado)' : ''}` : 'Nenhum rally';
  document.getElementById('btn-voltar').hidden = !rota.voltar;
  const itens = ehAdmin() ? NAV_ADMIN : NAV_MEMBRO.filter(([href]) => href !== '/almas' || ['cabeca', 'auxiliar'].includes(estado.ctx?.funcao));
  const raiz = `/${caminho.split('/')[1] || ''}`;
  const sidebarItens = ehAdmin() ? [['/', '🏠', 'Início'], ['/rallies', '🏁', 'Rallies'], ['/tribos', '🛡️', 'Tribos'], ['/pessoas', '👥', 'Participantes'], ['/ranking', '🏆', 'Ranking'], ['/almas', '📒', 'Relatório de almas'], ['/missoes', '🎯', 'Missões'], ['/lancar', '+', 'Lançar pontos'], ['/notificacoes', '🔔', 'Notificações'], ['/cadastros', '👥', 'Validar cadastros'], ['/google-vinculos', '🔑', 'Contas Google'], ['/mais', '☰', 'Mais opções']] : [['/', '🏠', 'Início'], ['/tribos', '🛡️', 'Tribos'], ...(['cabeca', 'auxiliar'].includes(estado.ctx?.funcao) ? [['/almas', '📒', 'Relatório de almas']] : []), ['/missoes', '🎯', 'Missões'], ['/notificacoes', '🔔', 'Notificações'], ['/mais', '☰', 'Mais opções']];
  lateral.innerHTML = `<a class="lateral__marca" href="#/">${marca()}</a><div class="lateral__legenda">UNIDOS POR UM SÓ PROPÓSITO</div><div class="lateral__grupo">${ehAdmin() ? 'ADMINISTRAÇÃO' : 'MINHA JORNADA'}</div><nav class="lateral__links">${sidebarItens.map(([href, ico, rotulo]) => `<a href="#${href}"${raiz === href ? ' class="ativo" aria-current="page"' : ''}>${icone(ico)}<span>${rotulo}</span></a>`).join('')}</nav><div class="lateral__rodape"><span class="usuario-inicial">${esc(estado.usuario.nome.slice(0, 1))}</span><div><b>${esc(estado.usuario.nome)}</b><small>${ehAdmin() ? 'Administrador' : {cabeca:'Cabeça de tribo',auxiliar:'Auxiliar',participante:'Participante'}[estado.ctx?.funcao] || 'Membro'}</small></div><button type="button" id="lateral-sair" aria-label="Sair da conta">${icone('🚪')}</button></div>`;
  lateral.querySelector('#lateral-sair').addEventListener('click', sair);
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
  app.dataset.view = vista;
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
    if (!rota.publica) await mostrarNovidades();
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
  novidadesUsuario=null;
  location.hash = '#/login';
}
 
document.getElementById('btn-voltar').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else location.hash = '#/';
});
document.getElementById('btn-rally').addEventListener('click', escolherRally);
window.addEventListener('hashchange', renderizar);
window.addEventListener('rally:recarregar', renderizar);
iniciarTema();
renderizar();

async function atualizarNotificacoes() {
  if(!estado.usuario || document.hidden) return;
  try {
    const dados=await api('GET','/notificacoes/contagem');
    const badge=document.getElementById('notificacoes-contagem');
    if(badge) { badge.textContent=dados.nao_lidas>99?'99+':String(dados.nao_lidas||'');badge.hidden=!dados.nao_lidas; }
  } catch { /* O conteúdo principal permanece disponível em falha transitória. */ }
}
setInterval(atualizarNotificacoes,60000);
window.addEventListener('rally:notificacoes',atualizarNotificacoes);

let novidadesUsuario=null;
async function mostrarNovidades(){
 if(!estado.usuario||novidadesUsuario===estado.usuario.id)return;
 const user=estado.usuario.id;
 try{
  const dados=await api('GET','/notificacoes?nao_lidas=true');
  if(estado.usuario?.id!==user)return;
  novidadesUsuario=user;
  if(!dados.itens.length)return;
  modal({titulo:'Novidades para você',aoFechar:()=>{void Promise.all(dados.itens.map(n=>api('POST',`/notificacoes/${n.id}/ler`))).then(atualizarNotificacoes).catch(()=>{});},html:`<div class="novidades-login">${dados.itens.map(n=>`<article class="cartao"><h3>${esc(n.titulo)}</h3><p style="white-space:pre-line">${esc(n.mensagem)}</p></article>`).join('')}</div><div class="botoes"><button class="btn" data-continuar>Continuar</button><a class="btn btn--primario" href="#/notificacoes">Ver notificações</a></div>`,aoAbrir:(el,fechar)=>{el.querySelector('[data-continuar]').addEventListener('click',fechar);el.querySelector('a').addEventListener('click',fechar);}});
 }catch{/* Volta a tentar no próximo acesso; avisos não são marcados automaticamente. */}
}
