class HttpError extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}
 
const requisicaoInvalida = (msg, detalhes) => new HttpError(400, msg, detalhes);
const naoAutenticado = (msg = 'Faça login para continuar.') => new HttpError(401, msg);
const proibido = (msg = 'Você não tem permissão para esta ação.') => new HttpError(403, msg);
const naoEncontrado = (msg = 'Registro não encontrado.') => new HttpError(404, msg);
const conflito = (msg) => new HttpError(409, msg);
 
module.exports = { HttpError, requisicaoInvalida, naoAutenticado, proibido, naoEncontrado, conflito };
