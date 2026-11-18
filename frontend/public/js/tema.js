const SOL = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
const LUA = '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>';
export const temaAtual = () => document.documentElement.dataset.tema === 'claro' ? 'claro' : 'escuro';
function atualizarBotoes() {
  const claro = temaAtual() === 'claro';
  for (const b of document.querySelectorAll('[data-alternar-tema]')) {
    const destino = claro ? 'escuro' : 'claro';
    b.setAttribute('aria-label', `Ativar tema ${destino}`); b.title = `Ativar tema ${destino}`;
    b.setAttribute('aria-pressed', String(claro));
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${claro ? LUA : SOL}</svg><span>${claro ? 'Escuro' : 'Claro'}</span>`;
  }
}
export function definirTema(tema) {
  document.documentElement.dataset.tema = tema === 'claro' ? 'claro' : 'escuro';
  try { localStorage.setItem('rally-tema', temaAtual()); } catch { /* A alternância continua funcionando nesta sessão. */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', temaAtual() === 'claro' ? '#f2f6fb' : '#030e1c');
  atualizarBotoes(); window.dispatchEvent(new Event('tema:alterado'));
}
export function iniciarTema() {
  atualizarBotoes();
  document.addEventListener('click', (e) => { if (e.target.closest('[data-alternar-tema]')) definirTema(temaAtual() === 'claro' ? 'escuro' : 'claro'); });
  window.addEventListener('storage', (e) => {
    if (e.key === 'rally-tema') {
      document.documentElement.dataset.tema = e.newValue === 'claro' ? 'claro' : 'escuro';
      atualizarBotoes();
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', temaAtual() === 'claro' ? '#f2f6fb' : '#030e1c');
      window.dispatchEvent(new Event('tema:alterado'));
    }
  });
}
