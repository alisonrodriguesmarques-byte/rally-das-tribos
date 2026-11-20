import {api} from '../api.js';
import {estado,ehAdmin,definirRally} from '../estado.js';
import {definirTitulo,esc,acao,confirmar,toast,vazio} from '../ui.js';
export default async function notificacoes(el){
 definirTitulo('Notificações');
 const [dados,pref]=await Promise.all([api('GET','/notificacoes'),api('GET','/notificacoes/preferencias')]);
 el.innerHTML=`<div class="pagina-cabecalho"><div><h1>Notificações</h1><p>${dados.nao_lidas} não lida(s). Exibindo as 100 mais recentes.</p></div></div>
 <section class="cartao"><h2>Preferências de e-mail</h2><p>Os avisos ficam sempre disponíveis aqui. Você decide se também deseja receber um e-mail para acessar a notificação.</p>
 ${pref.fila?`<p class="suave">Fila de e-mails: ${pref.fila.pendente||0} pendente(s), ${pref.fila.enviado||0} entregue(s) ao provedor, ${pref.fila.falhou||0} com falha. Falhas podem ser temporárias e serão tentadas novamente até o limite.</p>`:''}<form id="preferencias-email"><label class="campo"><span><input type="checkbox" name="email_notificacoes" ${pref.email_notificacoes?'checked':''}> Quero receber avisos por e-mail</span></label>
 <p class="suave">${pref.email_configurado?'O envio por e-mail está habilitado.':'O envio por e-mail ainda depende da configuração do administrador. Sua preferência será salva.'}</p><button class="btn" type="submit">Salvar preferência</button></form></section>
 ${ehAdmin()?`<section class="cartao"><h2>Enviar aviso importante</h2><form id="aviso-importante" class="pilha">
 <label class="campo"><span>Destinatários</span><select name="alvo"><option value="rally">Um rally</option><option value="tribo">Uma tribo de um rally</option><option value="todos">Todas as contas ativas</option></select></label>
 <label class="campo" data-campo-rally><span>Rally</span><select name="rally_id">${estado.rallies.map(r=>`<option value="${r.id}" ${r.id===estado.rally?.id?'selected':''}>${esc(r.nome)}</option>`).join('')}</select></label>
 <label class="campo" data-campo-tribo hidden><span>Tribo</span><select name="rally_tribo_id"></select></label>
 <label class="campo"><span>Título</span><input name="titulo" required maxlength="150" autocomplete="off"></label>
 <label class="campo"><span>Mensagem</span><textarea name="mensagem" required maxlength="3000" rows="5"></textarea></label>
 <p class="suave">O aviso será enviado no sistema. Quem autorizou e-mails poderá receber um aviso para abrir sua conta. Administradores também recebem os avisos direcionados a rally ou tribo.</p><button class="btn btn--primario" type="submit">Revisar aviso</button></form></section>`:''}
 <section class="cartao"><div class="secao-titulo"><h2>Seus avisos</h2><button id="ler-todas" class="btn" ${dados.nao_lidas?'':'disabled'}>Marcar todas como lidas</button></div>
 ${dados.itens.length?`<ul class="lista">${dados.itens.map(n=>`<li><div class="cresce"><b>${n.lido_em?'':'● '}${esc(n.titulo)}</b><p style="white-space:pre-line">${esc(n.mensagem)}</p><small class="suave">${esc(new Date(n.criado_em).toLocaleString('pt-BR'))}${n.lido_em?' · Lida':''}</small><div class="botoes"><a class="btn" href="${esc(n.destino)}" data-abrir="${n.id}">Abrir</a>${n.lido_em?'':`<button class="btn" data-ler="${n.id}">Marcar como lida</button>`}</div></div></li>`).join('')}</ul>`:vazio('Você ainda não recebeu notificações.')}</section>`;
 const atualizar=async()=>{window.dispatchEvent(new Event('rally:notificacoes'));await notificacoes(el);};
 el.querySelector('#preferencias-email').addEventListener('submit',e=>{e.preventDefault();acao(e.submitter,async()=>{await api('PATCH','/notificacoes/preferencias',{email_notificacoes:e.target.email_notificacoes.checked});toast('Preferência salva.');});});
 el.querySelector('#ler-todas').addEventListener('click',e=>acao(e.currentTarget,async()=>{await api('POST','/notificacoes/ler-todas');await atualizar();}));
 el.querySelectorAll('[data-ler]').forEach(b=>b.addEventListener('click',()=>acao(b,async()=>{await api('POST',`/notificacoes/${b.dataset.ler}/ler`);await atualizar();})));
 el.querySelectorAll('[data-abrir]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();acao(null,async()=>{await api('POST',`/notificacoes/${a.dataset.abrir}/ler`);window.dispatchEvent(new Event('rally:notificacoes'));const href=a.getAttribute('href');const rallyId=Number(new URLSearchParams(href.split('?')[1]||'').get('rally_id'));if(rallyId&&estado.rallies.some(r=>r.id===rallyId)&&estado.rally?.id!==rallyId)await definirRally(rallyId);location.hash=href;});}));
 const form=el.querySelector('#aviso-importante');
 if(form){
  const atualizarAlvo=async()=>{
   const alvo=form.elements.alvo.value;
   form.querySelector('[data-campo-rally]').hidden=alvo==='todos';
   form.querySelector('[data-campo-tribo]').hidden=alvo!=='tribo';
   if(alvo==='tribo'&&form.elements.rally_id.value){
    const tribos=await api('GET',`/rallies/${Number(form.elements.rally_id.value)}/tribos`);
    form.elements.rally_tribo_id.innerHTML=tribos.map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('');
   }
  };
  form.elements.alvo.addEventListener('change',()=>acao(null,atualizarAlvo));form.elements.rally_id.addEventListener('change',()=>acao(null,atualizarAlvo));
  form.addEventListener('submit',e=>{e.preventDefault();acao(e.submitter,async()=>{
   const dados=Object.fromEntries(new FormData(form));
   const alvo=dados.alvo==='todos'?'Todas as contas ativas':`${form.elements.rally_id.selectedOptions[0]?.textContent||''}${dados.alvo==='tribo'?' · '+(form.elements.rally_tribo_id.selectedOptions[0]?.textContent||''):''}`;
   if(!await confirmar({titulo:'Confirmar aviso importante',mensagem:`<p><b>Destinatários:</b> ${esc(alvo)}</p><p><b>${esc(dados.titulo)}</b></p><p style="white-space:pre-line">${esc(dados.mensagem)}</p>`,botao:'Enviar aviso'}))return;
   const result=await api('POST','/notificacoes/avisos',dados);toast(`Aviso enviado para ${result.destinatarios} conta(s).`);await atualizar();
  });});
 }
}
