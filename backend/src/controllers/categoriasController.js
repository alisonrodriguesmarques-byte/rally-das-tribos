const categoriaRepo = require('../repositories/categoriaRepo');
const { validar } = require('../utils/validar');
const { idParam } = require('./_helpers');
 
module.exports = {
  async listar(_req, res) { res.json(await categoriaRepo.listar()); },
  async criar(req, res) {
    const id = await categoriaRepo.criar(validar(req.body, { nome: 'texto!', cor: 'texto' }));
    res.status(201).json(await categoriaRepo.obter(id));
  },
  async atualizar(req, res) {
    const id = idParam(req);
    await categoriaRepo.atualizar(id, validar(req.body, { nome: 'texto', cor: 'texto', ativa: 'bool' }, { parcial: true }));
    res.json(await categoriaRepo.obter(id));
  },
};
