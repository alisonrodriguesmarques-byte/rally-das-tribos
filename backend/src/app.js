const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const rotas = require('./routes');
const { naoEncontrada, tratarErros } = require('./middlewares/erros');
 
function criarApp() {
  const app = express();
  app.disable('x-powered-by');
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
