'use strict';
const { AuthService, authError } = require('./authService');
const { ScoreService } = require('./scoreService');
function id(value) {
 const result=typeof value==='number'?value:(typeof value==='string'&&/^[1-9]\d*$/.test(value)?Number(value):NaN);
 if(!Number.isSafeInteger(result)||result<=0)throw authError(400,'Identificador invalido.');return result;
}
function body(value,keys) {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw authError(400,'Campos invalidos.');
 return value;
}
function text(value,max=500,optional=false) {
 if(optional&&(value===undefined||value===null||value===''))return null;
 if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw authError(400,'Texto obrigatorio ou acima do limite.');
 return value.trim();
}
function integer(value,min,max) {if(!Number.isSafeInteger(value)||value<min||value>max)throw authError(400,'Numero inteiro fora do limite.');return value;}
function instant(value) {
 if(typeof value!=='string'||value.length>40||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw authError(400,'Informe data e hora com fuso horario.');
 const date=new Date(value.slice(0,10)+'T00:00:00Z'),parsed=Date.parse(value);
 if(!Number.isFinite(parsed)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value.slice(0,10)||Number(value.slice(11,13))>23||Number(value.slice(14,16))>59)throw authError(400,'Data ou hora invalida.');
 return parsed;
}
function windowInput(input){const start=instant(input.abre_em),end=instant(input.encerra_em);if(end<=start)throw authError(400,'Encerramento deve ser posterior a abertura.');return {start,end};}
class ActivitySupport {
 constructor(db,{now=()=>Date.now()}={}){this.db=db;this.now=now;this.auth=new AuthService(db);this.scores=new ScoreService(db);}
 async actor(actorId){const actor=await this.db.get('SELECT id,tipo_usuario FROM usuarios WHERE id=? AND status=? AND aprovacao=?',[id(actorId),'ativo','aprovado']);if(!actor)throw authError(403,'Conta indisponivel.');return actor;}
 async admin(actorId){return this.auth.assertAdmin(actorId);}
 async rally(rallyId,write=false,active=false){const row=await this.db.get('SELECT id,nome,status,legado FROM rallies WHERE id=?',[id(rallyId)]);if(!row)throw authError(404,'Edicao nao encontrada.');if(write&&(row.legado||!(active?['ativo']:['planejamento','ativo']).includes(row.status)))throw authError(409,'Edicao indisponivel para esta operacao.');return row;}
 async member(actorId,rallyId,tribeId=null){const row=await this.db.get(`SELECT mt.id AS membro_id,mt.participante_id,mt.tribo_id,mt.papel FROM membros_tribo mt JOIN participantes p ON p.id=mt.participante_id JOIN tribos t ON t.id=mt.tribo_id WHERE p.usuario_id=? AND p.status='ativo' AND mt.ativo=1 AND t.rally_id=? AND (? IS NULL OR t.id=?)`,[actorId,rallyId,tribeId,tribeId]);if(!row)throw authError(403,'Sem vinculo ativo com esta tribo e edicao.');return row;}
 async targets(rallyId,ids){if(!Array.isArray(ids)||!ids.length||ids.length>2||new Set(ids).size!==ids.length)throw authError(400,'Selecione as tribos destinatarias.');for(const value of ids){integer(value,1,Number.MAX_SAFE_INTEGER);if(!await this.db.get('SELECT id FROM tribos WHERE id=? AND rally_id=?',[value,rallyId]))throw authError(404,'Tribo fora desta edicao.');}return ids;}
 openWindow(row){if(!Number.isFinite(row.abre_em)||!Number.isFinite(row.encerra_em)||this.now()<row.abre_em||this.now()>=row.encerra_em)throw authError(409,'Atividade fora do periodo de disponibilidade.');}
 async audit(actorId,rallyId,event,detail){await this.db.run('INSERT INTO activity_audit(actor_id,rally_id,event,detail,created_at) VALUES(?,?,?,?,?)',[actorId,rallyId,event,JSON.stringify(detail),this.now()]);}
 async editions(actorId){return this.db.transaction(async()=>{const actor=await this.actor(actorId);if(actor.tipo_usuario==='admin')return this.db.all('SELECT id,nome,status,legado FROM rallies ORDER BY id DESC');return this.db.all(`SELECT DISTINCT r.id,r.nome,r.status,r.legado FROM rallies r JOIN tribos t ON t.rally_id=r.id JOIN membros_tribo mt ON mt.tribo_id=t.id JOIN participantes p ON p.id=mt.participante_id WHERE p.usuario_id=? AND p.status='ativo' AND mt.ativo=1 ORDER BY r.id DESC`,[actorId]);});}
 async accounts(actorId){return this.db.transaction(async()=>{await this.admin(actorId);return {pessoas:await this.db.all('SELECT id,nome_completo,nome_apelido,usuario_id FROM participantes ORDER BY nome_completo'),contas:await this.db.all("SELECT id,nome_completo,email,tipo_usuario FROM usuarios WHERE tipo_usuario<>'admin' AND status='ativo' AND aprovacao='aprovado' ORDER BY nome_completo")};});}
 async linkAccount(actorId,input){return this.db.transaction(async()=>{await this.admin(actorId);body(input,['participante_id','usuario_id','motivo']);integer(input.participante_id,1,Number.MAX_SAFE_INTEGER);integer(input.usuario_id,1,Number.MAX_SAFE_INTEGER);const reason=text(input.motivo);const person=await this.db.get('SELECT usuario_id FROM participantes WHERE id=? AND status=?',[input.participante_id,'ativo']);if(!person)throw authError(404,'Pessoa nao encontrada.');if(person.usuario_id!==null||await this.db.get('SELECT id FROM participantes WHERE usuario_id=?',[input.usuario_id]))throw authError(409,'Pessoa ou conta ja associada. Nao ha reassociacao automatica.');const user=await this.actor(input.usuario_id);if(user.tipo_usuario==='admin')throw authError(400,'Associe uma conta de integrante.');await this.db.run('UPDATE participantes SET usuario_id=? WHERE id=?',[input.usuario_id,input.participante_id]);await this.audit(actorId,null,'account_linked',{participante_id:input.participante_id,usuario_id:input.usuario_id,motivo:reason});return {vinculado:true};});}
}
module.exports={ActivitySupport,id,body,text,integer,instant,windowInput};
