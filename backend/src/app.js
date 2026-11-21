const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const seguranca = require('./middlewares/seguranca');
const rotas = require('./routes');
const { naoEncontrada, tratarErros } = require('./middlewares/erros');
 
function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  // Render encerra HTTPS no proxy à frente do serviço.
  app.set('trust proxy', 1);
  app.use(seguranca.headers);
  app.use(seguranca.protegerRequisicao);
  app.use('/api', seguranca.apiLimiter);
  app.use('/api/auth/cadastro', require('express-rate-limit').rateLimit({windowMs:900000,limit:30,standardHeaders:true,legacyHeaders:false,message:{erro:'Muitos pedidos. Aguarde 15 minutos.'}}));
  app.use('/api/auth/login', seguranca.loginLimiter);
  app.use('/api/auth/senha', seguranca.loginLimiter);
  app.use('/api/google-vinculos', seguranca.loginLimiter);
  app.use('/api/auth/google/iniciar', seguranca.loginLimiter);
  app.use('/api/auth/google/callback', seguranca.loginLimiter);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
 
  app.use('/api', rotas);
  app.use('/api', naoEncontrada);
 
  app.use('/vendor', express.static(path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist')));
  app.use(express.static(config.frontendDir));
  app.get('/{*caminho}', (_req, res) => res.sendFile('index.html', { root: config.frontendDir }));
 
  app.use(tratarErros);
  return app;
}
 
module.exports = { criarApp };
