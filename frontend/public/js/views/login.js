import { api } from '../api.js';
import { carregarSessao } from '../estado.js';
import { aoEnviar } from '../ui.js';
 
export default async function login(el) {
  document.title = 'Entrar · Rally das Tribos';
  el.innerHTML = `<div class="login"><div style="width:100%;max-width:380px">
    <div class="login__marca"><img src="/img/icone.svg" alt=""><h1>Rally das Tribos</h1><p style="opacity:.8;margin:0">Entre para continuar</p></div>
    <form class="cartao" id="f-login">
      <label class="campo"><span>E-mail</span><input name="email" type="email" autocomplete="username" required></label>
      <label class="campo"><span>Senha</span><input name="senha" type="password" autocomplete="current-password" required></label>
      <button class="btn btn--primario btn--bloco" type="submit">Entrar</button>
    </form></div></div>`;
  aoEnviar(el.querySelector('#f-login'), async (dados) => {
    await api('POST', '/auth/login', dados);
    await carregarSessao();
    location.hash = '#/';
  });
}
