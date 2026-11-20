const config=require('../config');
const authService=require('../services/authService');
const {COOKIE,extrairToken,verificarToken}=require('../middlewares/auth');
const opcoesCookie={httpOnly:true,sameSite:'lax',secure:config.env==='production',path:'/',maxAge:12*60*60*1000};
module.exports={
 async login(req,res){const {token,usuario}=await authService.login(req.body?.email,req.body?.senha);res.cookie(COOKIE,token,opcoesCookie).json({usuario});},
 async logout(req,res){
  const token=extrairToken(req);let payload; if(token){try{payload=verificarToken(token);}catch{/* Sessão inválida já não concede acesso. */}}
  if(payload&&/^\d+$/.test(String(payload.sub))&&Number.isSafeInteger(payload.av))await authService.revogarSessoes(Number(payload.sub),undefined,payload.av);
  res.clearCookie(COOKIE,{...opcoesCookie,maxAge:undefined}).json({ok:true});
 },
 async me(req,res){res.json(await authService.perfil(req.usuario.id));},
 async trocarSenha(req,res){await authService.trocarSenha(req.usuario.id,req.body?.senha_atual,req.body?.nova_senha);res.clearCookie(COOKIE,{...opcoesCookie,maxAge:undefined}).json({ok:true,reautenticar:true});},
 opcoesCookie,
};
