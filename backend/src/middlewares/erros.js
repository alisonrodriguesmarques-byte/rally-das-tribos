const { HttpError } = require('../utils/http');
 
function naoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}
 
// eslint-disable-next-line no-unused-vars
function tratarErros(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ erro: err.message, detalhes: err.detalhes });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido.' });
  }
  if (String(err.code || '').startsWith('SQLITE_CONSTRAINT') || err.code === '23505' || err.code === '23503') {
    return res.status(409).json({ erro: 'Operação viola uma regra do banco de dados (registro duplicado ou vinculado).' });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
}
 
module.exports = { naoEncontrada, tratarErros };
