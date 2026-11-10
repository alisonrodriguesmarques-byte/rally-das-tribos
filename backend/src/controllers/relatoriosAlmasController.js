const service = require('../services/relatoriosAlmasService');
const rallyService = require('../services/rallyService');
const authService = require('../services/authService');
const { idParam, contexto } = require('./_helpers');
module.exports = {
  async listar(req, res) { const id = idParam(req); res.json(await service.listar(id, await contexto(req, id), req.query.semana_inicio)); },
  async salvar(req, res) { const id = idParam(req); res.json(await service.salvar(id, req.body || {}, await contexto(req, id), req.usuario)); },
  async avaliar(req, res) { res.json(await service.avaliar(idParam(req), req.body || {}, req.usuario)); },
  async exportar(req, res) {
    const id = idParam(req); const inicio = req.query.semana_inicio;
    const dados = await service.listar(id, await contexto(req, id), inicio);
    if (req.query.formato === 'csv') {
      const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const linhas = [['Tribo', 'Responsável', 'Semana inicial', 'Semana final', 'Reunião', 'Novas', 'Afastadas', 'Total']];
      for (const r of dados.relatorios.filter((x) => x.status !== 'rascunho')) for (const d of r.dias) linhas.push([r.tribo_nome, r.responsavel_nome, r.semana_inicio, r.semana_fim, d.dia, d.novas, d.afastadas, d.novas + d.afastadas]);
      return res.type('text/csv').attachment(`almas-${inicio}.csv`).send('\ufeff' + linhas.map((l) => l.map(csv).join(';')).join('\r\n'));
    }
    res.type('text/plain').attachment(`almas-${inicio}.txt`).send(service.texto(await rallyService.obter(id), inicio, dados, (await authService.perfil(req.usuario.id)).nome));
  },
};
