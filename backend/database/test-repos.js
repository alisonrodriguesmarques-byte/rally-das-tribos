/**
 * Script de Teste dos Repositórios
 * Testa a criação e consulta de rallies e tribos
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getTestDatabase } = require('./test-support');
const {
  Database,
  getTestDatabasePath,
  getProtectedDatabasePaths,
  getDatabaseFingerprint,
  getOpenDatabaseFingerprint
} = require('./connection');
const RallyRepository = require('../repositories/rallyRepository');
const TriboRepository = require('../repositories/triboRepository');

function assertProtectedDatabasePathsRejected() {
  const originalTestPath = process.env.RALLY_TEST_DB_PATH;
  const validTestPath = getTestDatabasePath();
  const protectedPaths = getProtectedDatabasePaths();
  try {
    for (const protectedPath of protectedPaths) {
      if (!fs.existsSync(protectedPath)) continue;
      const normalizedAlias = path.dirname(protectedPath) + path.sep + '.' + path.sep + path.basename(protectedPath);
      for (const candidate of [protectedPath, normalizedAlias]) {
        process.env.RALLY_TEST_DB_PATH = candidate;
        assert.throws(() => getTestDatabasePath(), /banco protegido/i);
      }
    }

    const referencePath = protectedPaths[1];
    if (fs.existsSync(referencePath)) {
      const physicalAlias = path.join(
        path.dirname(validTestPath),
        'protected-reference-alias-' + process.pid + '-' + Date.now() + '.db'
      );
      let linked = false;
      try {
        fs.linkSync(referencePath, physicalAlias);
        linked = true;
      } catch (error) {
        if (!['EPERM', 'EACCES', 'EXDEV', 'ENOTSUP'].includes(error.code)) throw error;
      }
      if (linked) {
        try {
          process.env.RALLY_TEST_DB_PATH = physicalAlias;
          assert.throws(() => getTestDatabasePath(), /banco protegido/i);
        } finally {
          fs.unlinkSync(physicalAlias);
        }
      }
    }
  } finally {
    process.env.RALLY_TEST_DB_PATH = originalTestPath;
  }
}

async function testRollbackFailureInvalidatesConnection() {
  const isolated = new Database(process.env.RALLY_TEST_DB_PATH);
  const rollbackError = new Error('rollback failure simulation');
  const originalError = new Error('transaction callback failure simulation');
  const statements = [];
  const loggedErrors = [];
  const originalRawRun = isolated._runRaw.bind(isolated);
  const originalConsoleError = console.error;
  isolated._runRaw = async (sql, params) => {
    statements.push(sql);
    if (sql === 'BEGIN IMMEDIATE') return { id: 0, changes: 0 };
    if (sql === 'ROLLBACK') throw rollbackError;
    return originalRawRun(sql, params);
  };

  console.error = (...args) => loggedErrors.push(args);
  try {
    await assert.rejects(
      isolated.transaction(async () => { throw originalError; }),
      (error) => error.code === 'SQLITE_ROLLBACK_FAILED' &&
        error.originalError === originalError && error.rollbackError === rollbackError
    );
  } finally {
    console.error = originalConsoleError;
  }
  assert.deepStrictEqual(statements, ['BEGIN IMMEDIATE', 'ROLLBACK']);
  assert(loggedErrors.some((args) => args[1]?.originalError === originalError && args[1]?.rollbackError === rollbackError));
  await assert.rejects(
    async () => isolated.run('UPDATE rallies SET status = ?', ['ativo']),
    (error) => error.code === 'SQLITE_ROLLBACK_FAILED'
  );
  assert.throws(() => isolated.get('SELECT 1'),
    (error) => error.code === 'SQLITE_ROLLBACK_FAILED');
  assert.throws(() => isolated.connect(),
    (error) => error.code === 'SQLITE_ROLLBACK_FAILED');
  assert.throws(() => isolated.transaction(async () => {}),
    (error) => error.code === 'SQLITE_ROLLBACK_FAILED');
  await Promise.race([
    isolated.operationQueue,
    new Promise((_, reject) => setTimeout(() => reject(new Error('rollback queue remained pending')), 1000))
  ]);
}

async function testNestedTransactionRejected(db) {
  const table = 'transaction_queue_nested_probe';
  await db.run('DROP TABLE IF EXISTS ' + table);
  await db.run('CREATE TABLE ' + table + ' (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  await db.run('INSERT INTO ' + table + " (id, value) VALUES (1, 'initial')");
  await db.transaction(async () => {
    await db.run('UPDATE ' + table + " SET value = 'outer' WHERE id = 1");
    await assert.rejects(
      async () => db.transaction(async () => db.run('UPDATE ' + table + " SET value = 'inner' WHERE id = 1")),
      /nested transactions/i
    );
    assert.strictEqual((await db.get('SELECT value FROM ' + table + ' WHERE id = 1')).value, 'outer');
  });
  assert.strictEqual((await db.get('SELECT value FROM ' + table + ' WHERE id = 1')).value, 'outer');
  await db.transaction(async () => {
    assert.strictEqual((await db.get('SELECT 1 AS ready')).ready, 1);
  });
  await db.run('DROP TABLE ' + table);
  console.log('Nested transaction rejected; following transaction completed');
}

async function testExternalWritesWaitForTransaction(db) {
  const table = 'transaction_queue_isolation_probe';
  await db.run('DROP TABLE IF EXISTS ' + table);
  await db.run('CREATE TABLE ' + table + ' (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  await db.run('INSERT INTO ' + table + " (id, value) VALUES (1, 'initial')");
  let signalEntered;
  let signalRelease;
  const entered = new Promise((resolve) => { signalEntered = resolve; });
  const release = new Promise((resolve) => { signalRelease = resolve; });
  const transactionError = new Error('rollback transaction after internal write');
  const transaction = db.transaction(async () => {
    await db.run('UPDATE ' + table + " SET value = 'transaction' WHERE id = 1");
    assert.strictEqual((await db.get('SELECT value FROM ' + table + ' WHERE id = 1')).value, 'transaction');
    signalEntered();
    await release;
    throw transactionError;
  });
  await entered;
  let externalWriteCompleted = false;
  const externalWrite = db.run('UPDATE ' + table + " SET value = 'external' WHERE id = 1").then((result) => {
    externalWriteCompleted = true;
    return result;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.strictEqual(externalWriteCompleted, false, 'external write must wait for active transaction');
  signalRelease();
  await assert.rejects(transaction, (error) => error === transactionError);
  await externalWrite;
  assert.strictEqual((await db.get('SELECT value FROM ' + table + ' WHERE id = 1')).value, 'external');
  await db.run('DROP TABLE ' + table);
  console.log('External write waited for rollback and persisted afterward');
}

async function testParticipantCountsAndScoreIntegrity(db, rallyRepo, triboRepo, rally) {
  const secondRally = await rallyRepo.create({ nome: 'Rally de Integridade de Pontuacao', descricao: 'Fixture isolada', data_inicio: '2026-10-01', data_fim: '2026-12-31' });
  const [tribeA, tribeB] = rally.tribos; const participants=[];
  for (const name of ['Fixture Ativo','Fixture Historico','Fixture Outro Ativo']) { const result=await db.run('INSERT INTO participantes (nome_completo,status) VALUES (?,?)',[name,'ativo']); participants.push(result.id); }
  await db.run('INSERT INTO membros_tribo (tribo_id,participante_id,data_entrada,data_saida,ativo) VALUES (?,?,?,?,0)',[tribeA.id,participants[1],'2026-01-01','2026-02-01']);
  await db.run('INSERT INTO membros_tribo (tribo_id,participante_id,data_entrada,data_saida,ativo) VALUES (?,?,?,?,0)',[tribeA.id,participants[0],'2025-01-01','2025-12-31']);
  await db.run('INSERT INTO membros_tribo (tribo_id,participante_id,data_entrada,ativo) VALUES (?,?,?,1)',[tribeA.id,participants[0],'2026-03-01']);
  await db.run('INSERT INTO membros_tribo (tribo_id,participante_id,data_entrada,ativo) VALUES (?,?,?,1)',[tribeA.id,participants[2],'2026-03-01']);
  await assert.rejects(db.run('INSERT INTO membros_tribo (tribo_id,participante_id,data_entrada,ativo) VALUES (?,?,?,1)',[tribeB.id,participants[0],'2026-03-02']),/Participante ja esta em uma tribo deste rally|Participante já está em uma tribo deste rally/i);
  const rankingBefore=await triboRepo.getRanking(rally.id); const listed=await triboRepo.findByRally(rally.id);
  assert.strictEqual(listed.find(x=>x.id===tribeA.id).total_participantes,2,'conta participantes ativos distintos e ignora historico inativo');
  assert.strictEqual((await triboRepo.findByRally(secondRally.id)).length,12); assert.deepStrictEqual(await triboRepo.getRanking(rally.id),rankingBefore,'membros nao alteram ranking');
  const user=await db.run("INSERT INTO usuarios (nome_completo,email,senha_hash,tipo_usuario) VALUES (?, ?, ?, 'admin')",['Fixture Points','fixture-points-'+Date.now()+'@example.invalid','fake-hash']);
  const proof=await db.run("INSERT INTO provas (rally_id,titulo,tipo_prova,data,pontuacao_maxima) VALUES (?,?,'quiz',?,?)",[rally.id,'Prova fixture','2026-03-10',20]);
  const mission=await db.run("INSERT INTO missoes (rally_id,titulo,descricao,data_inicio,data_limite,tipo_missao,tipo_pontuacao,valor_pontuacao) VALUES (?,?,?, ?, ?, 'semanal','fixa',5)",[rally.id,'Missao fixture','Descricao','2026-03-01','2026-03-31']);
  const insertScore = (values) => db.run("INSERT INTO pontuacoes (rally_id, tribo_id, prova_id, missao_id, tipo_origem, descricao, pontos, tipo_pontuacao, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)", [...values, user.id]);
  await insertScore([rally.id,tribeA.id,null,null,'manual','Score sem origem',5]); await insertScore([rally.id,tribeA.id,proof.id,null,'prova','Score com prova',7]);
  await insertScore([rally.id,tribeB.id,null,null,'manual','Empate no ranking',12]);
  await assert.rejects(insertScore([rally.id,tribeA.id,proof.id,mission.id,'prova','Duas origens',9]),/Apenas uma origem/i);
  const mismatch=/pontuacao deve pertencer ao Rally da tribo|pontuação deve pertencer ao Rally da tribo/i;
  await assert.rejects(insertScore([secondRally.id,tribeA.id,null,null,'manual','Score cruzado',11]),mismatch);
  await assert.rejects(db.run('UPDATE pontuacoes SET rally_id=? WHERE rally_id=? AND tribo_id=? AND descricao=?',[secondRally.id,rally.id,tribeA.id,'Score sem origem']),mismatch);
  await assert.rejects(db.run('UPDATE tribos SET rally_id=? WHERE id=?',[secondRally.id,tribeA.id]),/tribo com pontuacoes nao pode mudar de Rally|tribo com pontuações não pode mudar de Rally/i);
  const scores=await db.all('SELECT rally_id,tribo_id,pontos FROM pontuacoes WHERE tribo_id=?',[tribeA.id]); assert.strictEqual(scores.length,2); assert(scores.every(x=>x.rally_id===rally.id));
  assert.deepStrictEqual(await db.all('PRAGMA foreign_key_check'),[]); const finalRanking=await triboRepo.getRanking(rally.id); assert.strictEqual(finalRanking.find(x=>x.id===tribeA.id).pontuacao_total,12); assert.strictEqual(finalRanking.find(x=>x.id===tribeB.id).pontuacao_total,12); assert.strictEqual(finalRanking.find(x=>x.id===tribeA.id).posicao,1); assert.strictEqual(finalRanking.find(x=>x.id===tribeB.id).posicao,1); assert.strictEqual(finalRanking.find(x=>x.id!==tribeA.id&&x.id!==tribeB.id).posicao,3); assert(finalRanking.some(x=>x.pontuacao_total===0)); assert((await triboRepo.getRanking(secondRally.id)).every(x=>x.pontuacao_total===0));
  console.log('Active distinct count, duplicate membership, score scope and origin constraints verified');
}

async function testRepositories() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Testando Repositórios');
  console.log('═══════════════════════════════════════════════════════════\n');

  const db = getTestDatabase();
  const rallyRepo = new RallyRepository(db);
  const triboRepo = new TriboRepository(db);

  console.log('Checking protected database path guards...');
  assertProtectedDatabasePathsRejected();
  await testRollbackFailureInvalidatesConnection();
  console.log('Protected paths and rollback-failure handling verified without opening protected DBs');

  try {
    // Conectar ao banco
    await db.connect();
    const openedFingerprint = await getOpenDatabaseFingerprint(db);
    assert.strictEqual(
      openedFingerprint,
      getDatabaseFingerprint(getTestDatabasePath()),
      'connection must confirm disposable file before writes'
    );
    console.log('✅ Conectado ao banco de dados\n');

    // Test Rally creation and retrieval.
    console.log("Creating a repository test Rally...");
    const rally = await rallyRepo.create({
      nome: "Rally de Teste 2026",
      descricao: "Rally para testar os repositorios",
      data_inicio: "2026-01-01",
      data_fim: "2026-03-31"
    });
    if (rally.status !== 'planejamento') {
      throw new Error('New Rally must start in planejamento; got ' + rally.status);
    }
    console.log('Rally created in ' + rally.status + ': ' + rally.nome + ' (ID: ' + rally.id + ')');

    const originalError = new Error('normal rollback verification');
    await assert.rejects(db.transaction(async () => {
      await db.run('UPDATE rallies SET status = ? WHERE id = ?', ['ativo', rally.id]);
      throw originalError;
    }), (error) => error === originalError);
    assert.strictEqual((await rallyRepo.findById(rally.id)).status, 'planejamento', 'rollback normal deve preservar o status');
    console.log('Normal transaction rollback verified');
    console.log("Finding Rally by ID...");
    const foundRally = await rallyRepo.findById(rally.id);
    console.log(`Rally found: ${foundRally.nome}`);


    // RallyRepository.create creates the 12 official tribes automatically.
    const tribosOficiais = rally.tribos || [];
    if (tribosOficiais.length !== 12) {
      throw new Error(`Expected 12 official tribes; got ${tribosOficiais.length}`);
    }
    console.log(`Rally created ${tribosOficiais.length} official tribes automatically`);
    await testParticipantCountsAndScoreIntegrity(db, rallyRepo, triboRepo, rally);

    const concurrentRally = await rallyRepo.create({
      nome: 'Rally para disputa concorrente',
      descricao: 'Dados descartaveis para teste de transacoes concorrentes',
      data_inicio: '2026-07-01',
      data_fim: '2026-09-30'
    });
    const concurrentResults = await Promise.allSettled([
      rallyRepo.start(concurrentRally.id),
      rallyRepo.cancel(concurrentRally.id)
    ]);
    const successes = concurrentResults.filter((result) => result.status === 'fulfilled');
    const failures = concurrentResults.filter((result) => result.status === 'rejected');
    assert.strictEqual(successes.length, 1, 'exatamente uma transicao concorrente deve vencer');
    assert.strictEqual(failures.length, 1, 'a transicao concorrente restante deve ser rejeitada');
    assert.strictEqual(failures[0].reason.status, 400, 'a corrida deve rejeitar a transicao por estado invalido');
    const persistedConcurrentRally = await rallyRepo.findById(concurrentRally.id);
    assert.strictEqual(persistedConcurrentRally.status, successes[0].value.status, 'estado final deve corresponder a chamada vencedora');
    assert(['ativo', 'cancelado'].includes(persistedConcurrentRally.status));
    await db.transaction(async () => db.get('SELECT 1 AS transaction_ready'));
    console.log('Concurrent transition results:', concurrentResults.map((result) => result.status === 'fulfilled'
      ? { status: 'fulfilled', rallyStatus: result.value.status }
      : { status: 'rejected', httpStatus: result.reason.status }));

    await testNestedTransactionRejected(db);
    await testExternalWritesWaitForTransaction(db);

    // Keep direct coverage of TriboRepository.create with a unique extra tribe.
    const triboCriada = await triboRepo.create({
      rally_id: rally.id,
      nome: "Tribo Extra de Teste",
      descricao: "Disposable tribe created for repository test",
      cor: "#3B82F6"
    });
    console.log(`Extra tribe created: ${triboCriada.nome} (ID: ${triboCriada.id})`);
    console.log("");
    // Testar busca de tribos por rally
    console.log('🔍 Buscando tribos do rally...');
    const tribos = await triboRepo.findByRally(rally.id);
    if (tribos.length !== 13) {
      throw new Error(`Esperadas 13 tribos no teste; recebidas ${tribos.length}`);
    }
    console.log(`✅ Encontradas ${tribos.length} tribos:`);
    tribos.forEach(t => console.log(`   - ${t.nome} (${t.total_participantes} participantes, ${t.pontuacao_total} pontos)`));
    console.log('');

    // Testar ranking
    console.log('🏆 Buscando ranking do rally...');
    const ranking = await triboRepo.getRanking(rally.id);
    console.log('✅ Ranking atual:');
    ranking.forEach((t, i) => console.log(`   ${i + 1}º - ${t.nome}: ${t.pontuacao_total} pontos`));
    console.log('');

    // Testar busca de rally ativo
    console.log('🔍 Buscando rally ativo...');
    const activeRally = await rallyRepo.findActive();
    console.log('✅ Rally ativo:', activeRally ? activeRally.nome : 'Nenhum', '\n');

    // Testar contagem
    console.log('📊 Contando rallies...');
    const count = await rallyRepo.countRallies();
    console.log(`✅ Total de rallies: ${count}\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Todos os testes passaram com sucesso!');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Fechar conexão
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ Erro nos testes');
    console.error('═══════════════════════════════════════════════════════════');
    console.error(error);
    console.error('═══════════════════════════════════════════════════════════\n');

    await db.close();
    process.exit(1);
  }
}

testRepositories();
