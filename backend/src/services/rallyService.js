const db = require('../database/connection');
const rallyRepo = require('../repositories/rallyRepo');
const triboRepo = require('../repositories/triboRepo');
const { naoEncontrado, conflito, requisicaoInvalida } = require('../utils/http');
const { paraData } = require('../utils/datas');
 
async function obter(id, trx = db) {
  const rally = await rallyRepo.obter(id, trx);
  if (!rally) throw naoEncontrado('Rally não encontrado.');
  return { ...rally, data_inicio: paraData(rally.data_inicio), data_fim: paraData(rally.data_fim) };
}
 
/** Garante que o rally existe e não está encerrado (rally encerrado é somente leitura). */
async function exigirEditavel(rallyId, trx = db) {
  const rally = await obter(rallyId, trx);
  if (rally.status === 'encerrado') {
    throw conflito('Este rally está encerrado e não pode mais ser alterado. Reabra-o para editar.');
  }
  return rally;
}
 
async function listar() {
  const lista = await rallyRepo.listar();
  return lista.map((r) => ({ ...r, data_inicio: paraData(r.data_inicio), data_fim: paraData(r.data_fim) }));
}
 
async function atual() {
  const r = await rallyRepo.atual();
  return r ? obter(r.id) : null;
}
 
/**
 * Cria o rally e as 13 tribos dele. Por padrão copia cabeça e auxiliar do rally
 * anterior; opcionalmente copia também os participantes ativos.
 */
async function criar(dados, usuario) {
  if (dados.data_fim < dados.data_inicio) throw requisicaoInvalida('A data final deve ser depois da inicial.');
  return db.transaction(async (trx) => {
    const id = await rallyRepo.criar({
      nome: dados.nome, data_inicio: dados.data_inicio, data_fim: dados.data_fim,
      status: dados.status || 'planejado', criado_por: usuario.id,
    }, trx);
    const anterior = await rallyRepo.anteriorA(id, trx);
    const tribosAnteriores = anterior ? await triboRepo.listarDoRally(anterior.id, trx) : [];
    const porTribo = Object.fromEntries(tribosAnteriores.map((t) => [t.tribo_id, t]));
    const membrosAnteriores = anterior && dados.copiar_participantes
      ? await triboRepo.listarMembrosAtivosDoRally(anterior.id, trx) : [];
 
    for (const tribo of await triboRepo.listarCatalogo(trx)) {
      const ant = dados.copiar_lideres !== false ? porTribo[tribo.id] : null;
      const rtId = await triboRepo.criar({
        rally_id: id, tribo_id: tribo.id,
        cabeca_pessoa_id: ant?.cabeca_pessoa_id || null,
        auxiliar_pessoa_id: ant?.auxiliar_pessoa_id || null,
      }, trx);
      for (const m of membrosAnteriores.filter((x) => x.tribo_id === tribo.id)) {
        await triboRepo.criarMembro({ rally_tribo_id: rtId, pessoa_id: m.pessoa_id }, trx);
      }
    }
    if (dados.status === 'ativo') await desativarOutros(id, trx);
    return obter(id, trx);
  });
}
 
async function desativarOutros(id, trx) {
  await trx('rallies').whereNot({ id }).where({ status: 'ativo' }).update({ status: 'encerrado' });
}
 
async function atualizar(id, dados) {
  const rally = await obter(id);
  const fim = dados.data_fim || rally.data_fim;
  const inicio = dados.data_inicio || rally.data_inicio;
  if (fim < inicio) throw requisicaoInvalida('A data final deve ser depois da inicial.');
  if (rally.status === 'encerrado' && Object.keys(dados).some((k) => k !== 'status')) {
    throw conflito('Rally encerrado: reabra-o (status) antes de editar.');
  }
  return db.transaction(async (trx) => {
    await rallyRepo.atualizar(id, dados, trx);
    if (dados.status === 'ativo') await desativarOutros(id, trx);
    return obter(id, trx);
  });
}
 
module.exports = { obter, exigirEditavel, listar, atual, criar, atualizar };
