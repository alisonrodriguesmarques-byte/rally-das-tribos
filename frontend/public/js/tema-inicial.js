// Executado antes do CSS para evitar um flash do tema errado ao abrir a página.
(() => {
  let tema = 'escuro';
  try { if (localStorage.getItem('rally-tema') === 'claro') tema = 'claro'; } catch { /* Navegador com armazenamento restrito. */ }
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'claro' ? '#f2f6fb' : '#030e1c');
})();
