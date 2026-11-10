const { Router } = require('express');
const { autenticar, exigirAdmin } = require('../middlewares/auth');
const auth = require('../controllers/authController');
const rallies = require('../controllers/ralliesController');
const tribos = require('../controllers/tribosController');
const pessoas = require('../controllers/pessoasController');
const categorias = require('../controllers/categoriasController');
const pontos = require('../controllers/pontosController');
const missoes = require('../controllers/missoesController');
const almas = require('../controllers/relatoriosAlmasController');
const { ocultarPontuacao } = require('../middlewares/privacidade');
 
const r = Router();
const admin = [autenticar, exigirAdmin];
 
r.get('/saude', (_req, res) => res.json({ ok: true }));
 
// Autenticação
r.post('/auth/login', auth.login);
r.post('/auth/logout', auth.logout);
r.get('/auth/me', autenticar, auth.me);
r.patch('/auth/senha', autenticar, auth.trocarSenha);
 
r.use(autenticar);
r.use(ocultarPontuacao);
 
// Rallies e tribos
r.get('/rallies', rallies.listar);
r.get('/rallies/atual', rallies.atual);
r.get('/rallies/:id', rallies.obter);
r.post('/rallies', admin, rallies.criar);
r.patch('/rallies/:id', admin, rallies.atualizar);
r.get('/rallies/:id/tribos', rallies.tribos);
r.get('/rally-tribos/:id', tribos.perfil);
r.patch('/rally-tribos/:id', admin, tribos.lideranca);
r.post('/rally-tribos/:id/membros', admin, tribos.adicionarMembro);
r.post('/membros/:id/remover', admin, tribos.removerMembro);
r.post('/membros/:id/transferir', admin, tribos.transferir);
 
// Pessoas
r.get('/pessoas', admin, pessoas.listar);
r.post('/pessoas', admin, pessoas.criar);
r.get('/pessoas/:id', admin, pessoas.obter);
r.patch('/pessoas/:id', admin, pessoas.atualizar);
r.put('/pessoas/:id/acesso', admin, pessoas.acesso);
 
// Categorias
r.get('/categorias', categorias.listar);
r.post('/categorias', admin, categorias.criar);
r.patch('/categorias/:id', admin, categorias.atualizar);
 
// Pontuação, ranking e painel
r.get('/rallies/:id/lancamentos', admin, pontos.listar);
r.post('/rallies/:id/lancamentos', admin, pontos.criar);
r.patch('/lancamentos/:id', admin, pontos.editar);
r.post('/lancamentos/:id/cancelar', admin, pontos.cancelar);
r.get('/lancamentos/:id/historico', admin, pontos.historico);
r.get('/rallies/:id/ranking', admin, pontos.ranking);
r.get('/rallies/:id/ranking/semanas', admin, pontos.semanas);
r.get('/rallies/:id/pontos-por-categoria', admin, pontos.categorias);
r.get('/rallies/:id/dashboard', admin, pontos.dashboard);
r.get('/rallies/:id/exportar/ranking.csv', admin, pontos.exportarRanking);
r.get('/rallies/:id/exportar/lancamentos.csv', admin, pontos.exportarLancamentos);
 
// Missões
r.get('/rallies/:id/missoes', missoes.listar);
r.post('/rallies/:id/missoes', admin, missoes.criar);
r.get('/rallies/:id/entregas-pendentes', admin, missoes.pendentes);
r.get('/missoes/:id', missoes.obter);
r.patch('/missoes/:id', admin, missoes.atualizar);
r.post('/missoes/:id/entregas', missoes.enviarEntrega);
r.post('/entregas/:id/aprovar', admin, missoes.aprovar);
r.post('/entregas/:id/rejeitar', admin, missoes.rejeitar);
 
// Relatórios semanais de almas
r.get('/rallies/:id/relatorios-almas/exportar', admin, almas.exportar);
r.get('/rallies/:id/relatorios-almas', almas.listar);
r.post('/rallies/:id/relatorios-almas', almas.salvar);
r.post('/relatorios-almas/:id/avaliar', admin, almas.avaliar);

module.exports = r;
