const { normalizar } = require('../utils/texto');
 
/**
 * Corrige uma questão. Função pura (sem banco) para facilitar testes.
 * Retorna { correta: true|false|null, pontos: number|null, alternativa_id, texto, resposta_json }.
 * correta = null significa "aguardando correção manual" (pergunta aberta).
 */
function corrigirQuestao(questao, alternativas, aceitas, resposta = {}) {
  const valor = Number(questao.pontos) || 0;
  const saida = { alternativa_id: null, texto: null, resposta_json: null, correta: false, pontos: 0 };
 
  switch (questao.tipo) {
    case 'multipla_escolha':
    case 'verdadeiro_falso': {
      const alt = alternativas.find((a) => a.id === Number(resposta.alternativa_id));
      saida.alternativa_id = alt ? alt.id : null;
      saida.correta = Boolean(alt && alt.correta);
      break;
    }
    case 'complete': {
      saida.texto = resposta.texto ? String(resposta.texto).slice(0, 2000) : null;
      const r = normalizar(resposta.texto);
      saida.correta = Boolean(r) && aceitas.some((a) => normalizar(a.texto) === r);
      break;
    }
    case 'aberta':
      saida.texto = resposta.texto ? String(resposta.texto).slice(0, 5000) : null;
      saida.correta = saida.texto ? null : false;
      saida.pontos = saida.texto ? null : 0;
      return saida;
    case 'ordem': {
      const ordem = Array.isArray(resposta.ordem) ? resposta.ordem.map(Number) : [];
      saida.resposta_json = JSON.stringify(ordem);
      const porId = Object.fromEntries(alternativas.map((a) => [a.id, a]));
      const acertos = ordem.filter((id, i) => porId[id] && porId[id].posicao_correta === i + 1).length;
      const total = alternativas.length || 1;
      saida.correta = acertos === alternativas.length && ordem.length === alternativas.length;
      saida.pontos = Math.round((valor * acertos) / total);
      return saida;
    }
    case 'associacao': {
      const pares = resposta.pares && typeof resposta.pares === 'object' ? resposta.pares : {};
      saida.resposta_json = JSON.stringify(pares);
      const ladoA = alternativas.filter((a) => a.lado === 'A');
      const porId = Object.fromEntries(alternativas.map((a) => [a.id, a]));
      const acertos = ladoA.filter((a) => {
        const b = porId[Number(pares[a.id])];
        return b && b.lado === 'B' && b.par_chave === a.par_chave;
      }).length;
      saida.correta = ladoA.length > 0 && acertos === ladoA.length;
      saida.pontos = Math.round((valor * acertos) / (ladoA.length || 1));
      return saida;
    }
    default:
      saida.correta = null;
      saida.pontos = null;
      return saida;
  }
  saida.pontos = saida.correta ? valor : 0;
  return saida;
}
 
/** Combina resultados individuais em um resultado da tribo. */
function agregar(valores, agregacao) {
  if (!valores.length) return 0;
  if (agregacao === 'media') return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
  if (agregacao === 'melhor') return Math.max(...valores);
  return valores.reduce((a, b) => a + b, 0);
}
 
module.exports = { corrigirQuestao, agregar };
