/**
 * As 12 tribos oficiais do Rally das Tribos.
 * José faz parte da lista; não substituir por Efraim ou Manassés.
 */
const TRIBOS_OFICIAIS = Object.freeze([
  { nome: 'Rúben', cor: '#20E6D2' },
  { nome: 'Simeão', cor: '#E54855' },
  { nome: 'Levi', cor: '#102A43' },
  { nome: 'Judá', cor: '#F5F7FA' },
  { nome: 'Dã', cor: '#20E6D2' },
  { nome: 'Naftali', cor: '#E54855' },
  { nome: 'Gade', cor: '#102A43' },
  { nome: 'Aser', cor: '#F5F7FA' },
  { nome: 'Issacar', cor: '#20E6D2' },
  { nome: 'Zebulom', cor: '#E54855' },
  { nome: 'José', cor: '#102A43' },
  { nome: 'Benjamim', cor: '#F5F7FA' }
]);

const NOMES_TRIBOS_OFICIAIS = TRIBOS_OFICIAIS.map((tribo) => tribo.nome);

function isTriboOficial(nome) {
  return NOMES_TRIBOS_OFICIAIS.includes(nome);
}

module.exports = {
  TRIBOS_OFICIAIS,
  NOMES_TRIBOS_OFICIAIS,
  isTriboOficial
};
