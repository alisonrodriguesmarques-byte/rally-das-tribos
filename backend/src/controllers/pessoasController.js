const pessoasService = require('../services/pessoasService');
const authService = require('../services/authService');
const { validar } = require('../utils/validar');
const { idParam } = require('./_helpers');
 
const SPEC = { nome_completo: 'texto!', apelido: 'texto', foto_url: 'texto', telefone: 'texto', ativo: 'bool' };
 
module.exports = {
  async listar(req, res) {
    const q = req.query;
    res.json(await pessoasService.listar({
      busca: q.busca,
      ativo: q.ativo === undefined ? undefined : q.ativo === '1' || q.ativo === 'true',
      rallyId: q.rally_id ? Number(q.rally_id) : undefined,
      rallyTriboId: q.rally_tribo_id ? Number(q.rally_tribo_id) : undefined,
      semTribo: q.sem_tribo === '1',
    }));
  },
  async criar(req, res) {
    const dados = validar(req.body, { ...SPEC, rally_tribo_id: 'id' });
    res.status(201).json(await pessoasService.criar(dados, req.usuario));
  },
  async obter(req, res) {
    res.json(await pessoasService.obter(idParam(req), req.query.rally_id ? Number(req.query.rally_id) : null));
  },
  async atualizar(req, res) {
    res.json(await pessoasService.atualizar(idParam(req), validar(req.body, SPEC, { parcial: true }), req.usuario));
  },
  async acesso(req, res) {
    const dados = validar(req.body, { email: 'texto', senha: 'texto', papel: ['admin', 'membro'], ativo: 'bool' });
    res.json(await authService.definirAcesso(idParam(req), dados));
  },
};
