const db = require('../database/connection');
const provaRepo = require('../repositories/provaRepo');
const rallyService = require('./rallyService');
const tribosService = require('./tribosService');
const pontuacao = require('./pontuacaoService');
const { exigirDaTribo } = require('./acessoService');
const { corrigirQuestao, agregar } = require('./correcao');
const { naoEncontrado, conflito, requisicaoInvalida, proibido } = require('../utils/http');
const { agora, num } = require('../utils/db');
const { hoje } = require('../utils/datas');
 
const TOLERANCIA_SEG = 30;
 
function embaralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
 
async function obterOuFalhar(id, trx = db) {
  const p = await provaRepo.obter(id, trx);
  if (!p) throw naoEncontrado('Prova não encontrada.');
  return p;
}
 
async function questoesCompletas(provaId, trx = db) {
  const qs = await provaRepo.questoes(provaId, trx);
  const ids = qs.map((q) => q.id);
  const [alts, aceitas] = await Promise.all([provaRepo.alternativasDe(ids, trx), provaRepo.aceitasDe(ids, trx)]);
  return qs.map((q) => ({
    ...q,
    alternativas: alts.filter((a) => a.questao_id === q.id),
    respostas_aceitas: aceitas.filter((a) => a.questao_id === q.id),
  }));
}
 
function participa(prova, tribos, rallyTriboId) {
  return prova.todas_tribos || tribos.includes(Number(rallyTriboId));
}
 
function estaDisponivel(p) {
  const t = Date.now();
  if (p.disponivel_de && Date.parse(p.disponivel_de) > t) return false;
  if (p.disponivel_ate && Date.parse(p.disponivel_ate) < t) return false;
  return true;
}
 
async function listar(rallyId, ctx, usuario) {
  if (ctx.admin) {
    return (await provaRepo.listar(rallyId)).map((p) => ({ ...p, pontuacao_maxima: num(p.pontuacao_maxima), total_questoes: num(p.total_questoes) }));
  }
  if (!ctx.rallyTriboId) return [];
  const provas = await provaRepo.listar(rallyId, { status: ['publicada', 'encerrada'], rallyTriboId: ctx.rallyTriboId });
  const minhas = await provaRepo.tentativas({ 'tt.rally_tribo_id': ctx.rallyTriboId });
  return provas.map((p) => {
    const tent = minhas.filter((t) => t.prova_id === p.id && t.status !== 'anulada'
      && (p.modo === 'tribo' || t.pessoa_id === usuario.pessoa_id));
    return {
      id: p.id, titulo: p.titulo, descricao: p.descricao, categoria_nome: p.categoria_nome, modo: p.modo,
      status: p.status, tempo_limite_seg: p.tempo_limite_seg, max_tentativas: p.max_tentativas,
      disponivel_de: p.disponivel_de, disponivel_ate: p.disponivel_ate, disponivel: p.status === 'publicada' && estaDisponivel(p),
      total_questoes: num(p.total_questoes), pontuacao_maxima: num(p.pontuacao_maxima),
      tentativas: tent.map((t) => ({ id: t.id, status: t.status, pontos_obtidos: t.pontos_obtidos, pessoa_nome: t.pessoa_nome })),
    };
  });
}
 
async function obterCompleta(id) {
  const prova = await obterOuFalhar(id);
  const [questoes, tribos, tentativas] = await Promise.all([
    questoesCompletas(id), provaRepo.tribosDaProva(id), provaRepo.contarTentativas(id),
  ]);
  return {
    ...prova, tribos, questoes, total_tentativas: tentativas,
    pontuacao_maxima: questoes.reduce((a, q) => a + q.pontos, 0),
  };
}
 
async function criar(rallyId, dados, usuario) {
  await rallyService.exigirEditavel(rallyId);
  const { tribos = [], ...campos } = dados;
  return db.transaction(async (trx) => {
    const id = await provaRepo.criar({ ...campos, rally_id: rallyId, criado_por: usuario.id, todas_tribos: !tribos.length }, trx);
    await provaRepo.definirTribos(id, tribos, trx);
    return id;
  });
}
 
async function atualizar(id, dados) {
  const prova = await obterOuFalhar(id);
  await rallyService.exigirEditavel(prova.rally_id);
  const { tribos, ...campos } = dados;
  if (campos.status === 'publicada') {
    const qs = await provaRepo.questoes(id);
    if (!qs.length) throw requisicaoInvalida('Adicione pelo menos uma questão antes de publicar.');
  }
  await db.transaction(async (trx) => {
    if (tribos) {
      campos.todas_tribos = !tribos.length;
      await provaRepo.definirTribos(id, tribos, trx);
    }
    if (Object.keys(campos).length) await provaRepo.atualizar(id, campos, trx);
  });
}
 
/** Converte a questão enviada pelo editor nos registros de alternativas/respostas aceitas. */
function montarItens(tipo, dados) {
  const alts = Array.isArray(dados.alternativas) ? dados.alternativas.filter((a) => a && String(a.texto || '').trim()) : [];
  switch (tipo) {
    case 'multipla_escolha':
    case 'verdadeiro_falso': {
      if (alts.length < 2) throw requisicaoInvalida('Cadastre pelo menos duas alternativas.');
      if (alts.filter((a) => a.correta).length !== 1) throw requisicaoInvalida('Marque exatamente uma alternativa correta.');
      return { alternativas: alts.map((a, i) => ({ texto: String(a.texto).trim(), correta: Boolean(a.correta), ordem: i })), aceitas: [] };
    }
    case 'complete': {
      const aceitas = (dados.respostas_aceitas || []).map((t) => String(t).trim()).filter(Boolean);
      if (!aceitas.length) throw requisicaoInvalida('Informe a resposta correta (e variações aceitas).');
      return { alternativas: [], aceitas };
    }
    case 'ordem':
      if (alts.length < 2) throw requisicaoInvalida('Cadastre pelo menos dois itens na ordem correta.');
      return { alternativas: alts.map((a, i) => ({ texto: String(a.texto).trim(), posicao_correta: i + 1, ordem: i })), aceitas: [] };
    case 'associacao': {
      const pares = (dados.pares || []).filter((p) => p && String(p.a || '').trim() && String(p.b || '').trim());
      if (pares.length < 2) throw requisicaoInvalida('Cadastre pelo menos dois pares.');
      const alternativas = [];
      pares.forEach((p, i) => {
        alternativas.push({ texto: String(p.a).trim(), lado: 'A', par_chave: String(i + 1), ordem: i });
        alternativas.push({ texto: String(p.b).trim(), lado: 'B', par_chave: String(i + 1), ordem: i });
      });
      return { alternativas, aceitas: [] };
    }
    case 'aberta':
      return { alternativas: [], aceitas: [] };
    default:
      throw requisicaoInvalida('Tipo de questão inválido.');
  }
}
 
async function exigirSemTentativas(provaId) {
  if (await provaRepo.contarTentativas(provaId)) {
    throw conflito('Esta prova já foi respondida. Para não invalidar resultados, as questões não podem mais ser alteradas.');
  }
}
 
async function salvarQuestao(provaId, questaoId, dados) {
  const prova = await obterOuFalhar(provaId);
  await rallyService.exigirEditavel(prova.rally_id);
  await exigirSemTentativas(provaId);
  const itens = montarItens(dados.tipo, dados);
  const campos = {
    tipo: dados.tipo,
    enunciado: dados.enunciado,
    referencia_biblica: dados.referencia_biblica || null,
    imagem_url: dados.imagem_url || null,
    video_url: dados.video_url || null,
    pontos: dados.pontos ?? 100,
  };
  return db.transaction(async (trx) => {
    let id = questaoId;
    if (id) {
      await provaRepo.atualizarQuestao(id, { ...campos, ...(dados.ordem !== undefined ? { ordem: dados.ordem } : {}) }, trx);
    } else {
      const atuais = await provaRepo.questoes(provaId, trx);
      id = await provaRepo.criarQuestao({ ...campos, prova_id: provaId, ordem: dados.ordem ?? atuais.length + 1 }, trx);
    }
    await provaRepo.substituirItens(id, itens.alternativas, itens.aceitas, trx);
    return id;
  });
}
 
async function questaoDaProva(questaoId) {
  const q = await provaRepo.obterQuestao(questaoId);
  if (!q || q.removida) throw naoEncontrado('Questão não encontrada.');
  return q;
}
 
async function atualizarQuestao(questaoId, dados) {
  const q = await questaoDaProva(questaoId);
  return salvarQuestao(q.prova_id, questaoId, { ...dados, tipo: dados.tipo || q.tipo });
}
 
async function excluirQuestao(questaoId) {
  const q = await questaoDaProva(questaoId);
  const prova = await obterOuFalhar(q.prova_id);
  await rallyService.exigirEditavel(prova.rally_id);
  await exigirSemTentativas(q.prova_id);
  await db.transaction((trx) => provaRepo.excluirQuestao(questaoId, trx));
}
 
/** Questões sem gabarito, para quem vai responder. */
function paraResponder(questoes, prova) {
  const lista = prova.embaralhar ? embaralhar(questoes) : questoes;
  return lista.map((q) => {
    const base = {
      id: q.id, tipo: q.tipo, enunciado: q.enunciado, referencia_biblica: q.referencia_biblica,
      imagem_url: q.imagem_url, video_url: q.video_url, pontos: q.pontos,
    };
    const limpar = (a) => ({ id: a.id, texto: a.texto });
    if (['multipla_escolha', 'verdadeiro_falso'].includes(q.tipo)) {
      base.alternativas = (prova.embaralhar && q.tipo === 'multipla_escolha' ? embaralhar(q.alternativas) : q.alternativas).map(limpar);
    } else if (q.tipo === 'ordem') {
      base.itens = embaralhar(q.alternativas).map(limpar);
    } else if (q.tipo === 'associacao') {
      base.lado_a = q.alternativas.filter((a) => a.lado === 'A').map(limpar);
      base.lado_b = embaralhar(q.alternativas.filter((a) => a.lado === 'B')).map(limpar);
    }
    return base;
  });
}
 
async function iniciarTentativa(provaId, dados, usuario, ctx) {
  const prova = await obterOuFalhar(provaId);
  await rallyService.exigirEditavel(prova.rally_id);
  if (prova.status !== 'publicada' && !ctx.admin) throw conflito('Esta prova não está disponível.');
  if (!ctx.admin && !estaDisponivel(prova)) throw conflito('Esta prova está fora do período de disponibilidade.');
 
  const rallyTriboId = ctx.admin ? dados.rally_tribo_id : ctx.rallyTriboId;
  if (!rallyTriboId) throw requisicaoInvalida(ctx.admin ? 'Escolha a tribo que vai responder.' : 'Você não está em nenhuma tribo deste rally.');
  exigirDaTribo(ctx, rallyTriboId);
  const rt = await tribosService.obterOuFalhar(rallyTriboId);
  if (rt.rally_id !== prova.rally_id) throw requisicaoInvalida('Tribo de outro rally.');
  if (!participa(prova, await provaRepo.tribosDaProva(provaId), rt.id)) throw proibido('Esta tribo não participa desta prova.');
 
  let pessoaId = null;
  if (prova.modo === 'individual') {
    pessoaId = ctx.admin ? dados.pessoa_id : usuario.pessoa_id;
    if (!pessoaId) throw requisicaoInvalida('Prova individual: informe quem vai responder.');
  }
 
  const filtro = { 'tt.prova_id': provaId, 'tt.rally_tribo_id': rt.id };
  if (pessoaId) filtro['tt.pessoa_id'] = pessoaId;
  const anteriores = (await provaRepo.tentativas(filtro)).filter((t) => t.status !== 'anulada');
  const emAndamento = anteriores.find((t) => t.status === 'em_andamento');
 
  let tentativaId = emAndamento?.id;
  if (!tentativaId) {
    if (prova.max_tentativas && anteriores.length >= prova.max_tentativas) {
      throw conflito(`Limite de ${prova.max_tentativas} tentativa(s) atingido.`);
    }
    tentativaId = await provaRepo.criarTentativa({
      prova_id: provaId, rally_tribo_id: rt.id, pessoa_id: pessoaId, usuario_id: usuario.id,
      numero: anteriores.length + 1, iniciada_em: agora(),
    });
  }
  return tentativaParaResponder(tentativaId, prova);
}
 
async function tentativaParaResponder(tentativaId, prova) {
  const t = await provaRepo.obterTentativa(tentativaId);
  return {
    tentativa: t,
    prova: { id: prova.id, titulo: prova.titulo, descricao: prova.descricao, tempo_limite_seg: prova.tempo_limite_seg, modo: prova.modo },
    questoes: paraResponder(await questoesCompletas(prova.id), prova),
    agora: agora(),
  };
}
 
function exigirDono(t, usuario, ctx) {
  if (ctx.admin) return;
  exigirDaTribo(ctx, t.rally_tribo_id);
  if (t.pessoa_id && t.pessoa_id !== usuario.pessoa_id) throw proibido('Esta tentativa é de outra pessoa.');
}
 
async function obterTentativa(id, usuario, ctxDe) {
  const t = await provaRepo.obterTentativa(id);
  if (!t) throw naoEncontrado('Tentativa não encontrada.');
  const prova = await obterOuFalhar(t.prova_id);
  const ctx = await ctxDe(prova.rally_id);
  exigirDono(t, usuario, ctx);
  if (t.status === 'em_andamento') return tentativaParaResponder(id, prova);
 
  const [questoes, respostas] = await Promise.all([questoesCompletas(prova.id), provaRepo.respostasDe(id)]);
  const porQuestao = Object.fromEntries(respostas.map((r) => [r.questao_id, r]));
  return {
    tentativa: t,
    prova: { id: prova.id, titulo: prova.titulo, modo: prova.modo },
    pontuacao_maxima: questoes.reduce((a, q) => a + q.pontos, 0),
    questoes: questoes.map((q) => {
      const r = porQuestao[q.id];
      const item = {
        id: q.id, tipo: q.tipo, enunciado: q.enunciado, referencia_biblica: q.referencia_biblica, pontos: q.pontos,
        resposta: r ? { id: r.id, texto: r.texto, alternativa_id: r.alternativa_id, resposta_json: r.resposta_json, correta: r.correta, pontos_obtidos: r.pontos_obtidos } : null,
      };
      if (ctx.admin) {
        item.alternativas = q.alternativas;
        item.respostas_aceitas = q.respostas_aceitas;
      } else if (r?.alternativa_id) {
        item.alternativa_escolhida = q.alternativas.find((a) => a.id === r.alternativa_id)?.texto;
      }
      return item;
    }),
  };
}
 
async function finalizarTentativa(id, respostas, usuario, ctxDe) {
  const t = await provaRepo.obterTentativa(id);
  if (!t) throw naoEncontrado('Tentativa não encontrada.');
  const prova = await obterOuFalhar(t.prova_id);
  const ctx = await ctxDe(prova.rally_id);
  exigirDono(t, usuario, ctx);
  if (t.status !== 'em_andamento') throw conflito('Esta tentativa já foi finalizada.');
  await rallyService.exigirEditavel(prova.rally_id);
 
  const fim = agora();
  const decorrido = (Date.parse(fim) - Date.parse(t.iniciada_em)) / 1000;
  const foraDoTempo = Boolean(prova.tempo_limite_seg) && decorrido > prova.tempo_limite_seg + TOLERANCIA_SEG;
  const mapa = Object.fromEntries((respostas || []).map((r) => [Number(r.questao_id), r]));
  const questoes = await questoesCompletas(prova.id);
 
  const linhas = questoes.map((q) => {
    const c = corrigirQuestao(q, q.alternativas, q.respostas_aceitas, mapa[q.id]);
    if (foraDoTempo) {
      c.correta = false;
      c.pontos = 0;
    }
    return {
      tentativa_id: id, questao_id: q.id, alternativa_id: c.alternativa_id, texto: c.texto,
      resposta_json: c.resposta_json, correta: c.correta, pontos_obtidos: c.pontos,
      corrigida_em: c.correta === null ? null : fim,
    };
  });
  const pendente = linhas.some((l) => l.correta === null);
  const total = linhas.reduce((a, l) => a + (l.pontos_obtidos || 0), 0);
 
  await db.transaction(async (trx) => {
    await provaRepo.inserirRespostas(linhas, trx);
    await provaRepo.atualizarTentativa(id, {
      finalizada_em: fim, pontos_obtidos: total, fora_do_tempo: foraDoTempo,
      status: pendente ? 'aguardando_correcao' : 'corrigida',
    }, trx);
    if (!pendente) await recalcularResultado(prova, t.rally_tribo_id, usuario, trx);
  });
  return obterTentativa(id, usuario, ctxDe);
}
 
/** Recalcula o resultado oficial da tribo nesta prova e sincroniza o lançamento. */
async function recalcularResultado(prova, rallyTriboId, usuario, trx) {
  const tentativas = (await provaRepo.tentativas({ 'tt.prova_id': prova.id, 'tt.rally_tribo_id': rallyTriboId }, trx))
    .filter((t) => t.status === 'corrigida');
  let pontos = null;
  if (tentativas.length) {
    if (prova.modo === 'tribo') {
      pontos = Math.max(...tentativas.map((t) => t.pontos_obtidos || 0));
    } else {
      const melhorPorPessoa = {};
      for (const t of tentativas) melhorPorPessoa[t.pessoa_id] = Math.max(melhorPorPessoa[t.pessoa_id] ?? 0, t.pontos_obtidos || 0);
      pontos = agregar(Object.values(melhorPorPessoa), prova.agregacao);
    }
  }
  const existente = await provaRepo.resultado(prova.id, rallyTriboId, trx);
  const lancamentoId = await pontuacao.sincronizarLancamento(existente?.lancamento_id, pontos ? {
    rally_id: prova.rally_id,
    rally_tribo_id: rallyTriboId,
    categoria_id: prova.categoria_id || await pontuacao.categoriaPadrao('Quiz', trx),
    pontos,
    motivo: `Prova: ${prova.titulo}`,
    origem_tipo: 'prova',
    origem_id: prova.id,
    data_referencia: hoje(),
    motivo_alteracao: 'Resultado da prova recalculado',
  } : null, usuario, trx);
  if (existente) {
    await provaRepo.atualizarResultado(existente.id, { pontos: pontos || 0, lancamento_id: lancamentoId, calculado_em: agora() }, trx);
  } else if (pontos !== null) {
    await provaRepo.criarResultado({ prova_id: prova.id, rally_tribo_id: rallyTriboId, pontos, lancamento_id: lancamentoId, calculado_em: agora() }, trx);
  }
}
 
async function recalcularTentativa(tentativaId, usuario, trx) {
  const t = await provaRepo.obterTentativa(tentativaId, trx);
  const respostas = await provaRepo.respostasDe(tentativaId, trx);
  const pendente = respostas.some((r) => r.correta === null);
  const total = respostas.reduce((a, r) => a + (r.pontos_obtidos || 0), 0);
  await provaRepo.atualizarTentativa(tentativaId, { pontos_obtidos: total, status: pendente ? 'aguardando_correcao' : 'corrigida' }, trx);
  const prova = await provaRepo.obter(t.prova_id, trx);
  await recalcularResultado(prova, t.rally_tribo_id, usuario, trx);
}
 
async function corrigirResposta(respostaId, { correta, pontos_obtidos: pontos }, usuario) {
  const r = await provaRepo.obterResposta(respostaId);
  if (!r) throw naoEncontrado('Resposta não encontrada.');
  const t = await provaRepo.obterTentativa(r.tentativa_id);
  if (t.status === 'anulada') throw conflito('Tentativa anulada.');
  const q = await provaRepo.obterQuestao(r.questao_id);
  const prova = await obterOuFalhar(t.prova_id);
  await rallyService.exigirEditavel(prova.rally_id);
  const valor = pontos ?? (correta ? q.pontos : 0);
  if (valor < 0 || valor > q.pontos) throw requisicaoInvalida(`Os pontos devem estar entre 0 e ${q.pontos}.`);
  await db.transaction(async (trx) => {
    await provaRepo.atualizarResposta(respostaId, {
      correta: correta ?? valor === q.pontos, pontos_obtidos: valor, corrigida_por: usuario.id, corrigida_em: agora(),
    }, trx);
    await recalcularTentativa(t.id, usuario, trx);
  });
}
 
async function anularTentativa(id, usuario) {
  const t = await provaRepo.obterTentativa(id);
  if (!t) throw naoEncontrado('Tentativa não encontrada.');
  const prova = await obterOuFalhar(t.prova_id);
  await rallyService.exigirEditavel(prova.rally_id);
  await db.transaction(async (trx) => {
    await provaRepo.atualizarTentativa(id, { status: 'anulada' }, trx);
    await recalcularResultado(prova, t.rally_tribo_id, usuario, trx);
  });
}
 
async function resultados(provaId) {
  const prova = await obterOuFalhar(provaId);
  const [tentativas, resultadosTribo, questoes] = await Promise.all([
    provaRepo.tentativas({ 'tt.prova_id': provaId }),
    provaRepo.resultados(provaId),
    provaRepo.questoes(provaId),
  ]);
  const aguardando = tentativas.filter((t) => t.status === 'aguardando_correcao').map((t) => t.id);
  const pendentes = aguardando.length
    ? await db('respostas as r')
      .join('questoes as q', 'q.id', 'r.questao_id')
      .join('tentativas as tt', 'tt.id', 'r.tentativa_id')
      .join('rally_tribos as rt', 'rt.id', 'tt.rally_tribo_id')
      .join('tribos as t', 't.id', 'rt.tribo_id')
      .whereIn('r.tentativa_id', aguardando)
      .whereNull('r.correta')
      .select('r.id', 'r.texto', 'r.tentativa_id', 'q.enunciado', 'q.pontos', 't.nome as tribo_nome')
    : [];
  return {
    prova,
    pontuacao_maxima: questoes.reduce((a, q) => a + q.pontos, 0),
    resultados: resultadosTribo,
    tentativas,
    respostas_pendentes: pendentes,
  };
}
 
module.exports = {
  listar, obterCompleta, criar, atualizar, salvarQuestao, atualizarQuestao, excluirQuestao,
  iniciarTentativa, obterTentativa, finalizarTentativa, corrigirResposta, anularTentativa, resultados,
};
