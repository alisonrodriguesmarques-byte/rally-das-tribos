import { api } from './api.js';
 
export const estado = { usuario: null, rallies: [], rally: null, ctx: null, tribos: [], categorias: [] };
 
export const ehAdmin = () => Boolean(estado.usuario?.admin);
export const ehLider = () => ['cabeca', 'auxiliar'].includes(estado.ctx?.funcao);
export const rid = () => estado.rally?.id;
export const somenteLeitura = () => estado.rally?.status === 'encerrado';
export const triboPorId = (id) => estado.tribos.find((t) => t.id === Number(id));
 
export async function carregarSessao() {
  try {
    estado.usuario = await api('GET', '/auth/me');
  } catch {
    estado.usuario = null;
    return false;
  }
  await carregarRallies();
  return true;
}
 
export async function carregarRallies(preferido) {
  estado.rallies = await api('GET', '/rallies');
  const salvo = preferido || Number(localStorage.getItem('rallyId'));
  const alvo = estado.rallies.find((r) => r.id === salvo)
    || estado.rallies.find((r) => r.status === 'ativo')
    || estado.rallies[0];
  if (alvo) await definirRally(alvo.id);
  else Object.assign(estado, { rally: null, ctx: null, tribos: [] });
  estado.categorias = await api('GET', '/categorias');
}
 
export async function definirRally(id) {
  const { contexto, ...rally } = await api('GET', `/rallies/${id}`);
  estado.rally = rally;
  estado.ctx = contexto;
  localStorage.setItem('rallyId', String(id));
  await recarregarTribos();
}
 
export async function recarregarTribos() {
  estado.tribos = estado.rally ? await api('GET', `/rallies/${estado.rally.id}/tribos`) : [];
}
 
export async function recarregarCategorias() {
  estado.categorias = await api('GET', '/categorias');
}
