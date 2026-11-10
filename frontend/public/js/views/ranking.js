import { icone } from '../icones.js';
import { api } from '../api.js';
import { rid, ehAdmin } from '../estado.js';
import { esc, fmtPontos, definirTitulo, grafico, limparGraficos, vazio, itemRanking, semRally, on } from '../ui.js';
 
const ABAS = [['classificacao', 'Classificação'], ['evolucao', 'Evolução'], ['categorias', 'Por categoria']];
 
export default async function ranking(el, _p, query) {
  definirTitulo('Ranking');
  if (!rid()) {
    el.innerHTML = semRally();
    return;
  }
  let aba = query.aba || 'classificacao';
  el.innerHTML = `<div class="chips">${ABAS.map(([k, r]) => `<button class="chip${k === aba ? ' ativo' : ''}" data-aba="${k}">${r}</button>`).join('')}</div><div id="corpo"></div>`;
  const corpo = el.querySelector('#corpo');
 
  async function mostrar() {
    limparGraficos();
    el.querySelectorAll('[data-aba]').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
    if (aba === 'classificacao') await classificacao(corpo);
    else if (aba === 'evolucao') await evolucao(corpo);
    else await categorias(corpo);
  }
  on(el, 'click', '[data-aba]', (b) => {
    aba = b.dataset.aba;
    mostrar();
  });
  await mostrar();
 
  const timer = setInterval(() => {
    if (!el.isConnected) clearInterval(timer);
    else if (aba === 'classificacao' && !document.hidden) classificacao(corpo).catch(() => {});
  }, 30000);
}
 
async function classificacao(corpo) {
  const lista = await api('GET', `/rallies/${rid()}/ranking`);
  const max = Math.max(1, ...lista.map((t) => t.pontos));
  const [p1, p2, p3] = lista;
  const podio = (t, cls, med) => (t ? `<div class="${cls}" style="--cor:${esc(t.cor)}"><span class="med">${icone(med)}</span><b>${esc(t.tribo)}</b><span class="pontos">${fmtPontos(t.pontos)}</span></div>` : '<div></div>');
  corpo.innerHTML = `${lista.some((t) => t.pontos) ? `<div class="podio">${podio(p2, 'p2', '🥈')}${podio(p1, 'p1', '🥇')}${podio(p3, 'p3', '🥉')}</div>` : ''}
    ${lista.map((t) => itemRanking(t, max)).join('')}
    <p class="suave pequeno" style="text-align:center">Atualiza sozinho a cada 30 segundos.</p>
    ${ehAdmin() ? `<a class="btn btn--bloco" href="/api/rallies/${rid()}/exportar/ranking.csv">Baixar ranking (planilha CSV)</a>` : ''}`;
}
 
async function evolucao(corpo) {
  const s = await api('GET', `/rallies/${rid()}/ranking/semanas`);
  corpo.innerHTML = `<div class="cartao"><h2>Pontos acumulados</h2><div class="grafico" style="height:320px"><canvas id="g"></canvas></div></div>
    <div class="cartao"><h2>Pontos por semana</h2><div class="tabela-wrap"><table>
      <thead><tr><th>Tribo</th>${s.rotulos.map((r, i) => `<th class="direita">S${i + 1}</th>`).join('')}<th class="direita">Total</th></tr></thead>
      <tbody>${s.series.map((x) => `<tr><td>${esc(x.tribo)}</td>${x.semanal.map((v) => `<td class="direita">${fmtPontos(v)}</td>`).join('')}<td class="direita"><b>${fmtPontos(x.acumulado.at(-1) || 0)}</b></td></tr>`).join('')}</tbody>
    </table></div></div>`;
  grafico(corpo.querySelector('#g'), {
    type: 'line',
    data: { labels: s.rotulos, datasets: s.series.map((x) => ({ label: x.tribo, data: x.acumulado, borderColor: x.cor, backgroundColor: x.cor, tension: 0.25, pointRadius: 2 })) },
  });
}
 
async function categorias(corpo) {
  const tribos = await api('GET', `/rallies/${rid()}/tribos`);
  corpo.innerHTML = `<label class="campo"><span>Tribo</span><select id="sel"><option value="">Todas as tribos</option>${tribos.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></label><div id="cat"></div>`;
  const desenhar = async () => {
    limparGraficos();
    const v = corpo.querySelector('#sel').value;
    const dados = await api('GET', `/rallies/${rid()}/pontos-por-categoria${v ? `?rally_tribo_id=${v}` : ''}`);
    const alvo = corpo.querySelector('#cat');
    if (!dados.length) {
      alvo.innerHTML = vazio('Nenhum ponto nesta seleção.');
      return;
    }
    alvo.innerHTML = `<div class="cartao"><div class="grafico"><canvas id="g"></canvas></div></div>
      <div class="cartao"><ul class="lista">${dados.map((c) => `<li><span class="cresce">${esc(c.categoria)}</span><span class="pontos">${fmtPontos(c.pontos)}</span></li>`).join('')}</ul></div>`;
    grafico(alvo.querySelector('#g'), {
      type: 'doughnut',
      data: { labels: dados.map((c) => c.categoria), datasets: [{ data: dados.map((c) => c.pontos) }] },
    });
  };
  corpo.querySelector('#sel').addEventListener('change', desenhar);
  await desenhar();
}
