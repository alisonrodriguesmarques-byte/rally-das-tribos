import { api } from '../api.js';
import { estado } from '../estado.js';
import { aoEnviar, definirTitulo, toast } from '../ui.js';
 
export default async function senha(el) {
  definirTitulo('Trocar senha');
  el.innerHTML = `<form class="cartao" id="f">
    <label class="campo"><span>Senha atual</span><input name="senha_atual" type="password" autocomplete="current-password" required></label>
    <label class="campo"><span>Nova senha</span><input name="nova_senha" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label>
    <label class="campo"><span>Repita a nova senha</span><input name="repetir" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label>
    <button class="btn btn--primario btn--bloco" type="submit">Salvar nova senha</button></form>`;
  aoEnviar(el.querySelector('#f'), async (d, form) => {
    if (d.nova_senha !== d.repetir) {
      toast('As senhas não conferem.', 'erro');
      return;
    }
    if(new TextEncoder().encode(d.nova_senha).length>72){toast('A senha deve ter no máximo 72 bytes.', 'erro');return;}
    await api('PATCH', '/auth/senha', { senha_atual: d.senha_atual, nova_senha: d.nova_senha });
    form.reset();
    estado.usuario = null;
    toast('Senha alterada. Entre novamente.');
    location.hash = '#/login';
  });
}
