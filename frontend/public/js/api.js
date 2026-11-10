export class ErroApi extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}
 
export async function api(metodo, url, corpo) {
  const opcoes = { method: metodo, headers: {}, credentials: 'same-origin' };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  let res;
  try {
    res = await fetch(`/api${url}`, opcoes);
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor. Verifique a internet.');
  }
  const tipo = res.headers.get('content-type') || '';
  const dados = tipo.includes('json') ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/')) location.hash = '#/login';
    const msg = (dados && (dados.erro || dados.mensagem || dados.message)) || 'Erro inesperado.';
    throw new ErroApi(res.status, msg, dados && dados.detalhes);
  }
  return dados;
}
