import { api } from '../api.js';
import { rid } from '../estado.js';
import {
  esc, fmtData, fmtDataHora, definirTitulo, vazio, avatar, modal, aoEnviar, toast, etiqueta, opcoes,
} from '../ui.js';
import { FORM_PESSOA } from './pessoas.js';
import { itemLancamento } from './lancamentos.js';
 
const ACOES = {
  criar: 'Cadastro criado', editar: 'Dados editados', entrar_tribo: 'Entrou na tribo', sair_tribo: 'Saiu da tribo', transferir: 'Transferido',
};
 
function descreverMudanca(a) {
  const ler = (v) => {
    if (!v) return null;
    try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; }
  };
  const antes = ler(a.antes_json ?? a.antes);
  const depois = ler(a.depois_json ?? a.depois);
  if (a.acao === 'transferir') return `${antes?.tribo || ''} → ${depois?.tribo || ''}`;
  if (a.acao === 'entrar_tribo') return depois?.tribo || '';
  if (a.acao === 'sair_tribo') return `${antes?.tribo || ''}${depois?.motivo ? ` (${depois.motivo})` : ''}`;
  return '';
}
 
export default async function pessoa(el, { id }) {
  const p = await api('GET', `/pessoas/${id}${rid() ? `?rally_id=${rid()}` : ''}`);
  definirTitulo(p.apelido || p.nome_completo);
  el.innerHTML = `
    <div class="cartao linha">${avatar(p.apelido || p.nome_completo, '#2d3b5e', p.foto_url)}
      <div class="cresce"><h2 style="margin:0">${esc(p.nome_completo)}</h2><div class="suave">${esc(p.apelido || '')}${p.telefone ? ` · ${esc(p.telefone)}` : ''}</div></div>
      ${p.ativo ? '' : '<span class="etiqueta etiqueta--vermelho">inativo</span>'}</div>
    <div class="botoes" style="margin-bottom:.85rem"><button class="btn" id="editar">Editar dados</button><button class="btn" id="acesso">${p.acesso ? 'Acesso ao sistema' : 'Criar acesso ao sistema'}</button></div>
    ${p.acesso ? `<div class="cartao"><h3>Acesso</h3><div class="linha"><span class="cresce">${esc(p.acesso.email)}</span>${p.acesso.papel === 'admin' ? '<span class="etiqueta etiqueta--azul">administrador</span>' : '<span class="etiqueta">membro</span>'}${p.acesso.ativo ? '' : '<span class="etiqueta etiqueta--vermelho">bloqueado</span>'}</div></div>` : ''}
    <div class="cartao"><h3>Tribos (todos os rallies)</h3>${p.tribos.length ? `<ul class="lista">${p.tribos.map((t) => `
      <li><div class="cresce"><b>${esc(t.tribo_nome)}</b><div class="suave pequeno">${esc(t.rally_nome)} · ${fmtData(t.entrou_em)}${t.saiu_em ? ` a ${fmtData(t.saiu_em)}` : ''}</div></div>
      ${t.status === 'ativo' ? etiqueta('ativo') : `<span class="etiqueta">${esc(t.motivo_saida || 'saiu')}</span>`}</li>`).join('')}</ul>` : vazio('Nunca participou de uma tribo.')}</div>
    ${p.liderancas.length ? `<div class="cartao"><h3>Liderança</h3><ul class="lista">${p.liderancas.map((l) => `<li><span class="cresce">${esc(l.funcao === 'cabeca' ? 'Cabeça' : 'Auxiliar')} de ${esc(l.tribo_nome)}</span><span class="suave">${esc(l.rally_nome)}</span></li>`).join('')}</ul></div>` : ''}
    ${rid() ? `<div class="cartao"><h3>Pontos relacionados (rally atual)</h3>${p.lancamentos.length ? `<ul class="lista">${p.lancamentos.map(itemLancamento).join('')}</ul>` : vazio('Nenhum.')}</div>` : ''}
    ${p.tentativas.length ? `<div class="cartao"><h3>Provas respondidas</h3><ul class="lista">${p.tentativas.map((t) => `<li><a class="cresce" href="#/tentativas/${t.id}">${esc(t.titulo)}</a>${etiqueta(t.status)}<b class="pontos">${t.pontos_obtidos ?? '-'}</b></li>`).join('')}</ul></div>` : ''}
    <div class="cartao"><h3>Alterações no cadastro</h3>${p.alteracoes.length ? `<ul class="lista">${p.alteracoes.map((a) => `
      <li><div class="cresce"><b>${esc(ACOES[a.acao] || a.acao)}</b> <span class="suave">${esc(descreverMudanca(a))}</span></div><div class="direita suave pequeno">${esc(a.usuario_email || '')}<br>${fmtDataHora(a.em || a.criado_em)}</div></li>`).join('')}</ul>` : vazio('Nenhuma.')}</div>`;
 
  el.querySelector('#editar').addEventListener('click', () => modal({
    titulo: 'Editar pessoa',
    html: `<form>${FORM_PESSOA(p)}<label class="check"><input type="checkbox" name="ativo"${p.ativo ? ' checked' : ''}> Cadastro ativo</label>
      <button class="btn btn--primario btn--bloco" type="submit">Salvar</button></form>`,
    aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (d) => {
      await api('PATCH', `/pessoas/${p.id}`, d);
      toast('Dados atualizados.');
      fechar();
      await pessoa(el, { id });
    }),
  }));
 
  el.querySelector('#acesso').addEventListener('click', () => modal({
    titulo: 'Acesso ao sistema',
    html: `<form>
      <p class="suave pequeno">Com o acesso, a pessoa entra no sistema e vê a própria tribo, as missões e as provas. Cabeças e auxiliares também podem enviar resultados de missões. Somente administradores lançam pontos.</p>
      <label class="campo"><span>E-mail de login</span><input name="email" type="email" ${p.acesso ? '' : 'required'} value="${esc(p.acesso?.email || '')}"></label>
      <label class="campo"><span>${p.acesso ? 'Nova senha (deixe vazio para manter)' : 'Senha inicial'}</span><input name="senha" type="text" minlength="6" ${p.acesso ? '' : 'required'} autocomplete="new-password"></label>
      <label class="campo"><span>Tipo de acesso</span><select name="papel">${opcoes([['membro', 'Membro (cabeça, auxiliar ou participante)'], ['admin', 'Administrador (acesso total)']], p.acesso?.papel || 'membro')}</select></label>
      ${p.acesso ? `<label class="check"><input type="checkbox" name="ativo"${p.acesso.ativo ? ' checked' : ''}> Acesso liberado</label>` : ''}
      <button class="btn btn--primario btn--bloco" type="submit">Salvar acesso</button></form>`,
    aoAbrir: (m, fechar) => aoEnviar(m.querySelector('form'), async (d) => {
      if (!d.senha) delete d.senha;
      await api('PUT', `/pessoas/${p.id}/acesso`, d);
      toast('Acesso salvo.');
      fechar();
      await pessoa(el, { id });
    }),
  }));
}
