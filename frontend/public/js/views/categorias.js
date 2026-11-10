import { api } from '../api.js';
import { estado, recarregarCategorias } from '../estado.js';
import { esc, definirTitulo, modal, aoEnviar, toast, on, bolinha } from '../ui.js';
 
const form = (c = {}) => `<form>
  <label class="campo"><span>Nome *</span><input name="nome" required maxlength="60" value="${esc(c.nome || '')}"></label>
  <label class="campo"><span>Cor</span><input name="cor" type="color" value="${esc(c.cor || '#2d3b5e')}"></label>
  ${c.id ? `<label class="check"><input type="checkbox" name="ativa"${c.ativa ? ' checked' : ''}> Em uso</label>` : ''}
  <button class="btn btn--primario btn--bloco" type="submit">Salvar</button></form>`;
 
export default async function categorias(el) {
  definirTitulo('Categorias');
  await recarregarCategorias();
  el.innerHTML = `<button class="btn btn--primario btn--bloco" id="nova" style="margin-bottom:.85rem">+ Nova categoria</button>
    <div class="cartao"><ul class="lista">${estado.categorias.map((c) => `
      <li class="item item--link" data-cat="${c.id}">${bolinha(c.cor)}<span class="cresce${c.ativa ? '' : ' riscado'}">${esc(c.nome)}</span><span class="suave">Editar</span></li>`).join('')}</ul></div>`;
  const abrir = (c) => modal({
    titulo: c ? 'Editar categoria' : 'Nova categoria',
    html: form(c),
    aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (d) => {
      if (c) await api('PATCH', `/categorias/${c.id}`, d);
      else await api('POST', '/categorias', d);
      toast('Categoria salva.');
      fechar();
      await categorias(el);
    }),
  });
  el.querySelector('#nova').addEventListener('click', () => abrir());
  on(el, 'click', '[data-cat]', (li) => abrir(estado.categorias.find((c) => c.id === Number(li.dataset.cat))));
}
