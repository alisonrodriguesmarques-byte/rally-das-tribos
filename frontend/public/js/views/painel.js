import { api } from '../api.js';
import { rid } from '../estado.js';
import { esc, fmtPontos, definirTitulo, grafico, vazio, itemRanking, semRally } from '../ui.js';
 
export default async function painel(el) {
  definirTitulo('Painel');
  if (!rid()) {
    el.innerHTML = semRally();
    return;
  }
  const d = await api('GET', `/rallies/${rid()}/dashboard`);
  const max = Math.max(1, ...d.ranking.map((t) => t.pontos));
  const kpi = (v, r, href) => `<${href ? `a href="${href}" style="text-decoration:none;color:inherit"` : 'div'} class="kpi"><b>${v}</b><span>${r}</span></${href ? 'a' : 'div'}>`;
  el.innerHTML = `
    <div class="grade grade--4">
      ${kpi(fmtPontos(d.totais.participantes), 'participantes')}
      ${kpi(fmtPontos(d.totais.pontos_distribuidos), 'pontos distribuídos')}
      ${kpi(d.totais.entregas_pendentes, 'entregas aguardando', '#/missoes')}
      ${kpi(d.dias_restantes, `dias restantes (de ${d.dias_totais})`)}
    </div>
    <div class="botoes" style="margin:.85rem 0">
      <a class="btn btn--ouro" href="#/lancar">+ Lançar pontos</a>
      <a class="btn" href="#/missoes">Missões</a>
      <a class="btn" href="#/almas">Relatório de almas</a>
    </div>
    <div class="secao-titulo"><h2>Ranking</h2><a href="#/ranking">Ver completo</a></div>
    ${d.ranking.slice(0, 5).map((t) => itemRanking(t, max)).join('')}
    <div class="cartao" style="margin-top:.85rem"><h2>Evolução acumulada</h2><div class="grafico"><canvas id="g-evo"></canvas></div></div>
    <div class="cartao"><h2>Pontos por semana</h2><div class="grafico" style="height:200px"><canvas id="g-sem"></canvas></div></div>
    <div class="cartao"><h2>Pontos por categoria</h2>${d.por_categoria.length ? '<div class="grafico"><canvas id="g-cat"></canvas></div>' : vazio('Nenhum ponto lançado ainda.')}</div>
`;
 
  grafico(el.querySelector('#g-evo'), {
    type: 'line',
    data: {
      labels: d.semanas.rotulos,
      datasets: d.semanas.series.map((s) => ({ label: s.tribo, data: s.acumulado, borderColor: s.cor, backgroundColor: s.cor, tension: 0.25, pointRadius: 2 })),
    },
  });
  grafico(el.querySelector('#g-sem'), {
    type: 'bar',
    data: { labels: d.pontos_por_semana.map((s) => s.rotulo), datasets: [{ label: 'Pontos', data: d.pontos_por_semana.map((s) => s.pontos), backgroundColor: '#2d3b5e' }] },
    options: { plugins: { legend: { display: false } } },
  });
  grafico(el.querySelector('#g-cat'), {
    type: 'bar',
    data: { labels: d.por_categoria.map((c) => c.categoria), datasets: [{ label: 'Pontos', data: d.por_categoria.map((c) => c.pontos), backgroundColor: '#f4b740' }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } } },
  });
}
