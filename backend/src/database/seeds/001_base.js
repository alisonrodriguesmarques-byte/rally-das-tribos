const bcrypt = require('bcryptjs');
const config = require('../../config');
 
const TRIBOS = [
  ['Rúben', 'ruben', '#c0392b'], ['Simeão', 'simeao', '#16a085'], ['Levi', 'levi', '#7f8c8d'],
  ['Judá', 'juda', '#d4a017'], ['Dã', 'da', '#2c3e50'], ['Naftali', 'naftali', '#27ae60'],
  ['Gade', 'gade', '#8e44ad'], ['Aser', 'aser', '#e67e22'], ['Issacar', 'issacar', '#2980b9'],
  ['Zebulom', 'zebulom', '#1abc9c'], ['José', 'jose', '#9b59b6'], ['Benjamim', 'benjamim', '#e74c3c'],
];
 
const CATEGORIAS = [
  'Quiz', 'Complete o versículo', 'Verdadeiro ou falso', 'Dinâmica', 'Evangelização',
  'Presença', 'Convidados', 'Organização', 'Missões especiais', 'Outros',
];
 
// Idempotente: só insere o que ainda não existe, nunca apaga dados.
exports.seed = async function seed(knex) {
  for (const [i, [nome, slug, cor]] of TRIBOS.entries()) {
    const existe = await knex('tribos').where({ slug }).first();
    if (!existe) await knex('tribos').insert({ nome, slug, cor, ordem: i + 1 });
  }
 
  for (const nome of CATEGORIAS) {
    const existe = await knex('categorias').where({ nome }).first();
    if (!existe) await knex('categorias').insert({ nome });
  }
 
  const temAdmin = await knex('usuarios').where({ papel: 'admin' }).first();
  if (!temAdmin) {
    if (!config.admin.senha || config.admin.senha.length < 8) {
      throw new Error('Defina ADMIN_PASSWORD com pelo menos 8 caracteres para criar o administrador.');
    }
    const [pessoa] = await knex('pessoas').insert({ nome_completo: config.admin.nome }).returning('id');
    await knex('usuarios').insert({
      pessoa_id: pessoa.id ?? pessoa,
      email: config.admin.email,
      senha_hash: await bcrypt.hash(config.admin.senha, 10),
      papel: 'admin',
    });
  }
};
