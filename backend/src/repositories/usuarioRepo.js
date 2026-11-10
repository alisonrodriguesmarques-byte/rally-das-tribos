const db = require('../database/connection');
const { inserir } = require('../utils/db');
 
const porEmail = (email, trx = db) => trx('usuarios').whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first();
const porId = (id, trx = db) => trx('usuarios').where({ id }).first();
const porPessoa = (pessoaId, trx = db) => trx('usuarios').where({ pessoa_id: pessoaId }).first();
const criar = (dados, trx = db) => inserir(trx, 'usuarios', dados);
const atualizar = (id, dados, trx = db) => trx('usuarios').where({ id }).update(dados);
 
module.exports = { porEmail, porId, porPessoa, criar, atualizar };
