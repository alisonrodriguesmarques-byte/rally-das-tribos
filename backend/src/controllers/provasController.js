const provasService = require('../services/provasService');
const provaRepo = require('../repositories/provaRepo');
const { validar } = require('../utils/validar');
const { idParam, contexto, ctxDe } = require('./_helpers');
const { naoEncontrado } = require('../utils/http');
 
const SPEC = {
  titulo: 'texto!', descricao: 'texto', categoria_id: 'id', modo: ['tribo', 'individual'], agregacao: ['soma', 'media', 'melhor'],
  disponivel_de: 'datahora', disponivel_ate: 'datahora', tempo_limite_seg: 'inteiro', max_tentativas: 'inteiro',
  embaralhar: 'bool', status: ['rascunho', 'publicada', 'encerrada', 'cancelada'], tribos: 'lista',
};
const SPEC_QUESTAO = {
  tipo: ['multipla_escolha', 'verdadeiro_falso', 'complete', 'aberta', 'associacao', 'ordem'], enunciado: 'texto!',
  referencia_biblica: 'texto', imagem_url: 'texto', video_url: 'texto', pontos: 'inteiro', ordem: 'inteiro',
  alternativas: 'lista', respostas_aceitas: 'lista', pares: 'lista',
};
 
async function provaOuFalhar(id) {
  const p = await provaRepo.obter(id);
  if (!p) throw naoEncontrado('Prova não encontrada.');
  return p;
}
 
module.exports = {
  async listar(req, res) {
    const rallyId = idParam(req);
    res.json(await provasService.listar(rallyId, await contexto(req, rallyId), req.usuario));
  },
  async criar(req, res) {
    res.status(201).json({ id: await provasService.criar(idParam(req), validar(req.body, SPEC), req.usuario) });
  },
  async obter(req, res) { res.json(await provasService.obterCompleta(idParam(req))); },
  async atualizar(req, res) {
    await provasService.atualizar(idParam(req), validar(req.body, SPEC, { parcial: true }));
    res.json({ ok: true });
  },
  async criarQuestao(req, res) {
    const dados = validar(req.body, { ...SPEC_QUESTAO, tipo: SPEC_QUESTAO.tipo });
    if (!dados.tipo) dados.tipo = 'multipla_escolha';
    res.status(201).json({ id: await provasService.salvarQuestao(idParam(req), null, dados) });
  },
  async atualizarQuestao(req, res) {
    res.json({ id: await provasService.atualizarQuestao(idParam(req), validar(req.body, SPEC_QUESTAO)) });
  },
  async excluirQuestao(req, res) {
    await provasService.excluirQuestao(idParam(req));
    res.json({ ok: true });
  },
  async iniciar(req, res) {
    const prova = await provaOuFalhar(idParam(req));
    const dados = validar(req.body, { rally_tribo_id: 'id', pessoa_id: 'id' });
    res.status(201).json(await provasService.iniciarTentativa(prova.id, dados, req.usuario, await contexto(req, prova.rally_id)));
  },
  async tentativa(req, res) { res.json(await provasService.obterTentativa(idParam(req), req.usuario, ctxDe(req))); },
  async finalizar(req, res) {
    const { respostas } = validar(req.body, { respostas: 'lista' });
    res.json(await provasService.finalizarTentativa(idParam(req), respostas || [], req.usuario, ctxDe(req)));
  },
  async anular(req, res) {
    await provasService.anularTentativa(idParam(req), req.usuario);
    res.json({ ok: true });
  },
  async corrigir(req, res) {
    const dados = validar(req.body, { correta: 'bool', pontos_obtidos: 'inteiro' });
    await provasService.corrigirResposta(idParam(req), dados, req.usuario);
    res.json({ ok: true });
  },
  async resultados(req, res) { res.json(await provasService.resultados(idParam(req))); },
};
