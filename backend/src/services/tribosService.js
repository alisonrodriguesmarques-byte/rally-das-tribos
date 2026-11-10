const db = require('../database/connection');
const triboRepo = require('../repositories/triboRepo');
const pessoaRepo = require('../repositories/pessoaRepo');
const lancamentoRepo = require('../repositories/lancamentoRepo');
const auditoria = require('../repositories/auditoriaRepo');
const rallyService = require('./rallyService');
const rankingService = require('./rankingService');
const { naoEncontrado, conflito, requisicaoInvalida } = require('../utils/http');
const { agora } = require('../utils/db');
 
async function listar(rallyId, ctx = { admin: false }) {
  await rallyService.obter(rallyId);
  if (!ctx.admin) return triboRepo.listarDoRally(rallyId);
  const [tribos, ranking] = await Promise.all([triboRepo.listarDoRally(rallyId), rankingService.ranking(rallyId)]);
  const pos = Object.fromEntries(ranking.map((r) => [r.rally_tribo_id, r]));
  return tribos.map((t) => ({ ...t, pontos: pos[t.id]?.pontos || 0, posicao: pos[t.id]?.posicao }));
}
 
async function obterOuFalhar(id, trx = db) {
  const rt = await triboRepo.obter(id, trx);
  if (!rt) throw naoEncontrado('Tribo não encontrada neste rally.');
  return rt;
}
 
async function perfil(id, ctx) {
  const rt = await obterOuFalhar(id);
  const ranking = ctx.admin ? await rankingService.ranking(rt.rally_id) : [];
  const minha = ranking.find((r) => r.rally_tribo_id === rt.id);
  const podeVerDetalhes = ctx.admin || Number(ctx.rallyTriboId) === rt.id;
  const [membros, porCategoria, historico] = await Promise.all([
    triboRepo.listarMembros(id),
    ctx.admin ? lancamentoRepo.porCategoria(rt.rally_id, rt.id) : [],
    ctx.admin ? lancamentoRepo.listar(rt.rally_id, { rally_tribo_id: rt.id, status: 'ativo', limite: 200 }) : [],
  ]);
  return {
    ...rt,
    ...(ctx.admin ? { pontos: minha?.pontos || 0, posicao: minha?.posicao } : {}),
    total_tribos: ranking.length,
    participantes: membros.length,
    membros: podeVerDetalhes ? membros : membros.map((m) => ({ id: m.id, apelido: m.apelido, nome_completo: m.nome_completo })),
    por_categoria: porCategoria.map((c) => ({ ...c, pontos: Number(c.pontos) })),
    historico,
  };
}
 
async function definirLideranca(id, dados, usuario) {
  const rt = await obterOuFalhar(id);
  await rallyService.exigirEditavel(rt.rally_id);
  for (const campo of ['cabeca_pessoa_id', 'auxiliar_pessoa_id']) {
    if (dados[campo] && !(await pessoaRepo.obter(dados[campo]))) throw requisicaoInvalida('Pessoa não encontrada.');
  }
  if (dados.cabeca_pessoa_id && dados.cabeca_pessoa_id === dados.auxiliar_pessoa_id) {
    throw requisicaoInvalida('Cabeça e auxiliar precisam ser pessoas diferentes.');
  }
  await db.transaction(async (trx) => {
    await triboRepo.atualizar(id, dados, trx);
    await auditoria.registrar({
      entidade: 'rally_tribos', entidadeId: id, acao: 'alterar_lideranca', usuarioId: usuario.id,
      antes: { cabeca_pessoa_id: rt.cabeca_pessoa_id, auxiliar_pessoa_id: rt.auxiliar_pessoa_id },
      depois: dados,
    }, trx);
  });
  return triboRepo.obter(id);
}
 
async function adicionarMembro(rallyTriboId, pessoaId, usuario, trx = null) {
  const executar = async (t) => {
    const rt = await obterOuFalhar(rallyTriboId, t);
    await rallyService.exigirEditavel(rt.rally_id, t);
    const pessoa = await pessoaRepo.obter(pessoaId, t);
    if (!pessoa) throw requisicaoInvalida('Pessoa não encontrada.');
    const atual = await triboRepo.membroAtivoNoRally(pessoaId, rt.rally_id, t);
    if (atual) {
      if (atual.rally_tribo_id === rt.id) throw conflito(`${pessoa.nome_completo} já está nesta tribo.`);
      throw conflito(`${pessoa.nome_completo} já está na tribo de ${atual.tribo_nome}. Use "Transferir".`);
    }
    const id = await triboRepo.criarMembro({ rally_tribo_id: rt.id, pessoa_id: pessoaId, entrou_em: agora() }, t);
    await auditoria.registrar({
      entidade: 'pessoas', entidadeId: pessoaId, acao: 'entrar_tribo', usuarioId: usuario.id,
      depois: { tribo: rt.nome, rally_tribo_id: rt.id },
    }, t);
    return id;
  };
  return trx ? executar(trx) : db.transaction(executar);
}
 
async function removerMembro(membroId, motivo, usuario) {
  const m = await triboRepo.obterMembro(membroId);
  if (!m || m.status !== 'ativo') throw naoEncontrado('Participante não está ativo nesta tribo.');
  const rt = await obterOuFalhar(m.rally_tribo_id);
  await rallyService.exigirEditavel(rt.rally_id);
  await db.transaction(async (trx) => {
    await triboRepo.atualizarMembro(membroId, { status: 'inativo', saiu_em: agora(), motivo_saida: motivo || 'remocao' }, trx);
    await auditoria.registrar({
      entidade: 'pessoas', entidadeId: m.pessoa_id, acao: 'sair_tribo', usuarioId: usuario.id,
      antes: { tribo: rt.nome }, depois: { motivo: motivo || 'remocao' },
    }, trx);
  });
}
 
async function transferir(membroId, destinoId, usuario) {
  const m = await triboRepo.obterMembro(membroId);
  if (!m || m.status !== 'ativo') throw naoEncontrado('Participante não está ativo nesta tribo.');
  const origem = await obterOuFalhar(m.rally_tribo_id);
  const destino = await obterOuFalhar(destinoId);
  if (origem.rally_id !== destino.rally_id) throw requisicaoInvalida('A tribo de destino é de outro rally.');
  if (origem.id === destino.id) throw requisicaoInvalida('Escolha uma tribo diferente.');
  await rallyService.exigirEditavel(origem.rally_id);
  return db.transaction(async (trx) => {
    await triboRepo.atualizarMembro(membroId, { status: 'inativo', saiu_em: agora(), motivo_saida: 'transferencia' }, trx);
    const novo = await triboRepo.criarMembro({ rally_tribo_id: destino.id, pessoa_id: m.pessoa_id, entrou_em: agora() }, trx);
    await auditoria.registrar({
      entidade: 'pessoas', entidadeId: m.pessoa_id, acao: 'transferir', usuarioId: usuario.id,
      antes: { tribo: origem.nome }, depois: { tribo: destino.nome },
    }, trx);
    return novo;
  });
}
 
module.exports = { listar, perfil, definirLideranca, adicionarMembro, removerMembro, transferir, obterOuFalhar };
