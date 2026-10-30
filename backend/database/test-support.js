/**
 * Safety checks shared by tests. HTTP tests verify the identity of the database
 * opened by the server before making any request that could write data.
 */
const { getDatabase, getTestDatabasePath, getDatabaseFingerprint } = require('./connection');

function assertTestMode() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Defina NODE_ENV=test antes de executar testes');
  }
  getTestDatabasePath();
}

function getTestDatabase() {
  assertTestMode();
  return getDatabase();
}

function getTestApiBaseUrl() {
  assertTestMode();
  const configuredUrl = process.env.RALLY_TEST_API_URL;
  if (!configuredUrl) {
    throw new Error('RALLY_TEST_API_URL deve apontar explicitamente para o servidor de teste');
  }

  let url;
  try {
    url = new URL(configuredUrl);
  } catch (error) {
    throw new Error('RALLY_TEST_API_URL nao e uma URL valida');
  }

  const localHosts = ['localhost', '127.0.0.1', '[::1]'];
  if (url.protocol !== 'http:' || !localHosts.includes(url.hostname)) {
    throw new Error('O servidor de teste HTTP precisa estar em loopback local');
  }
  if (
    url.pathname.replace(/\/+$/, '') !== '/api' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('RALLY_TEST_API_URL deve terminar em /api, sem credenciais ou parametros');
  }

  url.pathname = '/api';
  return url.toString().replace(/\/$/, '');
}

async function verifyTestApiServer() {
  const baseUrl = getTestApiBaseUrl();
  const expectedFingerprint = getDatabaseFingerprint(getTestDatabasePath());

  let response;
  try {
    response = await fetch(baseUrl + '/health');
  } catch (error) {
    throw new Error('Nao foi possivel consultar o servidor de teste local');
  }
  if (!response.ok) {
    throw new Error('Servidor de teste respondeu com HTTP ' + response.status);
  }

  let health;
  try {
    health = await response.json();
  } catch (error) {
    throw new Error('O servidor nao retornou uma identificacao valida do banco de teste');
  }
  if (
    health.databaseMode !== 'test' ||
    health.databaseFingerprint !== expectedFingerprint
  ) {
    throw new Error(
      'O servidor HTTP nao confirmou que abriu o banco descartavel configurado; nenhum teste foi iniciado'
    );
  }

  return baseUrl;
}

module.exports = {
  assertTestMode,
  getTestDatabase,
  getTestApiBaseUrl,
  verifyTestApiServer
};