import { api } from '../api.js';
import { rid, estado } from '../estado.js';
import {
  esc, definirTitulo, vazio, avatar, modal, aoEnviar, on, toast, opcoesTribos, debounce, opcoes, acao,
} from '../ui.js';
 
const FORM_PESSOA = (p = {}, comTribo = false) => `
  <label class="campo"><span>Nome completo *</span><input name="nome_completo" required maxlength="150" value="${esc(p.nome_completo || '')}"></label>
  <label class="campo"><span>Apelido (como é chamado)</span><input name="apelido" maxlength="60" value="${esc(p.apelido || '')}"></label>
  <label class="campo"><span>Telefone</span><input name="telefone" type="tel" inputmode="tel" maxlength="30" value="${esc(p.telefone || '')}"></label>
  <label class="campo"><span>Foto (link)</span><input name="foto_url" type="url" maxlength="500" value="${esc(p.foto_url || '')}" placeholder="https://…"></label>
  ${comTribo && rid() ? `<label class="campo"><span>Tribo neste rally</span><select name="rally_tribo_id">${opcoesTribos('', 'Sem tribo por enquanto')}</select></label>` : ''}`;
 
export function novaPessoa({ tribo = false } = {}) {
  return new Promise((resolve) => {
    let criada = null;
    modal({
      titulo: 'Nova pessoa',
      html: `<form>${FORM_PESSOA({}, tribo)}<button class="btn btn--primario btn--bloco" type="submit">Cadastrar</button></form>`,
      aoAbrir: (el, fechar) => aoEnviar(el.querySelector('form'), async (d) => {
        criada = await api('POST', '/pessoas', d);
        toast('Pessoa cadastrada.');
        fechar();
      }),
      aoFechar: () => resolve(criada),
    });
  });
}
 
/** Abre uma busca de pessoas e devolve a escolhida (ou null). */
export function escolherPessoa({ titulo = 'Escolher pessoa', semTribo = false, permitirNova = false } = {}) {
  return new Promise((resolve) => {
    let escolhida = null;
    let criarNova = false;
    modal({
      titulo,
      html: `<input type="search" placeholder="Buscar pelo nome…" id="busca" autocomplete="off">
        <ul class="lista" id="res" style="margin-top:.5rem"></ul>
        ${permitirNova ? '<button type="button" class="btn btn--bloco" id="nova" style="margin-top:.6rem">+ Cadastrar nova pessoa</button>' : ''}`,
      aoAbrir: (el, fechar) => {
        let resultados = [];
        const buscar = async () => {
          const q = new URLSearchParams({ busca: el.querySelector('#busca').value, ativo: '1' });
          if (rid()) q.set('rally_id', rid());
          if (semTribo && rid()) q.set('sem_tribo', '1');
          resultados = (await api('GET', `/pessoas?${q}`)).slice(0, 40);
          el.querySelector('#res').innerHTML = resultados.length ? resultados.map((p) => `
            <li class="item item--link" data-p="${p.id}">${avatar(p.apelido || p.nome_completo)}<div class="cresce"><b>${esc(p.nome_completo)}</b>
            <div class="suave pequeno">${esc(p.apelido || '')}${p.tribo_nome ? ` · ${esc(p.tribo_nome)}` : ''}</div></div></li>`).join('')
            : vazio(semTribo ? 'Ninguém sem tribo com esse nome.' : 'Ninguém encontrado.');
        };
        el.querySelector('#busca').addEventListener('input', debounce(buscar));
        on(el, 'click', '[data-p]', (li) => {
          escolhida = resultados.find((p) => p.id === Number(li.dataset.p));
          fechar();
        });
        el.querySelector('#nova')?.addEventListener('click', () => {
          criarNova = true;
          fechar();
        });
        buscar();
      },
      aoFechar: async () => {
        if (criarNova) resolve(await novaPessoa());
        else resolve(escolhida);
      },
    });
  });
}
 
export default async function pessoas(el, _p, query) {
  definirTitulo('Pessoas');
  const f = { busca: query.busca || '', filtro: '' };
  el.innerHTML = `<div class="linha" style="margin-bottom:.6rem"><input type="search" id="busca" class="cresce" placeholder="Buscar pelo nome ou apelido…" value="${esc(f.busca)}">
      <button class="btn btn--primario" id="nova">+ Nova</button></div>
    ${rid() ? `<label class="campo"><select id="filtro">${opcoes([['', 'Todas as pessoas'], ['sem', 'Sem tribo neste rally'], ...estado.tribos.map((t) => [t.id, `Tribo de ${t.nome}`])], '')}</select></label>` : ''}
    <div class="cartao"><p class="suave pequeno" id="total" style="margin:0 0 .3rem"></p><ul class="lista" id="lista"></ul></div>`;
  const carregar = async () => {
    const q = new URLSearchParams();
    if (f.busca) q.set('busca', f.busca);
    if (rid()) q.set('rally_id', rid());
    if (f.filtro === 'sem') q.set('sem_tribo', '1');
    else if (f.filtro) q.set('rally_tribo_id', f.filtro);
    const lista = await api('GET', `/pessoas?${q}`);
    el.querySelector('#total').textContent = `${lista.length} pessoa(s)`;
    el.querySelector('#lista').innerHTML = lista.length ? lista.map((p) => {
      const t = estado.tribos.find((x) => x.id === p.rally_tribo_id);
      return `<li><a class="item item--link cresce" style="border:0;padding:0" href="#/pessoas/${p.id}">${avatar(p.apelido || p.nome_completo, t?.cor, p.foto_url)}
        <div class="cresce"><b>${esc(p.nome_completo)}</b><div class="suave pequeno">${esc(p.apelido || '')}${p.email ? ` · login: ${esc(p.email)}` : ''}</div></div>
        ${p.tribo_nome ? `<span class="etiqueta">${esc(p.tribo_nome)}</span>` : ''}${p.ativo ? '' : '<span class="etiqueta etiqueta--vermelho">inativo</span>'}</a></li>`;
    }).join('') : vazio('Ninguém encontrado.');
  };
  el.querySelector('#busca').addEventListener('input', debounce((e) => {
    f.busca = e.target.value.trim();
    carregar();
  }));
  el.querySelector('#filtro')?.addEventListener('change', (e) => {
    f.filtro = e.target.value;
    carregar();
  });
  el.querySelector('#nova').addEventListener('click', () => acao(null, async () => {
    const p = await new Promise((resolve) => {
      let criada = null;
      modal({
        titulo: 'Nova pessoa',
        html: `<form>${FORM_PESSOA({}, true)}<button class="btn btn--primario btn--bloco" type="submit">Cadastrar</button></form>`,
        aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (d) => {
          criada = await api('POST', '/pessoas', d);
          toast('Pessoa cadastrada.');
          fechar();
        }),
        aoFechar: () => resolve(criada),
      });
    });
    if (p) carregar();
  }));
  await carregar();
}
 
export { FORM_PESSOA };
