'use strict';

const readline = require('readline/promises');
const { getDatabase } = require('../backend/database/connection');
const { assertSchemaReady } = require('../backend/database/init');
const { bootstrapAdmin } = require('../backend/services/bootstrapService');

async function hiddenQuestion(label) {
  process.stdout.write(label);
  process.stdin.setEncoding('utf8');
  const wasRaw = Boolean(process.stdin.isRaw);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = '';
  try {
    return await new Promise((resolve, reject) => {
      function onData(chunk) {
        for (const character of chunk.toString('utf8')) {
          if (character === '\u0003' || character === '\u0004') { cleanup(); reject(new Error('Inicializacao cancelada.')); return; }
          if (character === '\r' || character === '\n') { cleanup(); resolve(value); return; }
          if (character === '\u007f' || character === '\b') value = [...value].slice(0, -1).join('');
          else if (character >= ' ') value += character;
          if (value.length > 1024) { cleanup(); reject(new Error('Entrada excedeu o limite.')); return; }
        }
      }
      function cleanup() { process.stdin.off('data', onData); }
      process.stdin.on('data', onData);
    });
  } finally {
    process.stdin.setRawMode(wasRaw);
    process.stdin.pause();
    process.stdout.write('\n');
  }
}

async function readJsonInput() {
  if (process.stdin.isTTY) throw new Error('--json exige entrada por stdin, nunca credenciais em argumentos.');
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > 8192) throw new Error('Entrada de inicializacao excedeu o limite.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Entrada JSON invalida.'); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--json')) {
    throw new Error('Uso: npm run bootstrap-admin (interativo) ou node scripts/bootstrap-admin.js --json (stdin).');
  }
  const expectedSecret = process.env.RALLY_BOOTSTRAP_SECRET;
  // Consume only a raw local CLI value. It is never stored or required by server.
  delete process.env.RALLY_BOOTSTRAP_SECRET;
  if (typeof expectedSecret !== 'string' || expectedSecret.length < 32 || expectedSecret.length > 1024) {
    throw new Error('Defina RALLY_BOOTSTRAP_SECRET local com 32 a 1024 caracteres; nunca envie valores no chat.');
  }
  let input;
  if (args[0] === '--json') input = await readJsonInput();
  else {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      throw new Error('Use terminal interativo ou --json com stdin seguro.');
    }
    const secret = await hiddenQuestion('Segredo de inicializacao (oculto): ');
    const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
    let name, email;
    try {
      name = await terminal.question('Nome do administrador: ');
      email = await terminal.question('Email do administrador: ');
    } finally { terminal.close(); }
    const password = await hiddenQuestion('Senha de 12 a 128 caracteres (oculta): ');
    const confirmation = await hiddenQuestion('Confirme a senha (oculta): ');
    if (password !== confirmation) throw new Error('As senhas nao coincidem.');
    input = { secret, nome_completo: name, email, password };
  }
  const db = getDatabase();
  try {
    await db.connect();
    await assertSchemaReady(db);
    await bootstrapAdmin(db, input, expectedSecret);
    console.log('Administrador inicial criado. Inicializacao consumida e registrada na auditoria.');
  } finally { await db.close(); }
}

main().catch(error => {
  // No stack, payload, SQL parameters, password, session or bootstrap secret.
  console.error(error.publicMessage || (error.code?.startsWith('SQLITE_') ? 'Inicializacao recusada pelo banco sintetico.' : error.message));
  process.exitCode = 1;
});
