/**
 * Script de Teste das Rotas da API
 * Testa as rotas de rallies e tribos usando fetch
 */

const assert = require('assert');
const { verifyTestApiServer, getTestDatabase } = require('./test-support');
const { getDatabaseFingerprint, getOpenDatabaseFingerprint } = require('./connection');
let BASE_URL = null;

/**
 * Faz uma requisição HTTP usando fetch
 * @param {string} path - Caminho da rota
 * @param {string} method - Método HTTP
 * @param {Object} data - Dados para enviar (opcional)
 * @returns {Promise<Object>}
 */
async function request(path, method = 'GET', data = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  const responseData = await response.json();
  Object.defineProperty(responseData, '_httpStatus', { value: response.status });
  return responseData;
}

async function assertPersistedStatus(rallyId, expectedStatus) {
  const persisted = await request(`/rallies/${rallyId}`);
  assert.strictEqual(persisted._httpStatus, 200, 'Rally deve continuar acessivel apos a transicao');
  assert.strictEqual(persisted.data.status, expectedStatus, 'status persistido deve corresponder ao esperado');
}

async function assertRallyNotFound(rallyId) {
  const missing = await request(`/rallies/${rallyId}`);
  assert.strictEqual(missing._httpStatus, 404, 'Rally inexistente deve continuar inexistente');
}

async function testAPI() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Testando Rotas da API');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    BASE_URL = await verifyTestApiServer();
    // Teste 1: Listar rallies
    console.log('📋 Teste 1: Listar todos os rallies');
    const listarRallies = await request('/rallies');
    console.log(`Sucesso: ${listarRallies.success}`);
    console.log(`Total: ${listarRallies.total}`);
    console.log('');

    // Teste 2: Criar rally
    console.log('📝 Teste 2: Criar novo rally');
    const forcedActiveCreation = await request('/rallies', 'POST', {
      nome: 'Tentativa de criar Rally ativo diretamente',
      data_inicio: '2026-01-01',
      data_fim: '2026-03-31',
      status: 'ativo'
    });
    assert.strictEqual(forcedActiveCreation._httpStatus, 400, 'criação não deve iniciar Rally implicitamente');
    assert.strictEqual(forcedActiveCreation.success, false);
    const novoRally = await request('/rallies', 'POST', {
      nome: 'Rally 2026 - Jovens',
      descricao: 'Competição anual de jovens',
      data_inicio: '2026-01-01',
      data_fim: '2026-03-31'
    });
    console.log(`Sucesso: ${novoRally.success}`);
    console.log(`Mensagem: ${novoRally.message}`);
    assert.strictEqual(novoRally._httpStatus, 201, 'POST deve criar o rally');
    assert.strictEqual(novoRally.success, true);
    assert.strictEqual(novoRally.data.status, 'planejamento', 'novo rally deve iniciar em planejamento');
    assert.strictEqual(novoRally.data.tribos.length, 12, 'criação deve manter as 12 tribos oficiais');
    const rallyId = novoRally.data.id;
    await assertPersistedStatus(rallyId, 'planejamento');
    console.log(`Rally ID: ${rallyId}; status inicial: ${novoRally.data.status}`);

    const closeDuringPlanning = await request(`/rallies/${rallyId}/encerrar`, 'PATCH');
    assert.strictEqual(closeDuringPlanning._httpStatus, 400, 'Rally em planejamento não pode ser encerrado');
    await assertPersistedStatus(rallyId, 'planejamento');
    const archiveDuringPlanning = await request(`/rallies/${rallyId}/arquivar`, 'PATCH');
    assert.strictEqual(archiveDuringPlanning._httpStatus, 400, 'Rally em planejamento não pode ser arquivado');
    await assertPersistedStatus(rallyId, 'planejamento');
    const updateStatus = await request(`/rallies/${rallyId}`, 'PUT', { status: 'ativo' });
    assert.strictEqual(updateStatus._httpStatus, 400, 'PUT genérico não pode alterar status');
    assert.strictEqual(updateStatus.success, false);
    await assertPersistedStatus(rallyId, 'planejamento');

    const testDb = getTestDatabase();
    await testDb.connect();
    let missingTribo;
    try {
      const opened = (await testDb.all('PRAGMA database_list')).find((row) => row.name === 'main');
      const expectedFingerprint = getDatabaseFingerprint(process.env.RALLY_TEST_DB_PATH);
      assert(opened && await getOpenDatabaseFingerprint(testDb) === expectedFingerprint, 'setup não abriu o banco descartável configurado');
      missingTribo = await testDb.get(
        'SELECT id, rally_id, nome, descricao, cor FROM tribos WHERE rally_id = ? ORDER BY id LIMIT 1',
        [rallyId]
      );
      assert(missingTribo, 'tribo de setup não encontrada');
      const deletion = await testDb.run('DELETE FROM tribos WHERE id = ? AND rally_id = ?', [missingTribo.id, rallyId]);
      assert.strictEqual(deletion.changes, 1, 'setup deve remover somente uma tribo da cópia de teste');
    } finally {
      await testDb.close();
    }

    const startIncomplete = await request(`/rallies/${rallyId}/start`, 'PATCH');
    assert.strictEqual(startIncomplete._httpStatus, 400, 'início sem as 12 tribos deve falhar');
    assert.strictEqual(startIncomplete.success, false);
    await assertPersistedStatus(rallyId, 'planejamento');

    await testDb.connect();
    try {
      const opened = (await testDb.all('PRAGMA database_list')).find((row) => row.name === 'main');
      assert(opened && await getOpenDatabaseFingerprint(testDb) === getDatabaseFingerprint(process.env.RALLY_TEST_DB_PATH), 'reconexão de setup abriu banco inesperado');
      await testDb.run(
        'INSERT INTO tribos (id, rally_id, nome, descricao, cor) VALUES (?, ?, ?, ?, ?)',
        [missingTribo.id, missingTribo.rally_id, missingTribo.nome, missingTribo.descricao, missingTribo.cor]
      );
    } finally {
      await testDb.close();
    }

    const startRally = await request(`/rallies/${rallyId}/start`, 'PATCH');
    assert.strictEqual(startRally._httpStatus, 200, 'início deve funcionar com as 12 tribos oficiais');
    assert.strictEqual(startRally.success, true);
    assert.strictEqual(startRally.data.status, 'ativo');
    await assertPersistedStatus(rallyId, 'ativo');
    assert(startRally.message);

    assert.deepStrictEqual(Object.keys(startRally).sort(), ['data', 'message', 'success']);
    assert.strictEqual(startRally.data.id, rallyId);
    const cancelActive = await request(`/rallies/${rallyId}/cancelar`, 'PATCH');
    assert.strictEqual(cancelActive._httpStatus, 400, 'Rally ativo não pode ser cancelado');
    await assertPersistedStatus(rallyId, 'ativo');
    const startAgain = await request(`/rallies/${rallyId}/start`, 'PATCH');
    assert.strictEqual(startAgain._httpStatus, 400, 'não deve iniciar um rally já iniciado');
    assert.strictEqual(startAgain.success, false);
    await assertPersistedStatus(rallyId, 'ativo');

    for (const [path, label] of [
      ['/rallies/999999999/encerrar', 'encerrar'],
      ['/rallies/999999999/arquivar', 'arquivar'],
      ['/rallies/999999999/cancelar', 'cancelar']
    ]) {
      const response = await request(path, 'PATCH');
      assert.strictEqual(response._httpStatus, 404, `ID inexistente em ${label} deve retornar 404`);
      assert.strictEqual(response.success, false);
      await assertRallyNotFound(999999999);
    }
    await assertRallyNotFound(999999999);
    const missingRally = await request('/rallies/999999999/start', 'PATCH');
    assert.strictEqual(missingRally._httpStatus, 404, 'ID inexistente deve retornar 404');
    assert.strictEqual(missingRally.success, false);
    await assertRallyNotFound(999999999);
    console.log(`Rally ID: ${rallyId}`);
    console.log('');

    // Teste 3: Buscar rally por ID
    console.log('🔍 Teste 3: Buscar rally por ID');
    const buscarRally = await request(`/rallies/${rallyId}`);
    console.log(`Sucesso: ${buscarRally.success}`);
    console.log(`Nome: ${buscarRally.data.nome}`);
    console.log('');

    // Teste 4: Buscar rally ativo
    console.log('🔍 Teste 4: Buscar rally ativo');
    const rallyAtivo = await request('/rallies/ativo');
    console.log(`Sucesso: ${rallyAtivo.success}`);
    console.log(`Nome: ${rallyAtivo.data.nome}`);
    console.log('');

    // Teste 5: Reutilizar as tribos oficiais criadas junto com o Rally
    console.log('Teste 5: Reutilizar as tribos oficiais');
    const tribosCriadas = novoRally.data.tribos || [];
    assert.strictEqual(tribosCriadas.length, 12);
    console.log(`Rally possui ${tribosCriadas.length} tribos oficiais`);
    console.log('');
    // Teste 6: Listar tribos do rally
    console.log('📋 Teste 6: Listar tribos do rally');
    const tribosRally = await request(`/tribos/rally/${rallyId}`);
    console.log(`Sucesso: ${tribosRally.success}`);
    console.log(`Total: ${tribosRally.total}`);
    console.log('');

    // Teste 7: Buscar ranking
    console.log('🏆 Teste 7: Buscar ranking do rally');
    const ranking = await request(`/tribos/ranking/${rallyId}`);
    console.log(`Sucesso: ${ranking.success}`);
    console.log(`Total: ${ranking.total}`);
    ranking.data.forEach((t, i) => {
      console.log(`   ${i + 1}º - ${t.nome}: ${t.pontuacao_total} pontos`);
    });
    console.log('');

    // Teste 8: Buscar tribo por ID
    console.log('🔍 Teste 8: Buscar tribo por ID');
    const triboId = tribosCriadas[0].id;
    const buscarTribo = await request(`/tribos/${triboId}`);
    console.log(`Sucesso: ${buscarTribo.success}`);
    console.log(`Nome: ${buscarTribo.data.nome}`);
    console.log('');

    // Teste 9: Atualizar tribo
    console.log('✏️  Teste 9: Atualizar tribo');
    const atualizarTribo = await request(`/tribos/${triboId}`, 'PUT', {
      nome: 'Judá - Tribo de Leão',
      cor: '#F59E0B'
    });
    console.log(`Sucesso: ${atualizarTribo.success}`);
    console.log(`Mensagem: ${atualizarTribo.message}`);
    console.log('');

    // Teste 10: Atualizar rally
    console.log('✏️  Teste 10: Atualizar rally');
    const atualizarRally = await request(`/rallies/${rallyId}`, 'PUT', {
      descricao: 'Competição anual de jovens - 2026'
    });
    console.log(`Sucesso: ${atualizarRally.success}`);
    console.log(`Mensagem: ${atualizarRally.message}`);
    console.log('');

    // Teste 11: Tentar deletar rally com dados (deve falhar)
    console.log('🗑️  Teste 11: Tentar deletar rally com tribos (deve falhar)');
    const deletarRally = await request(`/rallies/${rallyId}`, 'DELETE');
    console.log(`Sucesso: ${deletarRally.success}`);
    if (!deletarRally.success) {
      console.log(`Erro esperado: ${deletarRally.error}`);
    }
    console.log('');

    // Teste 12: Bloquear arquivamento antes do encerramento
    console.log('📦 Teste 12: Arquivamento exige Rally encerrado');
    const arquivarAtivo = await request(`/rallies/${rallyId}/arquivar`, 'PATCH');
    assert.strictEqual(arquivarAtivo._httpStatus, 400, 'Rally ativo não pode ser arquivado');
    assert.strictEqual(arquivarAtivo.success, false);
    await assertPersistedStatus(rallyId, 'ativo');

    // Teste 13: Encerrar somente Rally ativo
    const encerrarRally = await request(`/rallies/${rallyId}/encerrar`, 'PATCH');
    assert.strictEqual(encerrarRally._httpStatus, 200, 'Rally ativo deve poder ser encerrado');
    assert.strictEqual(encerrarRally.data.status, 'encerrado');
    await assertPersistedStatus(rallyId, 'encerrado');
    const encerrarNovamente = await request(`/rallies/${rallyId}/encerrar`, 'PATCH');
    assert.strictEqual(encerrarNovamente._httpStatus, 400, 'Rally encerrado não pode ser encerrado novamente');
    await assertPersistedStatus(rallyId, 'encerrado');

    // Teste 14: Arquivar somente Rally encerrado
    console.log('📦 Teste 14: Arquivar Rally encerrado');
    const arquivarRally = await request(`/rallies/${rallyId}/arquivar`, 'PATCH');
    assert.strictEqual(arquivarRally._httpStatus, 200);
    assert.strictEqual(arquivarRally.success, true);
    assert.strictEqual(arquivarRally.data.status, 'arquivado');
    await assertPersistedStatus(rallyId, 'arquivado');
    for (const [path, label] of [
      [`/rallies/${rallyId}/start`, 'iniciar'],
      [`/rallies/${rallyId}/encerrar`, 'encerrar'],
      [`/rallies/${rallyId}/cancelar`, 'cancelar']
    ]) {
      const response = await request(path, 'PATCH');
      assert.strictEqual(response._httpStatus, 400, `Rally arquivado não pode ${label}`);
      await assertPersistedStatus(rallyId, 'arquivado');
    }
    const arquivarNovamente = await request(`/rallies/${rallyId}/arquivar`, 'PATCH');
    assert.strictEqual(arquivarNovamente._httpStatus, 400, 'Rally arquivado não pode ser arquivado novamente');
    await assertPersistedStatus(rallyId, 'arquivado');

    // Teste 15: Cancelar somente Rally em planejamento
    const rallyParaCancelar = await request('/rallies', 'POST', {
      nome: 'Rally descartável para teste de cancelamento',
      data_inicio: '2026-04-01',
      data_fim: '2026-06-30'
    });
    assert.strictEqual(rallyParaCancelar._httpStatus, 201);
    const cancelarRally = await request(`/rallies/${rallyParaCancelar.data.id}/cancelar`, 'PATCH');
    assert.strictEqual(cancelarRally._httpStatus, 200);
    assert.strictEqual(cancelarRally.data.status, 'cancelado');
    await assertPersistedStatus(rallyParaCancelar.data.id, 'cancelado');
    const cancelarNovamente = await request(`/rallies/${rallyParaCancelar.data.id}/cancelar`, 'PATCH');
    assert.strictEqual(cancelarNovamente._httpStatus, 400, 'Rally cancelado não pode ser cancelado novamente');
    await assertPersistedStatus(rallyParaCancelar.data.id, 'cancelado');
    for (const [path, label] of [
      [`/rallies/${rallyParaCancelar.data.id}/encerrar`, 'encerrado'],
      [`/rallies/${rallyParaCancelar.data.id}/arquivar`, 'arquivado']
    ]) {
      const response = await request(path, 'PATCH');
      assert.strictEqual(response._httpStatus, 400, `Rally cancelado não pode ser ${label}`);
      await assertPersistedStatus(rallyParaCancelar.data.id, 'cancelado');
    }
    const iniciarCancelado = await request(`/rallies/${rallyParaCancelar.data.id}/start`, 'PATCH');
    assert.strictEqual(iniciarCancelado._httpStatus, 400, 'Rally cancelado não pode ser iniciado');
    await assertPersistedStatus(rallyParaCancelar.data.id, 'cancelado');

    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Todos os testes passaram com sucesso!');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ Erro nos testes');
    console.error('═══════════════════════════════════════════════════════════');
    console.error(error);
    console.error('═══════════════════════════════════════════════════════════\n');

    process.exit(1);
  }
}

testAPI();
