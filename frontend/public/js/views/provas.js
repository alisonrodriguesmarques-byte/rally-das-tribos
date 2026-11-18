import { api } from '../api.js';
import { rid, ehAdmin, somenteLeitura, estado } from '../estado.js';
import {
  esc, fmtPontos, fmtDataHora, definirTitulo, vazio, etiqueta, modal, aoEnviar, toast, opcoes, opcoesCategorias, checksTribos,
  paraLocalInput, semRally,
} from '../ui.js';
 
export const MODOS = { tribo: 'Uma resposta por tribo', individual: 'Cada jovem responde (soma na tribo)' };
export const AGREGACOES = { soma: 'Somar os pontos dos jovens', media: 'Média dos jovens', melhor: 'Melhor resultado' };
 
export function formProva(p = {}) {
  return `<form>
    <label class="campo"><span>Título *</span><input name="titulo" required maxlength="150" value="${esc(p.titulo || '')}"></label>
    <label class="campo"><span>Instruções</span><textarea name="descricao" maxlength="3000">${esc(p.descricao || '')}</textarea></label>
    <label class="campo"><span>Quem responde</span><select name="modo">${opcoes(Object.entries(MODOS), p.modo || 'tribo')}</select></label>
    <label class="campo" data-ind><span>Como somar na tribo</span><select name="agregacao">${opcoes(Object.entries(AGREGACOES), p.agregacao || 'soma')}</select></label>
    <label class="campo"><span>Categoria</span><select name="categoria_id">${opcoesCategorias(p.categoria_id ?? estado.categorias.find((c) => c.nome === 'Quiz')?.id, 'Quiz')}</select></label>
    <div class="grade">
      <label class="campo"><span>Tempo limite (min)</span><input name="tempo_limite_seg" data-tipo="minutos" type="number" min="1" step="1" value="${p.tempo_limite_seg ? Math.round(p.tempo_limite_seg / 60) : ''}" placeholder="sem limite"></label>
      <label class="campo"><span>Tentativas</span><input name="max_tentativas" type="number" min="1" step="1" value="${p.max_tentativas ?? 1}"></label>
    </div>
    <div class="grade">
      <label class="campo"><span>Disponível a partir de</span><input name="disponivel_de" data-tipo="datahora" type="datetime-local" value="${paraLocalInput(p.disponivel_de)}"></label>
      <label class="campo"><span>Disponível até</span><input name="disponivel_ate" data-tipo="datahora" type="datetime-local" value="${paraLocalInput(p.disponivel_ate)}"></label>
    </div>
    <label class="check"><input type="checkbox" name="embaralhar"${p.embaralhar ? ' checked' : ''}> Embaralhar questões e alternativas</label>
    <details style="margin-bottom:.8rem"${p.tribos?.length ? ' open' : ''}><summary class="suave">Tribos participantes (vazio = todas)</summary>${checksTribos(p.tribos || [])}</details>
    <button class="btn btn--primario btn--bloco" type="submit">Salvar prova</button></form>`;
}
 
export function ligarFormProva(el) {
  const modo = el.querySelector('[name=modo]');
  const atualizar = () => { el.querySelector('[data-ind]').hidden = modo.value !== 'individual'; };
  modo.addEventListener('change', atualizar);
  atualizar();
}
 
export default async function provas(el) {
  definirTitulo('Provas e quizzes');
  if (!rid()) {
    el.innerHTML = semRally();
    return;
  }
  const lista = await api('GET', `/rallies/${rid()}/provas`);
  if (ehAdmin()) {
    el.innerHTML = `${somenteLeitura() ? '' : '<button class="btn btn--primario btn--bloco" id="nova" style="margin-bottom:.85rem">+ Nova prova</button>'}
      ${lista.length ? lista.map((p) => `<a class="cartao" href="#/provas/${p.id}" style="display:block;text-decoration:none;color:inherit">
        <div class="linha linha--entre"><h3 style="margin:0">${esc(p.titulo)}</h3>${etiqueta(p.status)}</div>
        <div class="suave pequeno">${p.total_questoes} questão(ões) · até ${fmtPontos(p.pontuacao_maxima)} pts · ${esc(MODOS[p.modo])}</div>
        <div class="suave pequeno">${fmtPontos(p.total_tentativas)} tentativa(s)${p.disponivel_ate ? ` · até ${fmtDataHora(p.disponivel_ate)}` : ''}</div></a>`).join('')
    : `<div class="cartao">${vazio('Nenhuma prova ainda. Crie a primeira!')}</div>`}`;
    el.querySelector('#nova')?.addEventListener('click', () => modal({
      titulo: 'Nova prova',
      html: formProva(),
      aoAbrir: (m, fechar) => {
        ligarFormProva(m);
        aoEnviar(m.querySelector('form'), async (d) => {
          const r = await api('POST', `/rallies/${rid()}/provas`, d);
          toast('Prova criada. Agora adicione as questões.');
          fechar();
          location.hash = `#/provas/${r.id}`;
        });
      },
    }));
    return;
  }
  if (!estado.ctx?.rallyTriboId) {
    el.innerHTML = vazio('Você ainda não está em nenhuma tribo deste rally.');
    return;
  }
  el.innerHTML = lista.length ? lista.map((p) => {
    const finalizadas = p.tentativas.filter((t) => t.status !== 'em_andamento');
    const andamento = p.tentativas.find((t) => t.status === 'em_andamento');
    const restam = p.max_tentativas ? p.max_tentativas - p.tentativas.length : Infinity;
    const pode = p.disponivel && !somenteLeitura() && (andamento || restam > 0);
    return `<div class="cartao">
      <div class="linha linha--entre"><h3 style="margin:0">${esc(p.titulo)}</h3>${p.disponivel ? '<span class="etiqueta etiqueta--verde">Disponível</span>' : etiqueta(p.status === 'publicada' ? 'encerrada' : p.status, p.status === 'publicada' ? 'Fora do prazo' : undefined)}</div>
      <div class="suave pequeno">${p.total_questoes} questões · até ${fmtPontos(p.pontuacao_maxima)} pts · ${esc(MODOS[p.modo])}${p.tempo_limite_seg ? ` · ${Math.round(p.tempo_limite_seg / 60)} min` : ''}</div>
      ${p.descricao ? `<p class="pequeno quebra">${esc(p.descricao)}</p>` : ''}
      ${finalizadas.length ? `<ul class="lista">${finalizadas.map((t) => `<li><a class="cresce" href="#/tentativas/${t.id}">${p.modo === 'tribo' ? 'Resposta da tribo' : esc(t.pessoa_nome || 'Minha tentativa')}</a>${etiqueta(t.status)}<b class="pontos">${fmtPontos(t.pontos_obtidos)}</b></li>`).join('')}</ul>` : ''}
      ${pode ? `<a class="btn btn--primario btn--bloco" style="margin-top:.6rem" href="#/responder/${p.id}">${andamento ? 'Continuar' : p.modo === 'tribo' ? 'Responder pela tribo' : 'Responder'}</a>` : ''}
    </div>`;
  }).join('') : `<div class="cartao">${vazio('Nenhuma prova por enquanto.')}</div>`;
}
