const RALLY_STATUSES = Object.freeze([
  'planejamento',
  'ativo',
  'encerrado',
  'arquivado',
  'cancelado'
]);
const INITIAL_RALLY_STATUS = 'planejamento';
module.exports = { RALLY_STATUSES, INITIAL_RALLY_STATUS };