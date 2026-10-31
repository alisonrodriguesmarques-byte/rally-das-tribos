function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const candidate = err.status || err.statusCode || 500;
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
  const isServerError = status >= 500;

  if (isServerError) {
    console.error('Request failed', { name: err.name, code: err.code || 'INTERNAL_ERROR' });
  }

  res.status(status).json({
    success: false,
    error: isServerError ? 'Erro interno do servidor' : (err.publicMessage ||
      (status === 413 ? 'Requisicao excedeu o limite permitido.' : 'Requisicao invalida.'))
  });
}

module.exports = errorHandler;
