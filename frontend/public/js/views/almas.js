import { api } from '../api.js';
import { estado, rid, ehAdmin, ehLider, somenteLeitura } from '../estado.js';
import { esc, definirTitulo, fmtData, hoje, semRally, aviso, vazio, toast, acao, on, confirmar, modal } from '../ui.js';

const DIAS = [['segunda', 'Segunda-feira'], ['quarta', 'Quarta-feira'], ['quinta', 'Quinta-feira'], ['sexta', 'Sexta-feira'], ['sabado', 'Sábado']];
const STATUS = { rascunho: 'Rascunho', enviado: 'Enviado', conferido: 'Conferido' };
const estiloStatus = { rascunho: 'laranja', enviado: 'azul', conferido: 'verde' };
function segunda(data) {
  const d = new Date(`${data}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return segunda(hoje());
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function adicionarDias(data, n) {
  const d = new Date(`${data}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function tabela(r) {
  return `<table class="almas-tabela"><thead><tr><th>Reunião</th><th>Novas</th><th>Afastadas</th><th>Total</th></tr></thead><tbody>${r.dias.map((d, i) => `<tr><th>${DIAS[i][1]}</th><td>${d.novas}</td><td>${d.afastadas}</td><td>${d.novas + d.afastadas}</td></tr>`).join('')}</tbody><tfoot><tr><th>TOTAL</th><td>${r.novas}</td><td>${r.afastadas}</td><td>${r.total}</td></tr></tfoot></table>`;
}
function cabecalho(inicio) {
  return `<div class="almas-cabecalho"><div class="suave pequeno">RALLY DAS TRIBOS · FJU</div><h1>Relatório semanal de almas</h1><p><b>Rally:</b> ${esc(estado.rally.nome)}<br><b>Semana:</b> ${fmtData(inicio)} até ${fmtData(adicionarDias(inicio, 6))}<br><b>Responsável:</b> ${esc(estado.usuario.nome)}</p></div>`;
}
export default async function almas(el, _params, query) {
  definirTitulo('Relatório de almas');
  if (!rid()) { el.innerHTML = semRally(); return; }
  const admin = ehAdmin();
  if (!admin && !ehLider()) { el.innerHTML = aviso('Somente cabeças e auxiliares enviam o relatório semanal.'); return; }
  const hojeRally = hoje() < estado.rally.data_inicio ? estado.rally.data_inicio : hoje() > estado.rally.data_fim ? estado.rally.data_fim : hoje();
  const inicio = segunda(query.semana || hojeRally);
  const dados = await api('GET', `/rallies/${rid()}/relatorios-almas?semana_inicio=${inicio}`);
  el.innerHTML = `<div class="cartao nao-imprimir"><form id="periodo" class="almas-periodo"><label class="campo"><span>Semana (selecione uma data)</span><input id="semana" type="date" required value="${inicio}"></label><button class="btn btn--primario" type="submit">Consultar</button></form><div class="botoes"><a class="btn btn--peq" href="#/almas?semana=${adicionarDias(inicio, -7)}">← Semana anterior</a><a class="btn btn--peq" href="#/almas?semana=${adicionarDias(inicio, 7)}">Próxima semana →</a></div></div><section id="relatorio-almas">${cabecalho(inicio)}<div id="almas-corpo"></div></section>`;
  el.querySelector('#periodo').addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/almas?semana=${segunda(el.querySelector('#semana').value)}`; });
  const corpo = el.querySelector('#almas-corpo');
  if (admin) {
    const s = dados.resumo;
    const enviados = dados.relatorios.filter((r) => r.status !== 'rascunho');
    const url = `/api/rallies/${rid()}/relatorios-almas/exportar?semana_inicio=${inicio}`;
    corpo.innerHTML = `<h2>Resumo geral</h2><div class="grade grade--3 almas-resumo"><div class="kpi"><b>${s.novas}</b><span>Almas novas</span></div><div class="kpi"><b>${s.afastadas}</b><span>Almas afastadas</span></div><div class="kpi"><b>${s.total}</b><span>Total geral</span></div></div>
      <p class="suave">${s.enviados} de ${estado.tribos.length} tribos enviaram · ${s.conferidos} conferidos. Rascunhos não entram nos totais.</p>
      <div class="botoes nao-imprimir" style="margin-bottom:1rem"><a class="btn" href="${url}">Baixar texto</a><a class="btn" href="${url}&formato=csv">Baixar CSV</a><button class="btn" id="copiar">Copiar relatório</button><button class="btn" id="imprimir">Imprimir / PDF</button></div>
      ${s.pendentes.length ? `<div class="aviso"><b>Ainda não enviados:</b> ${s.pendentes.map((t) => esc(t.nome)).join(', ')}</div>` : '<div class="aviso">Todas as tribos enviaram o relatório.</div>'}
      ${enviados.length ? enviados.map((r) => `<article class="cartao almas-relatorio" style="border-top:5px solid ${esc(r.tribo_cor)}"><div class="linha linha--entre"><h2>Tribo de ${esc(r.tribo_nome)}</h2><span class="etiqueta etiqueta--${estiloStatus[r.status]}">${STATUS[r.status]}</span></div><p class="suave">Responsável: ${esc(r.responsavel_nome)}</p>${tabela(r)}
      ${!somenteLeitura() ? `<div class="botoes nao-imprimir" style="margin-top:.8rem"><a class="btn btn--ouro" href="#/lancar?tribo=${r.rally_tribo_id}&motivo=${encodeURIComponent(`Relatório de almas de ${fmtData(inicio)} a ${fmtData(r.semana_fim)}`)}">Lançar pontos</a>${r.status === 'enviado' ? `<button class="btn btn--verde" data-conferir="${r.id}">Marcar conferido</button>` : ''}<button class="btn" data-devolver="${r.id}">Devolver para correção</button></div>` : ''}<p class="suave pequeno nao-imprimir">A conferência não lança pontos automaticamente. Use “Lançar pontos” para registrar a pontuação.</p></article>`).join('') : `<div class="cartao">${vazio('Nenhum relatório enviado nesta semana.')}</div>`}`;
    el.querySelector('#imprimir').addEventListener('click', () => window.print());
    el.querySelector('#copiar').addEventListener('click', (e) => acao(e.currentTarget, async () => {
      const texto = await api('GET', `/rallies/${rid()}/relatorios-almas/exportar?semana_inicio=${inicio}`);
      try { await navigator.clipboard.writeText(texto); toast('Relatório copiado.'); }
      catch { modal({ titulo: 'Copiar relatório', html: `<textarea readonly style="min-height:300px" aria-label="Texto do relatório">${esc(texto)}</textarea>`, aoAbrir: (m) => { m.querySelector('textarea').select(); } }); }
    }));
    on(el, 'click', '[data-conferir]', (b) => acao(b, async () => { await api('POST', `/relatorios-almas/${b.dataset.conferir}/avaliar`, { acao: 'conferir' }); toast('Relatório conferido.'); await almas(el, {}, { semana: inicio }); }));
    on(el, 'click', '[data-devolver]', async (b) => {
      const r = await confirmar({ titulo: 'Devolver relatório', botao: 'Devolver', motivo: true, rotuloMotivo: 'O que precisa ser corrigido?', mensagem: '<p>O cabeça ou auxiliar poderá editar e reenviar esta semana.</p>' });
      if (r) await acao(b, async () => { await api('POST', `/relatorios-almas/${b.dataset.devolver}/avaliar`, { acao: 'devolver', motivo: r.motivo }); toast('Relatório devolvido.'); await almas(el, {}, { semana: inicio }); });
    });
    return;
  }
  const rel = dados.relatorios[0];
  const tribo = estado.tribos.find((t) => t.id === estado.ctx.rallyTriboId);
  const editavel = !somenteLeitura() && (!rel || rel.status === 'rascunho');
  const dias = rel?.dias || DIAS.map(([dia]) => ({ dia, novas: 0, afastadas: 0 }));
  corpo.innerHTML = `<div class="cartao"><div class="linha linha--entre"><h2>Tribo de ${esc(tribo?.nome)}</h2><span class="etiqueta etiqueta--${estiloStatus[rel?.status || 'rascunho']}">${STATUS[rel?.status || 'rascunho']}</span></div>
    ${rel?.observacao_admin ? aviso(`Coordenação: ${esc(rel.observacao_admin)}`) : ''}
    ${rel && !editavel ? `<p class="suave">Responsável pelo envio: ${esc(rel.responsavel_nome)}</p>${tabela(rel)}<p class="suave">Relatório enviado. Se precisar corrigir, peça ao administrador para devolvê-lo.</p>` : ''}
    ${editavel ? `<form id="form-almas"><p class="suave pequeno">Informe quantas almas vieram em cada reunião. Para uma reunião sem visitas, informe zero. A mesma pessoa em reuniões diferentes conta em cada reunião.</p>
      <table class="almas-tabela"><thead><tr><th>Reunião</th><th>Novas</th><th>Afastadas</th><th>Total</th></tr></thead><tbody>${dias.map((d, i) => `<tr><th>${DIAS[i][1]}</th><td><input type="number" min="0" max="1000000" step="1" required inputmode="numeric" name="${d.dia}_novas" value="${d.novas}" aria-label="${DIAS[i][1]} — novas"></td><td><input type="number" min="0" max="1000000" step="1" required inputmode="numeric" name="${d.dia}_afastadas" value="${d.afastadas}" aria-label="${DIAS[i][1]} — afastadas"></td><td data-total-dia="${d.dia}">0</td></tr>`).join('')}</tbody><tfoot><tr><th>TOTAL</th><td id="total-novas">0</td><td id="total-afastadas">0</td><td id="total-geral">0</td></tr></tfoot></table>
      <div class="botoes" style="margin-top:1rem"><button class="btn" type="submit" value="rascunho">Salvar rascunho</button><button class="btn btn--ouro" type="submit" value="enviar">Enviar ao administrador</button></div><p id="salvamento-almas" class="suave pequeno" role="status"></p></form>` : !rel ? aviso('Este rally está encerrado e não aceita novos relatórios.') : ''}</div>`;
  const form = corpo.querySelector('#form-almas');
  if (!form) return;
  const coletar = () => DIAS.map(([dia]) => ({ dia, novas: Number(form.elements[`${dia}_novas`].value), afastadas: Number(form.elements[`${dia}_afastadas`].value) }));
  const atualizar = () => {
    const itens = coletar();
    for (const d of itens) corpo.querySelector(`[data-total-dia="${d.dia}"]`).textContent = d.novas + d.afastadas;
    const novas = itens.reduce((s, d) => s + d.novas, 0); const afastadas = itens.reduce((s, d) => s + d.afastadas, 0);
    corpo.querySelector('#total-novas').textContent = novas; corpo.querySelector('#total-afastadas').textContent = afastadas; corpo.querySelector('#total-geral').textContent = novas + afastadas;
  };
  form.addEventListener('input', atualizar); atualizar();
  let ocupado = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (ocupado) return; ocupado = true;
    const acaoEnvio = e.submitter?.value || 'rascunho';
    try {
      if (acaoEnvio === 'enviar' && !(await confirmar({ titulo: 'Enviar relatório semanal', botao: 'Enviar', mensagem: '<p>Confirma os números? Após o envio, alterações precisam de devolução pelo administrador.</p>' }))) return;
      const resultado = await acao(e.submitter, async () => {
        const r = await api('POST', `/rallies/${rid()}/relatorios-almas`, { semana_inicio: inicio, acao: acaoEnvio, dias: coletar() });
        toast(acaoEnvio === 'enviar' ? 'Relatório enviado ao administrador.' : 'Rascunho salvo.'); return r;
      });
      if (resultado) await almas(el, {}, { semana: inicio });
    } finally { ocupado = false; }
  });
}
