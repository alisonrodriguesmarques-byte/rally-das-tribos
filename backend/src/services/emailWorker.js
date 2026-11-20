const {randomUUID}=require('node:crypto');
const db=require('../database/connection');
const {agora}=require('../utils/db');
const {usuariosAtivos}=require('./notificacoesService');
function configuracao(){
 if(process.env.NOTIFICATIONS_EMAIL_ENABLED!=='true'||(!process.env.RESEND_API_KEY&&!process.env.SMTP_HOST)||!process.env.MAIL_FROM)return null;
 let origin;
 try{origin=new URL(process.env.APP_URL);if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||origin.protocol!=='https:' && !(process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1'].includes(origin.hostname)))return null;}catch{return null;}
 if(/[\r\n]/.test(process.env.MAIL_FROM)||!process.env.MAIL_FROM.includes('@'))return null;
 if(process.env.RESEND_API_KEY)return {provider:'resend',apiKey:process.env.RESEND_API_KEY,from:process.env.MAIL_FROM,url:origin.origin+'/#/notificacoes'};
 const port=Number(process.env.SMTP_PORT||587);if(!Number.isInteger(port)||port<1||port>65535)return null;
 return {provider:'smtp',from:process.env.MAIL_FROM,url:origin.origin+'/#/notificacoes',smtp:{host:process.env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,
  ...(process.env.SMTP_USER&&process.env.SMTP_PASS?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}:{}),
  connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,tls:{rejectUnauthorized:true}}};
}
function criarTransport(config,fetchImpl=fetch){
 if(config.provider!=='resend')return require('nodemailer').createTransport(config.smtp);
 return {async sendMail(mail){
  const id=mail.messageId.match(/notificacao-(\d+)/)?.[1];
  const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${config.apiKey}`,'Content-Type':'application/json','Idempotency-Key':`rally-notificacao-${id}`},body:JSON.stringify({from:mail.from,to:[mail.to],subject:mail.subject,text:mail.text}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Provedor de e-mail recusou a entrega.');
 }};
}
async function processarFila({transport,config=configuracao(),limite=10,fetchImpl}={}){
 if(!config)return {processadas:0};
 const mailer=transport||criarTransport(config,fetchImpl);
 const now=agora(),expired=new Date(Date.now()-120000).toISOString();let processadas=0;
 const disponiveis=q=>q.where(w=>w.whereIn('status',['pendente','falhou']).where('proxima_em','<=',now).orWhere(x=>x.where('status','enviando').where('lock_em','<',expired)));
 const rows=await disponiveis(db('notificacoes_email')).where('tentativas','<',5).orderBy('id').limit(Math.min(10,Math.max(1,limite)));
 for(const row of rows){
  const token=randomUUID();
  const won=await disponiveis(db('notificacoes_email').where({id:row.id})).where('tentativas','<',5).update({status:'enviando',lock_em:agora(),lock_token:token,tentativas:db.raw('tentativas + 1')});
  if(!won)continue;
  processadas++;
  try{
   const notification=await db('notificacoes').where({id:row.notificacao_id}).first();
   const u=notification&&await usuariosAtivos().where('u.id',notification.usuario_id).select('u.email','u.email_notificacoes').first();
   if(!u?.email_notificacoes||!/^\S+@\S+\.\S+$/.test(u.email)||/[\r\n]/.test(u.email)){
    await db('notificacoes_email').where({id:row.id,lock_token:token}).update({status:'cancelado',lock_token:null,lock_em:null});continue;
   }
   // Nenhuma pontuação, relatório ou texto privado segue no e-mail. A leitura exige login.
   const labels={missao_criada:'Nova missão disponível',relatorio_devolvido:'Relatório devolvido para correção',relatorio_enviado:'Novo relatório recebido',missao_entrega:'Resultado de missão recebido',missao_aprovada:'Resultado de missão avaliado',missao_rejeitada:'Resultado de missão devolvido',google_pendente:'Solicitação de acesso pendente',aviso:'Aviso importante'};
   const label=labels[notification.tipo]||'Nova notificação';
   await mailer.sendMail({from:config.from,to:u.email,subject:`Rally das Tribos — ${label}`,text:`${label}. Você recebeu uma notificação no Rally das Tribos.\n\nEntre na sua conta para ler: ${config.url}\n\nVocê pode desativar estes e-mails em Notificações → Preferências.`,messageId:`<rally-notificacao-${notification.id}@${new URL(config.url).hostname}>`});
   await db('notificacoes_email').where({id:row.id,lock_token:token}).update({status:'enviado',enviado_em:agora(),lock_token:null,lock_em:null,ultimo_erro:null});
  }catch{
   await db('notificacoes_email').where({id:row.id,lock_token:token}).update({status:'falhou',proxima_em:new Date(Date.now()+Math.min(3600,60*2**row.tentativas)*1000).toISOString(),lock_token:null,lock_em:null,ultimo_erro:'Não foi possível entregar. Confira a configuração do provedor.'});
  }
 }
 return {processadas};
}
function iniciarWorker(){
 if(process.env.VERCEL||!configuracao())return ()=>{};
 let busy=false,stopped=false;
 const tick=async()=>{if(busy||stopped)return;busy=true;try{await processarFila();}catch{console.warn('Fila de e-mails indisponível; nova tentativa no próximo ciclo.');}finally{busy=false;}};
 const timer=setInterval(tick,30000);timer.unref();void tick();
 return ()=>{stopped=true;clearInterval(timer);};
}
module.exports={configuracao,criarTransport,processarFila,iniciarWorker};
