const missoesService = require('../services/missoesService');
const missaoRepo = require('../repositories/missaoRepo');
const { validar } = require('../utils/validar');
const { idParam, contexto } = require('./_helpers');
const { naoEncontrado } = require('../utils/http');
 
const SPEC = {
  titulo: 'texto!', descricao: 'texto', observacoes: 'texto', data_inicio: 'data!', data_limite: 'data',
  tipo_pontuacao: ['fixa', 'quantidade', 'meta', 'manual'], pontos: 'inteiro', meta_quantidade: 'inteiro',
  limite_por_tribo: 'inteiro', requer_aprovacao: 'bool', categoria_id: 'id', status: ['aberta', 'encerrada', 'cancelada'], tribos: 'lista',
};
 
async function ctxDaMissao(req, missaoId) {
  const m = await missaoRepo.obter(missaoId);
  if (!m) throw naoEncontrado('Missão não encontrada.');
  return contexto(req, m.rally_id);
}
 
module.exports = {
  async listar(req, res) {
    const rallyId = idParam(req);
    res.json(await missoesService.listar(rallyId, await contexto(req, rallyId), { status: req.query.status }));
  },
  async criar(req, res) {
    const dados = validar(req.body, SPEC);
    if (!dados.tipo_pontuacao) dados.tipo_pontuacao = 'fixa';
    res.status(201).json({ id: await missoesService.criar(idParam(req), dados, req.usuario) });
  },
  async obter(req, res) {
    const id = idParam(req);
    res.json(await missoesService.obter(id, await ctxDaMissao(req, id)));
  },
  async atualizar(req, res) {
    await missoesService.atualizar(idParam(req), validar(req.body, SPEC, { parcial: true }));
    res.json({ ok: true });
  },
  async enviarEntrega(req, res) {
    const id = idParam(req);
    const dados = validar(req.body, {
      rally_tribo_id: 'id', quantidade: 'inteiro', pontos_manual: 'inteiro', evidencia_url: 'texto', observacao: 'texto', aprovar: 'bool',
    });
    res.status(201).json({ id: await missoesService.enviarEntrega(id, dados, req.usuario, await ctxDaMissao(req, id)) });
  },
  async aprovar(req, res) {
    const ajustes = validar(req.body, { quantidade: 'inteiro', pontos_manual: 'inteiro', observacao_admin: 'texto' }, { parcial: true });
    res.json({ pontos: await missoesService.aprovarEntrega(idParam(req), ajustes, req.usuario) });
  },
  async rejeitar(req, res) {
    await missoesService.rejeitarEntrega(idParam(req), req.body?.motivo, req.usuario);
    res.json({ ok: true });
  },
  async pendentes(req, res) { res.json(await missoesService.pendentes(idParam(req))); },
};
