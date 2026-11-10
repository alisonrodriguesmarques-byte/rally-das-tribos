const db = require('../database/connection');
const { inserir } = require('../utils/db');
 
const listar = (trx = db) => trx('categorias').orderBy('nome');
const obter = (id, trx = db) => trx('categorias').where({ id }).first();
const porNome = (nome, trx = db) => trx('categorias').where({ nome }).first();
const criar = (dados, trx = db) => inserir(trx, 'categorias', dados);
const atualizar = (id, dados, trx = db) => trx('categorias').where({ id }).update(dados);
 
module.exports = { listar, obter, porNome, criar, atualizar };
