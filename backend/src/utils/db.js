/** Insere e devolve o id, igual em SQLite e PostgreSQL. */
async function inserir(trx, tabela, dados) {
  const [linha] = await trx(tabela).insert(dados).returning('id');
  return typeof linha === 'object' ? linha.id : linha;
}
 
const agora = () => new Date().toISOString();
 
const num = (v) => (v === null || v === undefined ? 0 : Number(v));
 
module.exports = { inserir, agora, num };
