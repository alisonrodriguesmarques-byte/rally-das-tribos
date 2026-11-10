const pontuacao = require('../services/pontuacaoService');
const rankingService = require('../services/rankingService');
const lancamentoRepo = require('../repositories/lancamentoRepo');
const { validar } = require('../utils/validar');
const { idParam, contexto } = require('./_helpers');
const { proibido } = require('../utils/http');
 
function csv(linhas, colunas) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `\ufeff${colunas.map((c) => c[1]).join(';')}\n${linhas.map((l) => colunas.map((c) => esc(l[c[0]])).join(';')).join('\n')}`;
}
 
module.exports = {
  async listar(req, res) {
    const rallyId = idParam(req);
    const ctx = await contexto(req, rallyId);
    const f = req.query;
    const filtros = {
      rally_tribo_id: f.rally_tribo_id && Number(f.rally_tribo_id), categoria_id: f.categoria_id && Number(f.categoria_id),
      origem_tipo: f.origem_tipo, status: f.status, limite: f.limite ? Number(f.limite) : 500,
    };
    if (!ctx.admin) {
      if (!ctx.rallyTriboId) throw proibido();
      filtros.rally_tribo_id = ctx.rallyTriboId;
      filtros.status = 'ativo';
    }
    res.json(await pontuacao.listar(rallyId, filtros));
  },
  async criar(req, res) {
    const dados = validar(req.body, {
      rally_tribo_id: 'id!', pontos: 'inteiro!', motivo: 'texto!', categoria_id: 'id', pessoa_id: 'id', data_referencia: 'data',
    });
    const id = await pontuacao.criarLancamento({ ...dados, rally_id: idParam(req), origem_tipo: 'manual' }, req.usuario);
    res.status(201).json(await lancamentoRepo.obter(id));
  },
  async editar(req, res) {
    const dados = validar(req.body, {
      pontos: 'inteiro', motivo: 'texto', categoria_id: 'id', data_referencia: 'data', motivo_alteracao: 'texto!',
    });
    await pontuacao.editarLancamento(idParam(req), dados, req.usuario);
    res.json(await lancamentoRepo.obter(idParam(req)));
  },
  async cancelar(req, res) {
    const { motivo } = validar(req.body, { motivo: 'texto!' });
    await pontuacao.cancelarLancamento(idParam(req), motivo, req.usuario);
    res.json(await lancamentoRepo.obter(idParam(req)));
  },
  async historico(req, res) {
    res.json({ lancamento: await lancamentoRepo.obter(idParam(req)), historico: await pontuacao.historico(idParam(req)) });
  },
  async ranking(req, res) { res.json(await rankingService.ranking(idParam(req))); },
  async semanas(req, res) { res.json(await rankingService.semanas(idParam(req))); },
  async categorias(req, res) {
    res.json(await rankingService.porCategoria(idParam(req), req.query.rally_tribo_id ? Number(req.query.rally_tribo_id) : undefined));
  },
  async dashboard(req, res) { res.json(await rankingService.dashboard(idParam(req))); },
  async exportarRanking(req, res) {
    const linhas = await rankingService.ranking(idParam(req));
    res.type('text/csv').attachment('ranking.csv').send(csv(linhas, [
      ['posicao', 'Posição'], ['tribo', 'Tribo'], ['pontos', 'Pontos'], ['cabeca_nome', 'Cabeça'], ['auxiliar_nome', 'Auxiliar'], ['participantes', 'Participantes'],
    ]));
  },
  async exportarLancamentos(req, res) {
    const linhas = await pontuacao.listar(idParam(req), {});
    res.type('text/csv').attachment('lancamentos.csv').send(csv(linhas, [
      ['id', 'ID'], ['data_referencia', 'Data'], ['tribo_nome', 'Tribo'], ['pontos', 'Pontos'], ['categoria_nome', 'Categoria'],
      ['motivo', 'Motivo'], ['origem_tipo', 'Origem'], ['status', 'Status'], ['criado_por_nome', 'Lançado por'], ['criado_em', 'Lançado em'],
      ['motivo_cancelamento', 'Motivo do cancelamento'],
    ]));
  },
};
