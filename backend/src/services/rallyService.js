const db = require('../database/connection');
const rallyRepo = require('../repositories/rallyRepo');
const triboRepo = require('../repositories/triboRepo');
const { naoEncontrado, conflito, requisicaoInvalida, proibido } = require('../utils/http');
const auditoria = require('../repositories/auditoriaRepo');
const { agora } = require('../utils/db');
const { paraData } = require('../utils/datas');
 
async function obter(id, trx = db) {
  const rally = await rallyRepo.obter(id, trx);
  if (!rally) throw naoEncontrado('Rally não encontrado.');
  return { ...rally, data_inicio: paraData(rally.data_inicio), data_fim: paraData(rally.data_fim) };
}
 
/** Garante que o rally existe e não está encerrado (rally encerrado é somente leitura). */
async function exigirEditavel(rallyId, trx = db) {
  const rally = await obter(rallyId, trx);
  if (rally.arquivado_em) throw conflito('Este rally está arquivado e é somente leitura.');
  if (rally.status === 'encerrado') {
    throw conflito('Este rally está encerrado e não pode mais ser alterado. Reabra-o para editar.');
  }
  return rally;
}
 
async function listar(incluirArquivados = false) {
  const lista = await rallyRepo.listar(db, incluirArquivados);
  return lista.map((r) => ({ ...r, data_inicio: paraData(r.data_inicio), data_fim: paraData(r.data_fim) }));
}
 
async function atual() {
  const r = await rallyRepo.atual();
  return r ? obter(r.id) : null;
}
 
/**
 * Cria o rally apenas com as tribos selecionadas pelo administrador. Por padrão copia cabeça e auxiliar do rally
 * anterior; opcionalmente copia também os participantes ativos.
 */
async function criar(dados, usuario) {
  if (dados.data_fim < dados.data_inicio) throw requisicaoInvalida('A data final deve ser depois da inicial.');
  return db.transaction(async (trx) => {
    const ids = dados.tribos;
    if (!Array.isArray(ids) || !ids.length || ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      throw requisicaoInvalida('Selecione pelo menos uma tribo válida, sem repetições.', { tribos: 'Selecione as tribos participantes.' });
    }
    const catalogo = await triboRepo.listarCatalogo(trx);
    const selecionadas = catalogo.filter((t) => ids.includes(t.id));
    if (selecionadas.length !== ids.length) throw requisicaoInvalida('Uma das tribos selecionadas não existe no catálogo.');
    const id = await rallyRepo.criar({
      nome: dados.nome, data_inicio: dados.data_inicio, data_fim: dados.data_fim,
      status: dados.status || 'planejado', criado_por: usuario.id,
    }, trx);
    const anterior = await rallyRepo.anteriorA(id, trx);
    const tribosAnteriores = anterior ? await triboRepo.listarDoRally(anterior.id, trx) : [];
    const idsPessoasAtivas = new Set((await trx('pessoas').whereNull('excluido_em').where({ ativo: true }).select('id')).map(p => p.id));
    const porTribo = Object.fromEntries(tribosAnteriores.map((t) => [t.tribo_id, t]));
    const membrosAnteriores = anterior && dados.copiar_participantes
      ? await triboRepo.listarMembrosAtivosDoRally(anterior.id, trx) : [];
 
    for (const tribo of selecionadas) {
      const ant = dados.copiar_lideres !== false ? porTribo[tribo.id] : null;
      const rtId = await triboRepo.criar({
        rally_id: id, tribo_id: tribo.id,
        cabeca_pessoa_id: idsPessoasAtivas.has(ant?.cabeca_pessoa_id) ? ant.cabeca_pessoa_id : null,
        auxiliar_pessoa_id: idsPessoasAtivas.has(ant?.auxiliar_pessoa_id) ? ant.auxiliar_pessoa_id : null,
      }, trx);
      for (const m of membrosAnteriores.filter((x) => x.tribo_id === tribo.id && idsPessoasAtivas.has(x.pessoa_id))) {
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
  return db.transaction(async trx => {
    const query = trx('rallies').where({ id });
    if (trx.client.config.client === 'pg') query.forUpdate();
    const rally = await query.first();
    if (!rally) throw naoEncontrado('Rally não encontrado.');
    if (rally.arquivado_em) throw conflito('Desarquive este rally antes de alterar sua situação.');
    const fim = dados.data_fim || paraData(rally.data_fim);
    const inicio = dados.data_inicio || paraData(rally.data_inicio);
    if (fim < inicio) throw requisicaoInvalida('A data final deve ser depois da inicial.');
    if (rally.status === 'encerrado' && Object.keys(dados).some(k => k !== 'status')) {
      throw conflito('Rally encerrado: reabra-o (status) antes de editar.');
    }
    await rallyRepo.atualizar(id, dados, trx);
    if (dados.status === 'ativo') await desativarOutros(id, trx);
    return obter(id, trx);
  });
}

async function arquivar(id, usuario, arquivar = true) {
  if (!usuario?.admin) throw proibido('Apenas administradores podem arquivar rallies.');
  return db.transaction(async trx => {
    const query = trx('rallies').where({ id });
    if (trx.client.config.client === 'pg') query.forUpdate();
    const rally = await query.first();
    if (!rally) throw naoEncontrado('Rally não encontrado.');
    if (rally.status !== 'encerrado') throw conflito('Encerre o rally antes de arquivá-lo.');
    if (Boolean(rally.arquivado_em) === arquivar) throw conflito(arquivar ? 'Este rally já está arquivado.' : 'Este rally não está arquivado.');
    const dados = { arquivado_em: arquivar ? agora() : null, arquivado_por: arquivar ? usuario.id : null };
    await rallyRepo.atualizar(id, dados, trx);
    await auditoria.registrar({ entidade: 'rallies', entidadeId: id, acao: arquivar ? 'arquivar' : 'desarquivar', usuarioId: usuario.id,
      antes: { arquivado_em: rally.arquivado_em }, depois: dados }, trx);
    return obter(id, trx);
  });
}
module.exports = { obter, exigirEditavel, listar, atual, criar, atualizar, arquivar };
