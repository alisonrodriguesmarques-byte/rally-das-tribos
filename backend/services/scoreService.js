'use strict';
const crypto = require('crypto');
const {AuthService, authError} = require('./authService');
const TriboRepository = require('../repositories/triboRepository');
function positive(value) { if(!Number.isSafeInteger(value)||value<=0) throw authError(400,'Identificador invalido.'); return value; }
function text(value) { if(typeof value!=='string'||!value.trim()||value.trim().length>500||/[\u0000-\u001f]/.test(value)) throw authError(400,'Informe uma justificativa de ate 500 caracteres.'); return value.trim(); }
class ScoreService {
 constructor(db){this.db=db;this.auth=new AuthService(db);}
 async edition(id,write=false){const r=await this.db.get('SELECT id,nome,status,legado FROM rallies WHERE id=?',[positive(Number(id))]);if(!r)throw authError(404,'Rally nao encontrado.');if(write&&(r.legado||r.status!=='ativo'))throw authError(409,'Pontos podem ser lancados somente em Rally novo ativo.');return r;}
 async view(actor,id){return this.db.transaction(async()=>{await this.auth.assertAdmin(actor);const rally=await this.edition(id);return {rally,ranking:await new TriboRepository(this.db).getRanking(rally.id),lancamentos:await this.db.all(`SELECT p.id,p.tribo_id,t.nome AS tribo_nome,p.pontos,p.descricao,p.tipo_origem,p.criado_por,u.nome_completo AS responsavel,p.data_registro,p.compensa_id,p.corrige_id,
 EXISTS(SELECT 1 FROM pontuacoes c WHERE c.compensa_id=p.id) AS compensado FROM pontuacoes p JOIN tribos t ON t.id=p.tribo_id LEFT JOIN usuarios u ON u.id=p.criado_por WHERE p.rally_id=? ORDER BY p.id DESC`,[rally.id])};});}
 async entry(actor,rally,tribe,points,description,compensa=null,corrige=null){const v=await this.db.run(`INSERT INTO pontuacoes(rally_id,tribo_id,tipo_origem,descricao,pontos,tipo_pontuacao,criado_por,aprovado_por,data_aprovacao,compensa_id,corrige_id) VALUES(?,?,'manual',?,?,'manual',?,?,CURRENT_TIMESTAMP,?,?)`,[rally,tribe,description,points,actor,actor,compensa,corrige]);await this.db.run(`INSERT INTO historico_pontuacoes(pontuacao_id,tribo_id,pontos_novo,tipo_alteracao,motivo,alterado_por) VALUES(?,?,?,'criacao',?,?)`,[v.id,tribe,points,description,actor]);return v.id;}
 // Called only inside the activity transaction; points come from stored rules/results.
 async awardActivity(actor,kind,resultId) {
  if (!this.db._hasActiveTransactionContext()) throw new Error('Activity award requires its transaction');
  let result;
  if (kind === 'missao') {
   await this.auth.assertAdmin(actor);
   result = await this.db.get(`SELECT d.tribo_id, m.rally_id, m.id AS source_id, m.titulo,
    m.valor_pontuacao AS pontos FROM mission_deliveries d JOIN missoes m ON m.id=d.missao_id WHERE d.id=?`, [positive(resultId)]);
  } else if (kind === 'prova') {
   result = await this.db.get(`SELECT a.tribo_id, p.rally_id, p.id AS source_id, p.titulo, p.tipo_prova,
    COALESCE((SELECT SUM(pontos_obtidos) FROM quiz_respostas WHERE tentativa_id=a.id),0) AS pontos
    FROM exam_attempts a JOIN provas p ON p.id=a.prova_id WHERE a.id=? AND a.actor_id=?`, [positive(resultId),actor]);
  } else throw authError(400,'Origem de atividade invalida.');
  if (!result) throw authError(404,'Resultado da atividade nao encontrado.');
  await this.edition(result.rally_id,true);
  if (!Number.isSafeInteger(result.pontos) || result.pontos<0 || result.pontos>1000000) throw authError(400,'Pontuacao da atividade invalida.');
  const prior=await this.db.get('SELECT score_id FROM activity_awards WHERE kind=? AND entity_id=?',[kind,resultId]);
  if(prior) return {scoreId:prior.score_id,points:result.pontos};
  let scoreId=null;
  if(result.pontos>0) {
   const inserted=await this.db.run(`INSERT INTO pontuacoes
    (rally_id,tribo_id,tipo_origem,descricao,pontos,tipo_pontuacao,criado_por,aprovado_por,data_aprovacao,missao_id,prova_id)
    VALUES (?,?,?,?,?,'fixa',?,?,CURRENT_TIMESTAMP,?,?)`,
    [result.rally_id,result.tribo_id,kind==='missao'?'missao':result.tipo_prova==='quiz'?'quiz':'prova',result.titulo,result.pontos,actor,
     kind==='missao'?actor:null,kind==='missao'?result.source_id:null,kind==='prova'?result.source_id:null]);
   scoreId=inserted.id;
   await this.db.run(`INSERT INTO historico_pontuacoes
    (pontuacao_id,tribo_id,pontos_novo,tipo_alteracao,motivo,alterado_por) VALUES (?,?,?,'criacao',?,?)`,
    [scoreId,result.tribo_id,result.pontos,kind==='missao'?'Entrega aprovada':'Correcao objetiva automatica',actor]);
  }
  await this.db.run('INSERT INTO activity_awards(kind,entity_id,score_id) VALUES(?,?,?)',[kind,resultId,scoreId]);
  return {scoreId,points:result.pontos};
 }
 async mutate(actor,id,input,originalId=null){return this.db.transaction(async()=>{
 await this.auth.assertAdmin(actor);const rally=await this.edition(id,true);
 const allowed=originalId===null?['tribo_id','pontos','justificativa','request_key']:['pontos','justificativa','request_key'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw authError(400,'Campos invalidos.');
 if(!Number.isSafeInteger(input.pontos)||input.pontos<0||input.pontos>1000000||(originalId===null&&input.pontos===0))throw authError(400,'Informe pontos inteiros entre 1 e 1000000; correcao pode zerar.');
 const reason=text(input.justificativa);if(typeof input.request_key!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(input.request_key))throw authError(400,'Chave da operacao invalida.');
 const original=originalId===null?null:positive(Number(originalId));
 const tribe=original===null?positive(input.tribo_id):null;
 const hash=crypto.createHash('sha256').update(JSON.stringify({actor,original,tribe,pontos:input.pontos,reason})).digest('hex');
 const prior=await this.db.get('SELECT * FROM score_requests WHERE rally_id=? AND request_key=?',[rally.id,input.request_key]);
 if(prior){if(prior.payload_hash!==hash)throw authError(409,'Chave ja utilizada com outros dados.');return {id:prior.result_id,repetido:true};}
 let result;
 if(original===null){if(!await this.db.get('SELECT id FROM tribos WHERE id=? AND rally_id=?',[tribe,rally.id]))throw authError(404,'Tribo nao pertence a esta edicao.');result=await this.entry(actor,rally.id,tribe,input.pontos,reason);}
 else {const old=await this.db.get('SELECT * FROM pontuacoes WHERE id=? AND rally_id=?',[original,rally.id]);
 if(!old)throw authError(404,'Lancamento nao encontrado nesta edicao.');
 if(old.tipo_origem!=='manual'||old.compensa_id!==null||old.pontos<=0||!Number.isSafeInteger(old.pontos))throw authError(409,'Este lancamento nao aceita correcao manual.');
 if(await this.db.get('SELECT id FROM pontuacoes WHERE compensa_id=?',[old.id]))throw authError(409,'Lancamento ja compensado.');
 if(old.pontos===input.pontos)throw authError(409,'A pontuacao informada nao mudou.');
 result=await this.entry(actor,rally.id,old.tribo_id,-old.pontos,reason,old.id);
 if(input.pontos>0)result=await this.entry(actor,rally.id,old.tribo_id,input.pontos,reason,null,old.id);
 }
 await this.db.run('INSERT INTO score_requests(rally_id,request_key,payload_hash,result_id) VALUES(?,?,?,?)',[rally.id,input.request_key,hash,result]);return {id:result,repetido:false};
 });}
}
module.exports={ScoreService};
