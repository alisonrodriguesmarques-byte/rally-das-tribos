import {api} from '../api.js';
import {estado,definirRally} from '../estado.js';
import {definirTitulo,esc,acao,vazio} from '../ui.js';
export default async function notificacoes(el){
 definirTitulo('Notificações');
 const dados=await api('GET','/notificacoes');
 el.innerHTML=`<div class="pagina-cabecalho"><div><h1>Notificações</h1><p>Histórico de atualizações do rally. ${dados.nao_lidas} não lida(s).</p></div></div><section class="cartao"><div class="secao-titulo"><h2>Seus avisos</h2><button id="ler-todas" class="btn" ${dados.nao_lidas?'':'disabled'}>Marcar todas como lidas</button></div>${dados.itens.length?`<ul class="lista">${dados.itens.map(n=>`<li><div class="cresce"><b>${n.lido_em?'':'● '}${esc(n.titulo)}</b><p style="white-space:pre-line">${esc(n.mensagem)}</p><small class="suave">${esc(new Date(n.criado_em).toLocaleString('pt-BR'))}${n.lido_em?' · Lida':''}</small><div class="botoes"><a class="btn" href="${esc(n.destino)}" data-abrir="${n.id}">Abrir</a>${n.lido_em?'':`<button class="btn" data-ler="${n.id}">Marcar como lida</button>`}</div></div></li>`).join('')}</ul>`:vazio('Você ainda não recebeu notificações.')}</section>`;
 const atualizar=async()=>{window.dispatchEvent(new Event('rally:notificacoes'));await notificacoes(el);};
 el.querySelector('#ler-todas').addEventListener('click',e=>acao(e.currentTarget,async()=>{await api('POST','/notificacoes/ler-todas');await atualizar();}));
 el.querySelectorAll('[data-ler]').forEach(b=>b.addEventListener('click',()=>acao(b,async()=>{await api('POST',`/notificacoes/${b.dataset.ler}/ler`);await atualizar();})));
 el.querySelectorAll('[data-abrir]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();acao(null,async()=>{await api('POST',`/notificacoes/${a.dataset.abrir}/ler`);window.dispatchEvent(new Event('rally:notificacoes'));const href=a.getAttribute('href');const rallyId=Number(new URLSearchParams(href.split('?')[1]||'').get('rally_id'));if(rallyId&&estado.rallies.some(r=>r.id===rallyId)&&estado.rally?.id!==rallyId)await definirRally(rallyId);location.hash=href;});}));
}
