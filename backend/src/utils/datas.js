function hoje() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
 
function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}
 
function diasEntre(inicio, fim) {
  const a = Date.parse(`${paraData(inicio)}T00:00:00Z`);
  const b = Date.parse(`${paraData(fim)}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}
 
/** Semana 1 = primeiros 7 dias a partir do início do rally. */
function semanaDoRally(dataInicioRally, data) {
  return Math.max(1, Math.floor(diasEntre(dataInicioRally, data) / 7) + 1);
}
 
module.exports = { hoje, paraData, diasEntre, semanaDoRally };
