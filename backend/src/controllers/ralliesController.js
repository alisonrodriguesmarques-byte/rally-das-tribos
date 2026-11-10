const rallyService = require('../services/rallyService');
const tribosService = require('../services/tribosService');
const { validar } = require('../utils/validar');
const { idParam, contexto } = require('./_helpers');
 
const SPEC = {
  nome: 'texto!', data_inicio: 'data!', data_fim: 'data!', status: ['planejado', 'ativo', 'encerrado'],
  copiar_lideres: 'bool', copiar_participantes: 'bool',
};
 
module.exports = {
  async listar(_req, res) { res.json(await rallyService.listar()); },
  async atual(_req, res) { res.json(await rallyService.atual()); },
  async obter(req, res) {
    const id = idParam(req);
    const rally = await rallyService.obter(id);
    res.json({ ...rally, contexto: await contexto(req, id) });
  },
  async criar(req, res) { res.status(201).json(await rallyService.criar(validar(req.body, SPEC), req.usuario)); },
  async atualizar(req, res) {
    const { copiar_lideres: _a, copiar_participantes: _b, ...spec } = SPEC;
    res.json(await rallyService.atualizar(idParam(req), validar(req.body, spec, { parcial: true })));
  },
  async tribos(req, res) { res.json(await tribosService.listar(idParam(req), await contexto(req, idParam(req)))); },
};
