import {api} from '../api.js';
import {definirTitulo,esc,vazio,confirmar,acao,toast,on} from '../ui.js';
export default async function googleVinculos(el){
 definirTitulo('Contas Google');
 const {vinculos,contas}=await api('GET','/google-vinculos');
 el.innerHTML=`<div class="pagina-cabecalho"><div><h1>Contas Google</h1><p>Confira a pessoa e o e-mail Google antes de vincular a uma conta já cadastrada.</p></div></div>${vinculos.length?vinculos.map(g=>`<section class="cartao" data-google="${g.id}"><div class="linha"><div class="cresce"><b>${esc(g.nome||g.email)}</b><p>${esc(g.email)}</p><span class="suave">${esc({pendente:'Aguardando aprovação',aprovado:'Vínculo aprovado',rejeitado:'Solicitação rejeitada'}[g.status]||g.status)}</span></div></div>${['pendente','rejeitado'].includes(g.status)?`<label class="campo"><span>Vincular à conta existente</span><select name="usuario_id"><option value="">Selecione a pessoa</option>${contas.map(c=>`<option value="${c.id}">${esc(c.nome_completo)} — ${esc(c.email)}${c.papel==='admin'?' (administrador)':''}</option>`).join('')}</select></label><label class="campo" data-step-up style="display:none"><span>Sua senha atual de administrador</span><input type="password" name="senha_admin_atual" autocomplete="current-password"><small>Exigida para vincular uma conta administrativa. Use sua própria senha, não a de outra pessoa.</small></label><div class="botoes"><button type="button" class="btn btn--primario" data-aprovar>Aprovar vínculo</button>${g.status==='pendente'?'<button type="button" class="btn" data-rejeitar>Rejeitar</button>':''}</div>`:g.status==='aprovado'?`<p>Conta vinculada: <b>${esc(g.pessoa_nome)}</b> · ${esc(g.conta_email)}</p><button type="button" class="btn" data-desvincular>Desvincular Google</button>`:'<p class="suave">A pessoa deve procurar a coordenação para reavaliar o acesso.</p>'}</section>`).join(''):vazio('Nenhuma solicitação Google recebida.')}`;
 on(el,'change','[name=usuario_id]',select=>{const card=select.closest('[data-google]');const target=contas.find(c=>c.id===Number(select.value));card.querySelector('[data-step-up]').style.display=target?.papel==='admin'?'grid':'none';card.querySelector('[name=senha_admin_atual]').value='';});
 on(el,'click','[data-aprovar]',btn=>acao(btn,async()=>{
  const card=btn.closest('[data-google]');const usuario_id=Number(card.querySelector('[name=usuario_id]').value);
  if(!usuario_id)throw new Error('Selecione a conta existente da pessoa.');
  if(!await confirmar({titulo:'Aprovar conta Google',mensagem:'Confirme a identidade da pessoa antes de autorizar. O vínculo permitirá entrar na conta selecionada com este Google.',botao:'Aprovar vínculo'}))return;
  await api('POST',`/google-vinculos/${card.dataset.google}/aprovar`,{usuario_id,senha_admin_atual:card.querySelector('[name=senha_admin_atual]').value});toast('Vínculo aprovado.');await googleVinculos(el);
 }));
 for(const [attr,acaoNome,texto]of [['rejeitar','rejeitar','Rejeitar solicitação'],['desvincular','desvincular','Desvincular conta Google']])on(el,'click',`[data-${attr}]`,btn=>acao(btn,async()=>{
  if(!await confirmar({titulo:texto,mensagem:attr==='desvincular'?'O acesso Google será interrompido e as sessões dessa conta serão encerradas. O acesso por senha permanece disponível.':'A conta Google não poderá acessar o sistema.',botao:texto,perigo:true}))return;
  await api('POST',`/google-vinculos/${btn.closest('[data-google]').dataset.google}/${acaoNome}`,{});toast('Solicitação atualizada.');await googleVinculos(el);
 }));
}
