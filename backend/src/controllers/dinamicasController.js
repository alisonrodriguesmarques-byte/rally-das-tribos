const dinamicasService = require('../services/dinamicasService');
const { validar } = require('../utils/validar');
const { idParam, contexto } = require('./_helpers');
 
const SPEC = {
  rally_tribo_id: 'id!', titulo: 'texto!', tema: 'texto', descricao: 'texto', data_encontro: 'data',
  responsavel_pessoa_id: 'id', pontos_previstos: 'inteiro', categoria_id: 'id', missao_id: 'id',
  resultado: 'texto', evidencia_url: 'texto', observacao_admin: 'texto',
};
 
module.exports = {
  async listar(req, res) {
    const rallyId = idParam(req);
    res.json(await dinamicasService.listar(rallyId, await contexto(req, rallyId), req.query));
  },
  async criar(req, res) {
    res.status(201).json({ id: await dinamicasService.criar(idParam(req), validar(req.body, SPEC)) });
  },
  async atualizar(req, res) {
    const d = await dinamicasService.obter(idParam(req));
    res.json(await dinamicasService.atualizar(d.id, validar(req.body, SPEC, { parcial: true }), await contexto(req, d.rally_id)));
  },
  async status(req, res) {
    const d = await dinamicasService.obter(idParam(req));
    const dados = validar(req.body, {
      status: ['pendente', 'enviada', 'aprovada', 'realizada', 'nao_realizada'], pontos: 'inteiro', resultado: 'texto', observacao_admin: 'texto',
    });
    res.json(await dinamicasService.alterarStatus(d.id, dados, req.usuario, await contexto(req, d.rally_id)));
  },
};
