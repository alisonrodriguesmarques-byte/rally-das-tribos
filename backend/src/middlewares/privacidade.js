// Defesa adicional: respostas para membros jamais incluem os campos de pontuação.
const CAMPOS = new Set(['pontos', 'posicao', 'por_categoria', 'historico', 'pontos_lancados', 'pontos_manual', 'lancamento_id', 'lancamento_status', 'pontos_previstos', 'pontuacao_maxima']);
function semPontuacao(valor) {
  if (Array.isArray(valor)) return valor.map(semPontuacao);
  if (!valor || typeof valor !== 'object') return valor;
  return Object.fromEntries(Object.entries(valor).filter(([k]) => !CAMPOS.has(k)).map(([k, v]) => [k, semPontuacao(v)]));
}
function ocultarPontuacao(req, res, next) {
  if (!req.usuario.admin) {
    const json = res.json.bind(res);
    res.json = (dados) => json(semPontuacao(dados));
  }
  next();
}
module.exports = { ocultarPontuacao, semPontuacao };
