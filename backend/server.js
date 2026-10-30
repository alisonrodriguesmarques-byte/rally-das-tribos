/**
 * Servidor Principal - Rally das Tribos
 * Ponto de entrada da aplicação
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const { getDatabase, getOpenDatabaseFingerprint } = require('./database/connection');
const RallyController = require('./controllers/rallyController');
const TriboController = require('./controllers/triboController');
const setupRallyRoutes = require('./routes/rallyRoutes');
const setupTriboRoutes = require('./routes/triboRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

  if (process.env.NODE_ENV === 'test') {
    if (!app.locals.database) {
      return res.status(503).json({ status: 'unavailable' });
    }
    try {
      health.databaseMode = 'test';
      health.databaseFingerprint = await getOpenDatabaseFingerprint(app.locals.database);
    } catch (error) {
      return res.status(503).json({ status: 'unavailable' });
    }
  }

  return res.json(health);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: err.message
  });
});

// Variável para armazenar a instância do servidor
let server = null;

// Função para encerrar o servidor graciosamente
function gracefulShutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando servidor graciosamente...`);

  if (server) {
    server.close((err) => {
      if (err) {
        console.error('Erro ao encerrar servidor:', err);
        process.exit(1);
      }
      console.log('✅ Servidor encerrado com sucesso.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('⚠️  Timeout: Forçando encerramento do servidor.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Conectar ao banco e configurar rotas antes de iniciar
async function init() {
  try {
    const db = getDatabase();
    await db.connect();
    app.locals.database = db;
    console.log('✅ Conectado ao banco de dados SQLite');
    console.log('✅ Foreign keys habilitadas');

    const rallyController = new RallyController(db);
    const triboController = new TriboController(db);

    app.use('/api/rallies', setupRallyRoutes(rallyController));
    app.use('/api/tribos', setupTriboRoutes(triboController));

    console.log('✅ Rotas da API configuradas');

    server = app.listen(PORT, () => {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🏆  Rally das Tribos - Servidor Iniciado com Sucesso');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`📡  Servidor rodando em: http://localhost:${PORT}`);
      console.log(`🌐  API disponível em: http://localhost:${PORT}/api`);
      console.log(`💚  Sistema pronto para uso!`);
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
    console.error('❌ Erro ao inicializar servidor:', error);
    process.exit(1);
  }
}

init();

module.exports = app;
