import { api } from '../api.js';
import { carregarSessao } from '../estado.js';
import { aoEnviar, aviso, esc } from '../ui.js';
import { marca } from '../marca.js';
import { icone } from '../icones.js';
export default async function login(el, _params, query = {}) {
  const criar=location.hash.split('?')[0]==='#/cadastro';
  const google = await api('GET', '/auth/google/config').catch(() => ({habilitado:false}));
  const mensagens={pendente:'Sua solicitação foi enviada. A coordenação precisa validar seu cadastro antes do primeiro acesso.',rejeitado:'Esta solicitação Google não está autorizada. Procure a coordenação.',erro:'Não foi possível concluir o acesso com Google. Tente novamente ou use e-mail e senha.'};
  document.title = 'Entrar · Rally das Tribos';
  el.innerHTML = `<div class="login nova-login">
    <div class="login__topo"><a href="#/login" class="fju-palavra" aria-label="Força Jovem Universal">FJU<small>FORÇA JOVEM UNIVERSAL</small></a><span>UMA FÉ. UM PROPÓSITO.</span></div>
    <div class="login__apresentacao"><div class="login__sobretitulo">O DESAFIO NOS MOVE. A FÉ NOS UNE.</div>${marca()}<p>UNIDOS POR UM SÓ PROPÓSITO</p><div class="login__linha"></div><span>Uma jornada de união, fé e transformação.</span></div>
    <div class="login__formulario"><div class="login__boasvindas">BEM-VINDO À SUA JORNADA</div><h1>Acesse sua conta</h1><p>Entre com seus dados para continuar.</p>
      ${mensagens[query.google] ? aviso(mensagens[query.google],query.google==='erro') : ''}${google.habilitado ? '<a class="btn btn--bloco auth-google" href="/api/auth/google/iniciar"><span class="google-g" aria-hidden="true">G</span> Continuar com Google</a><div class="auth-ou">ou</div>' : ''}<form id="f-login"><label class="campo"><span>E-mail</span><input name="email" type="email" autocomplete="username" placeholder="Digite seu e-mail" required></label>
      <label class="campo"><span>Senha</span><span class="senha-campo"><input name="senha" type="password" autocomplete="current-password" placeholder="Digite sua senha" required><button id="ver-senha" type="button" aria-label="Mostrar senha" aria-pressed="false">${icone('🔑')}</button></span></label>
      <button class="btn btn--primario btn--bloco" type="submit">Entrar <span aria-hidden="true">→</span></button></form>
      <p class="login__apoio">Ainda não tem acesso? <a href="#/cadastro">Criar conta</a></p><div class="login__base">RALLY DAS TRIBOS <span>FJU</span></div>
    </div><footer class="login__rodape">13 TRIBOS NO CATÁLOGO <span>•</span> UMA SÓ FAMÍLIA</footer></div>`;
  const social=google.habilitado?'<a class="btn btn--bloco auth-google" href="/api/auth/google/iniciar"><span class="google-g" aria-hidden="true">G</span> Continuar com Google</a>':'<button type="button" class="btn btn--bloco auth-google" disabled><span class="google-g" aria-hidden="true">G</span> Continuar com Google</button><small class="suave">A coordenação ainda precisa ativar o acesso Google.</small>';
  if(criar){
    document.title='Criar conta · Rally das Tribos';
    el.querySelector('.login__formulario').innerHTML=`<div class="login__boasvindas">FAÇA PARTE DO RALLY</div><h1>Criar conta</h1><p>Seu cadastro será validado pelo administrador antes do primeiro acesso.</p>${social}<div class="auth-ou">ou</div><form id="f-cadastro"><label class="campo"><span>Seu nome</span><input name="nome" autocomplete="name" maxlength="150" required></label><label class="campo"><span>E-mail</span><input name="email" type="email" autocomplete="email" maxlength="254" required></label><label class="campo"><span>Senha</span><input name="senha" type="password" autocomplete="new-password" minlength="12" maxlength="72" required><small>Use pelo menos 12 caracteres. Não reutilize senhas.</small></label><label class="campo"><span>Confirme a senha</span><input name="confirmar" type="password" autocomplete="new-password" required></label><button class="btn btn--primario btn--bloco" type="submit">Solicitar criação de conta</button></form><p class="login__apoio">Já tem uma conta? <a href="#/login">Entrar</a></p><div id="cadastro-resultado" role="status"></div>`;
    aoEnviar(el.querySelector('#f-cadastro'),async d=>{if(d.senha!==d.confirmar)throw Error('As senhas não conferem.');const result=await api('POST','/auth/cadastro',{nome:d.nome,email:d.email,senha:d.senha});el.querySelector('#f-cadastro').remove();el.querySelector('#cadastro-resultado').innerHTML=aviso(esc(result.mensagem));});return;
  }
  const input = el.querySelector('[name=senha]');
  el.querySelector('#ver-senha').addEventListener('click', (e) => {
    const mostrar = input.type === 'password'; input.type = mostrar ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');e.currentTarget.setAttribute('aria-pressed', String(mostrar));
  });
  aoEnviar(el.querySelector('#f-login'), async (dados) => { await api('POST', '/auth/login', dados); await carregarSessao(); location.hash = '#/'; });
}
