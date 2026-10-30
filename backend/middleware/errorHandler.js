function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const isServerError = status >= 500;

  if (isServerError) {
    console.error(err);
  }

  res.status(status).json({
    success: false,
    error: isServerError ? 'Erro interno do servidor' : (err.publicMessage || err.message || 'Erro')
  });
}

module.exports = errorHandler;
