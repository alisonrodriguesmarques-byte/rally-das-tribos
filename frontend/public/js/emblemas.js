const arquivos = new Set(['ruben','simeao','issacar','naftali','levi','gade','zebulom','efraim','manasses','benjamim','aser','juda']);
const seguro = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function emblema(tribo, classe = '') {
  const nome = typeof tribo === 'string' ? tribo : tribo?.nome || tribo?.tribo || '';
  const slug = String(typeof tribo === 'object' && tribo.slug || nome).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
  if (!arquivos.has(slug)) return `<span class="emblema emblema--texto ${seguro(classe)}" role="img" aria-label="Tribo de ${seguro(nome)}">${seguro(nome || 'Tribo')}</span>`;
  return `<img class="emblema ${seguro(classe)}" src="/img/tribos/${slug}.webp" alt="Emblema da tribo de ${seguro(nome)}" width="64" height="64" loading="lazy" decoding="async">`;
}
