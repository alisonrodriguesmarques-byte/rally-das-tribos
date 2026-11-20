const { requisicaoInvalida } = require('./http');
 
/**
 * Validador mínimo baseado em especificação.
 *   validar(body, { titulo: 'texto!', pontos: 'inteiro', status: ['aberta', 'encerrada'] })
 * Tipos: texto, inteiro, numero, data (AAAA-MM-DD), datahora, bool, id, lista, objeto.
 * Sufixo "!" = obrigatório. Retorna somente os campos informados, já convertidos.
 */
function validar(dados, spec, { parcial = false } = {}) {
  const saida = {};
  const erros = {};
  dados = dados || {};
 
  for (const [campo, regraBruta] of Object.entries(spec)) {
    const opcoes = Array.isArray(regraBruta) ? regraBruta : null;
    const regra = opcoes ? 'opcao' : regraBruta.replace('!', '');
    const obrigatorio = opcoes ? false : regraBruta.endsWith('!');
    let valor = dados[campo];
 
    if (valor === undefined || valor === '' || valor === null) {
      if (obrigatorio && !parcial) erros[campo] = 'Campo obrigatório.';
      else if (valor === null || valor === '') saida[campo] = null;
      continue;
    }
 
    switch (regra) {
      case 'texto':
        if (typeof valor !== 'string' || valor.length > 10000) { erros[campo] = 'Informe um texto de até 10.000 caracteres.'; break; }
        valor = valor.trim();
        if (obrigatorio && !valor) erros[campo] = 'Campo obrigatório.';
        break;
      case 'inteiro':
      case 'id':
        if (typeof valor === 'boolean' || typeof valor === 'object') { erros[campo] = 'Informe um número inteiro.'; break; }
        valor = Number(valor);
        if (!Number.isSafeInteger(valor)) erros[campo] = 'Informe um número inteiro.';
        else if (regra === 'id' && valor <= 0) erros[campo] = 'Identificador inválido.';
        break;
      case 'numero':
        valor = Number(valor);
        if (!Number.isFinite(valor)) erros[campo] = 'Informe um número.';
        break;
      case 'data':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) erros[campo] = 'Data inválida (AAAA-MM-DD).';
        break;
      case 'datahora':
        if (Number.isNaN(Date.parse(valor))) erros[campo] = 'Data/hora inválida.';
        break;
      case 'bool':
        if (![true,false,0,1,'0','1','true','false'].includes(valor)) { erros[campo] = 'Informe verdadeiro ou falso.'; break; }
        valor = valor === true || valor === 1 || valor === '1' || valor === 'true';
        break;
      case 'lista':
        if (!Array.isArray(valor) || valor.length > 1000) erros[campo] = 'Informe uma lista.';
        break;
      case 'objeto':
        if (typeof valor !== 'object' || Array.isArray(valor)) erros[campo] = 'Formato inválido.';
        break;
      case 'opcao':
        if (!opcoes.includes(valor)) erros[campo] = `Valor deve ser um de: ${opcoes.join(', ')}.`;
        break;
      default:
        throw new Error(`Regra de validação desconhecida: ${regra}`);
    }
    if (!erros[campo]) saida[campo] = valor;
  }
 
  if (Object.keys(erros).length) {
    throw requisicaoInvalida('Verifique os campos destacados.', erros);
  }
  return saida;
}
 
module.exports = { validar };
