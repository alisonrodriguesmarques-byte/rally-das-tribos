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
const cadastro=require('../controllers/cadastroController');
const google = require('../controllers/googleController');
const notificacoes = require('../controllers/notificacoesController');
const { ocultarPontuacao } = require('../middlewares/privacidade');
 
const r = Router();
const admin = [autenticar, exigirAdmin];
 
r.get('/saude', (_req, res) => res.json({ ok: true }));
 
// Autenticação
r.get('/auth/google/config', google.config);
r.get('/auth/google/iniciar', google.iniciar);
r.get('/auth/google/callback', google.callback);
r.post('/auth/cadastro',cadastro.solicitar);
r.post('/auth/login', auth.login);
r.post('/auth/logout', auth.logout);
r.get('/auth/me', autenticar, auth.me);
r.patch('/auth/senha', autenticar, auth.trocarSenha);
 
r.use(autenticar);
r.use(ocultarPontuacao);
 
// Notificações são privadas por usuário; somente admin pode publicar avisos.
r.get('/notificacoes/contagem', notificacoes.contar);
r.post('/notificacoes/ler-todas', notificacoes.lerTodas);
r.get('/notificacoes', notificacoes.listar);
r.post('/notificacoes/:id/ler', notificacoes.ler);
r.delete('/notificacoes/:id', notificacoes.excluir);
r.get('/cadastros',admin,cadastro.listar);
r.post('/cadastros/:id/aprovar',admin,cadastro.aprovar);
r.post('/cadastros/:id/rejeitar',admin,cadastro.rejeitar);
r.post('/google-vinculos/:id/criar-conta',admin,cadastro.criarGoogle);
r.get('/google-vinculos', admin, google.listar);
r.post('/google-vinculos/:id/aprovar', admin, google.aprovar);
r.post('/google-vinculos/:id/rejeitar', admin, google.rejeitar);
r.post('/google-vinculos/:id/desvincular', admin, google.desvincular);

// Rallies e tribos
r.get('/tribos', admin, rallies.catalogo);
r.get('/rallies', rallies.listar);
r.get('/rallies/atual', rallies.atual);
r.get('/rallies/:id', rallies.obter);
r.post('/rallies', admin, rallies.criar);
r.patch('/rallies/:id', admin, rallies.atualizar);
r.post('/rallies/:id/arquivar', admin, rallies.arquivar);
r.post('/rallies/:id/desarquivar', admin, rallies.desarquivar);
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
r.delete('/pessoas/:id', admin, pessoas.excluir);
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
