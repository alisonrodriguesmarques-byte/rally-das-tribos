import { api } from '../api.js';
import { carregarSessao } from '../estado.js';
import { aoEnviar } from '../ui.js';
import { marca } from '../marca.js';
import { icone } from '../icones.js';
export default async function login(el) {
  document.title = 'Entrar · Rally das Tribos';
  el.innerHTML = `<div class="login nova-login">
    <div class="login__topo"><a href="#/login" class="fju-palavra" aria-label="Força Jovem Universal">FJU<small>FORÇA JOVEM UNIVERSAL</small></a><span>UMA FÉ. UM PROPÓSITO.</span></div>
    <div class="login__apresentacao"><div class="login__sobretitulo">O DESAFIO NOS MOVE. A FÉ NOS UNE.</div>${marca()}<p>UNIDOS POR UM SÓ PROPÓSITO</p><div class="login__linha"></div><span>Uma jornada de união, fé e transformação.</span></div>
    <div class="login__formulario"><div class="login__boasvindas">BEM-VINDO À SUA JORNADA</div><h1>Acesse sua conta</h1><p>Entre com seus dados para continuar.</p>
      <form id="f-login"><label class="campo"><span>E-mail</span><input name="email" type="email" autocomplete="username" placeholder="Digite seu e-mail" required></label>
      <label class="campo"><span>Senha</span><span class="senha-campo"><input name="senha" type="password" autocomplete="current-password" placeholder="Digite sua senha" required><button id="ver-senha" type="button" aria-label="Mostrar senha" aria-pressed="false">${icone('🔑')}</button></span></label>
      <button class="btn btn--primario btn--bloco" type="submit">Entrar <span aria-hidden="true">→</span></button></form>
      <p class="login__apoio">Precisa de acesso? Fale com a coordenação.</p><div class="login__base">RALLY DAS TRIBOS <span>FJU</span></div>
    </div><footer class="login__rodape">13 TRIBOS NO CATÁLOGO <span>•</span> UMA SÓ FAMÍLIA</footer></div>`;
  const input = el.querySelector('[name=senha]');
  el.querySelector('#ver-senha').addEventListener('click', (e) => {
    const mostrar = input.type === 'password'; input.type = mostrar ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');e.currentTarget.setAttribute('aria-pressed', String(mostrar));
  });
  aoEnviar(el.querySelector('#f-login'), async (dados) => { await api('POST', '/auth/login', dados); await carregarSessao(); location.hash = '#/'; });
}
