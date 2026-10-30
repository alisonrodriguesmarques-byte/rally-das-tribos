function notFoundApi(req, res) {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada'
  });
}

module.exports = notFoundApi;
