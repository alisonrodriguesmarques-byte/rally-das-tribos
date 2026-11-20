const service=require('../services/googleService');
const config=require('../config');
const {idParam}=require('./_helpers');
const {COOKIE}=require('../middlewares/auth');
const {opcoesCookie}=require('./authController');
const stateOptions={httpOnly:true,sameSite:'lax',secure:config.env==='production',path:'/api/auth/google',maxAge:10*60*1000};
module.exports={
 config(_req,res){res.json({habilitado:service.disponivel()});},
 async iniciar(_req,res){const flow=await service.iniciar();res.cookie(service.STATE_COOKIE,flow.cookie,stateOptions).redirect(flow.url);},
 async callback(req,res){
  let origin;try{origin=service.configuracao().origin;}catch{return res.status(503).send('Login Google indisponível. Use e-mail e senha.');}
  const cookie=req.cookies?.[service.STATE_COOKIE];res.clearCookie(service.STATE_COOKIE,{...stateOptions,maxAge:undefined});
  try{
   const result=await service.concluir(req.query.code,req.query.state,cookie);
   if(result.status==='aprovado'){res.cookie(COOKIE,result.token,opcoesCookie);return res.redirect(origin+'/#/');}
   res.redirect(origin+'/#/login?google='+result.status);
  }catch{res.redirect(origin+'/#/login?google=erro');}
 },
 async listar(_req,res){res.json(await service.listar());},
 async aprovar(req,res){res.json(await service.aprovar(idParam(req),req.body?.usuario_id,req.usuario.id,req.body?.senha_admin_atual));},
 async rejeitar(req,res){res.json(await service.rejeitar(idParam(req),req.usuario.id));},
 async desvincular(req,res){res.json(await service.desvincular(idParam(req),req.usuario.id));},
};
