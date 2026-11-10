const tribosService = require('../services/tribosService');
const triboRepo = require('../repositories/triboRepo');
const { validar } = require('../utils/validar');
const { idParam, contexto } = require('./_helpers');
const { naoEncontrado } = require('../utils/http');
 
module.exports = {
  async perfil(req, res) {
    const id = idParam(req);
    const rt = await triboRepo.obter(id);
    if (!rt) throw naoEncontrado('Tribo não encontrada.');
    res.json(await tribosService.perfil(id, await contexto(req, rt.rally_id)));
  },
  async lideranca(req, res) {
    const dados = validar(req.body, { cabeca_pessoa_id: 'id', auxiliar_pessoa_id: 'id' }, { parcial: true });
    res.json(await tribosService.definirLideranca(idParam(req), dados, req.usuario));
  },
  async adicionarMembro(req, res) {
    const { pessoa_id: pessoaId } = validar(req.body, { pessoa_id: 'id!' });
    res.status(201).json({ id: await tribosService.adicionarMembro(idParam(req), pessoaId, req.usuario) });
  },
  async removerMembro(req, res) {
    await tribosService.removerMembro(idParam(req), req.body?.motivo, req.usuario);
    res.json({ ok: true });
  },
  async transferir(req, res) {
    const { rally_tribo_id: destino } = validar(req.body, { rally_tribo_id: 'id!' });
    res.json({ id: await tribosService.transferir(idParam(req), destino, req.usuario) });
  },
};
