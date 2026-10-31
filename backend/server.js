/**
 * Servidor Principal - Rally das Tribos
 * Ponto de entrada da aplicação
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('node:http');
const https = require('node:https');
const { readTransportConfig, protectRequest } = require('./config/httpTransport');

const { getDatabase, getOpenDatabaseFingerprint } = require('./database/connection');
const { assertSchemaReady } = require('./database/init');
const { AuthService } = require('./services/authService');
const { createAuthMiddleware } = require('./middleware/auth');
const setupAuthRoutes = require('./routes/authRoutes');
const setupUserRoutes = require('./routes/userRoutes');
const { TeamService } = require('./services/teamService');
const setupTeamRoutes = require('./routes/teamRoutes');
const setupParticipantRoutes = require('./routes/participantRoutes');
const { ScoreService } = require('./services/scoreService');
const setupScoreRoutes = require('./routes/scoreRoutes');
const { MissionService } = require('./services/missionService');
const { ExamService } = require('./services/examService');
const setupActivityRoutes = require('./routes/activityRoutes');
const errorHandler = require('./middleware/errorHandler');
const RallyController = require('./controllers/rallyController');
const TriboController = require('./controllers/triboController');
const setupRallyRoutes = require('./routes/rallyRoutes');
const setupTriboRoutes = require('./routes/triboRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// The real socket determines HTTPS. Forwarded headers never grant trust.
app.use(protectRequest);
app.set('trust proxy', false);
app.disable('x-powered-by');
// Objective exams may contain up to twenty questions with six alternatives.
app.use('/api/atividades', bodyParser.json({ limit: '128kb', strict: true }));
app.use(bodyParser.json({ limit: '16kb', strict: true }));
app.use(bodyParser.urlencoded({ extended: false, limit: '16kb', parameterLimit: 20 }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Rotas da API básicas
app.get('/api', (req, res) => {
  res.json({
    message: 'API do Rally das Tribos',
    version: '1.0.0',
    status: 'online'
  });
});

app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString()
  };

  try {
    if (!app.locals.database) throw new Error('Database unavailable');
    await app.locals.database.get('SELECT 1 AS ready');
    if (process.env.NODE_ENV === 'test') {
      health.databaseMode = 'test';
      health.databaseFingerprint = await getOpenDatabaseFingerprint(app.locals.database);
    }
  } catch (error) {
    return res.status(503).json({ status: 'unavailable' });
  }

  return res.json(health);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Variável para armazenar a instância do servidor
let server = null;

// Função para encerrar o servidor graciosamente
function gracefulShutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando servidor graciosamente...`);

  if (server) {
    server.close(async (err) => {
      if (err) {
        console.error('Erro ao encerrar servidor:', err);
        process.exit(1);
      }
      try {
        await app.locals.database?.close();
        console.log('✅ Servidor encerrado com sucesso.');
        process.exit(0);
      } catch (error) {
        console.error('Erro ao fechar o banco sintetico:', error.message);
        process.exit(1);
      }
    });

    setTimeout(() => {
      console.error('⚠️  Timeout: Forçando encerramento do servidor.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Conectar ao banco e configurar rotas antes de iniciar
async function init() {
  try {
    // Validate transport (including the TLS pair) before touching the database.
    const transport = readTransportConfig();
    const db = getDatabase();
    await db.connect();
    app.locals.database = db;
    await assertSchemaReady(db);
    console.log('✅ Conectado ao banco de dados SQLite');
    console.log('✅ Foreign keys habilitadas');

    const rallyController = new RallyController(db);
    const triboController = new TriboController(db);
    const authService = new AuthService(db);
    const auth = createAuthMiddleware(authService);

    app.use('/api/atividades', setupActivityRoutes(new MissionService(db), new ExamService(db), auth));
    app.use('/api/auth', setupAuthRoutes(authService, auth));
    app.use('/api/admin/users', setupUserRoutes(authService, auth));
    const teamService = new TeamService(db);
    app.use('/api/pontuacoes', setupScoreRoutes(new ScoreService(db), auth));
    app.use('/api/equipes', setupTeamRoutes(teamService, auth));
    app.use('/api/participantes', setupParticipantRoutes(teamService, auth));
    // Undefined non-administrative business permissions are denied by default.
    const administrative = [auth.requireSession, auth.requireAdmin, auth.requireCsrf];
    app.use('/api/rallies', ...administrative, setupRallyRoutes(rallyController));
    app.use('/api/tribos', ...administrative, setupTriboRoutes(triboController));
    app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'Rota nao encontrada.' }));
    // Must be registered after every route that can call next(error).
    app.use(errorHandler);

    console.log('✅ Rotas da API configuradas');

    server = transport.tls ? https.createServer(transport.tls, app) : http.createServer(app);
    server.listen(transport.port, transport.host, () => {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🏆  Rally das Tribos - Servidor Iniciado com Sucesso');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`📡  Servidor sintetico local iniciado na porta ${server.address().port}`);
      console.log(`Transporte: ${transport.protocol === 'https:' ? 'HTTPS (TLS)' : 'HTTP local'}.`);
      console.log('Login e permissoes administrativas ativos; ambiente exclusivamente sintetico.');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('💡  Pressione Ctrl+C para encerrar o servidor');
      console.log('═══════════════════════════════════════════════════════════');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error('\n═══════════════════════════════════════════════════════════');
        console.error('[ERRO] Não foi possível iniciar o Rally das Tribos.');
        console.error('═══════════════════════════════════════════════════════════');
        console.error(`[CAUSA] A porta ${PORT} já está sendo utilizada.`);
        console.error('═══════════════════════════════════════════════════════════');
        console.error('[ORIENTAÇÃO] Verifique se já existe outra instância do servidor em execução.');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('[AJUDA] Para identificar o processo que está usando a porta:');
        console.error(`        No PowerShell: netstat -ano | findstr :${PORT}`);
        console.error(`        No CMD: netstat -ano | findstr :${PORT}`);
        console.error('═══════════════════════════════════════════════════════════');
        console.error('[SOLUÇÃO] Encerre o processo manualmente com segurança:');
        console.error(`        taskkill //PID <PID> //F`);
        console.error('═══════════════════════════════════════════════════════════');
        console.error('[ALTERNATIVA] Use outra porta configurando a variável de ambiente:');
        console.error(`        $env:PORT=${parseInt(PORT) + 1}; npm start`);
        console.error('═══════════════════════════════════════════════════════════\n');
      } else {
        console.error('\n═══════════════════════════════════════════════════════════');
        console.error('[ERRO] Erro ao iniciar servidor:');
        console.error('═══════════════════════════════════════════════════════════');
        console.error(error);
        console.error('═══════════════════════════════════════════════════════════\n');
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Erro ao inicializar servidor:', error.message);
    process.exit(1);
  }
}

init();

module.exports = app;
