const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { randomUUID } = require('node:crypto');
const config = require('../config');
function origemEsperada(req) {
  return process.env.APP_URL ? new URL(process.env.APP_URL).origin : `${req.protocol}://${req.get('host')}`;
}
function protegerRequisicao(req,res,next) {
  req.requestId=randomUUID();res.setHeader('X-Request-Id',req.requestId);
  if(req.path.startsWith('/api')){
    res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Cookie, Origin');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)){
      const origin=req.headers.origin;
      let allowed=!origin;
      try{if(origin)allowed=new URL(origin).origin===origemEsperada(req);}catch{allowed=false;}
      if(!allowed||req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({erro:'Origem da requisição não permitida.'});
      if(Number(req.headers['content-length']||0)>0&&!req.is('application/json'))return res.status(415).json({erro:'Use application/json.'});
    }
  }
  next();
}
const headers=helmet({
  contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','https:'],fontSrc:["'self'"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'self'"],formAction:["'self'"],upgradeInsecureRequests:config.env==='production'?[]:null}},
  referrerPolicy:{policy:'strict-origin-when-cross-origin'},
});
const apiLimiter=rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-7',legacyHeaders:false,message:{erro:'Muitas requisições. Aguarde um minuto.'}});
const loginLimiter=rateLimit({windowMs:15*60000,limit:30,skipSuccessfulRequests:true,standardHeaders:'draft-7',legacyHeaders:false,message:{erro:'Muitas tentativas de acesso. Aguarde 15 minutos.'}});
module.exports={headers,protegerRequisicao,apiLimiter,loginLimiter};
