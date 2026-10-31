'use strict';

const { AuthService, authError } = require('./authService');

const PERSON_FIELDS = 'id, nome_completo, nome_apelido, status';
const ROLES = Object.freeze(['participante', 'lider', 'auxiliar']);
const PERIOD_SELECT = `SELECT mt.id, mt.tribo_id, t.nome AS tribo_nome,
  mt.participante_id, p.nome_completo, p.nome_apelido, mt.papel,
  mt.data_entrada, mt.data_saida, mt.ativo
  FROM membros_tribo mt JOIN tribos t ON t.id = mt.tribo_id
  JOIN participantes p ON p.id = mt.participante_id`;

function id(value, label = 'Identificador') {
  const parsed = typeof value === 'number' ? value :
    (typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : NaN);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw authError(400, label + ' invalido.');
  return parsed;
}

function body(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !allowed.includes(key))) {
    throw authError(400, 'Informe somente os campos permitidos para esta operacao.');
  }
  for (const key of Object.keys(input)) {
    if (key.endsWith('_id') && (!Number.isSafeInteger(input[key]) || input[key] <= 0)) {
      throw authError(400, 'Os identificadores enviados devem ser numeros inteiros positivos.');
    }
  }
  return input;
}

function text(value, label, maximum, optional = false) {
  if (optional && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw authError(400, label + ' deve ser texto valido.');
  }
  const normalized = value.trim();
  if ((!optional && !normalized) || normalized.length > maximum) {
    throw authError(400, label + ' deve ter ate ' + maximum + ' caracteres.');
  }
  return normalized || null;
}

function date(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw authError(400, label + ' deve ser uma data real no formato AAAA-MM-DD.');
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw authError(400, label + ' deve ser uma data real no formato AAAA-MM-DD.');
  }
  return value;
}

function role(value) {
  if (!ROLES.includes(value)) throw authError(400, 'Papel invalido. Escolha participante, cabeca da tribo ou auxiliar.');
  return value;
}

function reason(value) {
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) ||
      !value.trim() || value.trim().length > 500) {
    throw authError(400, 'Informe um motivo de ate 500 caracteres.');
  }
  return value.trim();
}

class TeamService {
  constructor(db, { now = () => Date.now() } = {}) {
    if (typeof now !== 'function') throw new Error('Invalid teams clock');
    this.db = db;
    this.now = now;
    this.authorization = new AuthService(db);
  }

  async assertAdmin(actorId) {
    return this.authorization.assertAdmin(actorId);
  }

  async audit(event, actorId, participantId, rallyId, previousId, nextId, detail) {
    await this.db.run(`INSERT INTO team_audit
      (actor_id, rally_id, participante_id, membro_anterior_id, membro_novo_id, event, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [actorId, rallyId, participantId, previousId, nextId, event, JSON.stringify(detail), this.now()]);
  }

  async participant(participantId, writable = false) {
    const person = await this.db.get('SELECT ' + PERSON_FIELDS + ' FROM participantes WHERE id = ?',
      [id(participantId, 'Participante')]);
    if (!person) throw authError(404, 'Participante nao encontrado.');
    if (writable && person.status !== 'ativo') throw authError(409, 'Este participante esta inativo.');
    return person;
  }

  async rally(rallyId, writable = false) {
    const found = await this.db.get('SELECT id, nome, status, legado, data_inicio, data_fim FROM rallies WHERE id = ?',
      [id(rallyId, 'Rally')]);
    if (!found) throw authError(404, 'Rally nao encontrado.');
    if (writable && (found.legado || !['planejamento', 'ativo'].includes(found.status))) {
      throw authError(409, 'A composicao so pode mudar no planejamento ou durante Rally ativo; edicoes legadas e finalizadas sao somente consulta.');
    }
    return found;
  }

  async tribe(rallyId, tribeId) {
    const found = await this.db.get('SELECT id, catalogo_id, nome, cor FROM tribos WHERE id = ? AND rally_id = ?',
      [id(tribeId, 'Tribo'), rallyId]);
    if (!found) throw authError(404, 'A tribo nao pertence a esta edicao.');
    return found;
  }

  async membership(rallyId, memberId, active = false) {
    const found = await this.db.get(PERIOD_SELECT + ' WHERE mt.id = ? AND t.rally_id = ?', [id(memberId, 'Vinculo'), rallyId]);
    if (!found) throw authError(404, 'Vinculo nao encontrado nesta edicao.');
    if (active && found.ativo !== 1) throw authError(409, 'Este vinculo ja foi encerrado. Abra um novo periodo para retornar.');
    return found;
  }

  async assertLeadershipAvailable(tribeId, memberRole, excludeMemberId = null) {
    if (!['lider', 'auxiliar'].includes(memberRole)) return;
    const occupied = await this.db.get(`SELECT id FROM membros_tribo
      WHERE tribo_id = ? AND papel = ? AND ativo = 1 AND (? IS NULL OR id <> ?) LIMIT 1`,
    [tribeId, memberRole, excludeMemberId, excludeMemberId]);
    if (occupied) throw authError(409, memberRole === 'lider'
      ? 'Esta tribo ja possui um cabeca ativo. Encerre o vinculo atual antes de substituir.'
      : 'Esta tribo ja possui um auxiliar ativo. Encerre o vinculo atual antes de substituir.');
  }

  async assertNoOverlap(rallyId, participantId, entry, exit = null, excludeMemberId = null) {
    // Periods are [entry, exit), so closing and opening on the same day is valid.
    if (exit === entry) return;
    const conflict = await this.db.get(`SELECT mt.id FROM membros_tribo mt JOIN tribos t ON t.id = mt.tribo_id
      WHERE t.rally_id = ? AND mt.participante_id = ? AND (? IS NULL OR mt.id <> ?)
        AND (mt.data_saida IS NULL OR mt.data_saida > mt.data_entrada)
        AND (mt.data_saida IS NULL OR mt.data_saida > ?)
        AND (? IS NULL OR mt.data_entrada < ?) LIMIT 1`,
    [rallyId, participantId, excludeMemberId, excludeMemberId, entry, exit, exit]);
    if (conflict) throw authError(409, 'O periodo informado conflita com outro vinculo desta pessoa na mesma edicao.');
  }

  async assertChronologicalChange(rallyId, previous, movementDate) {
    if (movementDate < previous.data_entrada) throw authError(400, 'A data da movimentacao nao pode ser anterior a entrada.');
    await this.assertNoOverlap(rallyId, previous.participante_id, previous.data_entrada, movementDate, previous.id);
  }

  async listParticipants(actorId, options = {}) {
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      body(options, ['q', 'limit']);
      const query = options.q === undefined ? '' : text(options.q, 'Busca', 120, true) || '';
      const limit = options.limit === undefined ? 50 : id(options.limit, 'Limite');
      if (limit > 100) throw authError(400, 'O limite da busca e 100 pessoas.');
      const pattern = '%' + query.replace(/[\\%_]/g, character => '\\' + character) + '%';
      return this.db.all(`SELECT ${PERSON_FIELDS} FROM participantes
        WHERE nome_completo LIKE ? ESCAPE '\\' OR COALESCE(nome_apelido, '') LIKE ? ESCAPE '\\'
        ORDER BY nome_completo COLLATE NOCASE, id LIMIT ?`, [pattern, pattern, limit]);
    });
  }

  async createParticipant(actorId, input = {}) {
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      body(input, ['nome_completo', 'nome_apelido']);
      const name = text(input.nome_completo, 'Nome', 120);
      const nickname = text(input.nome_apelido, 'Apelido', 80, true);
      const inserted = await this.db.run(`INSERT INTO participantes (nome_completo, nome_apelido, status)
        VALUES (?, ?, 'ativo')`, [name, nickname]);
      await this.audit('participant_created', actorId, inserted.id, null, null, null,
        { campos: nickname === null ? ['nome_completo'] : ['nome_completo', 'nome_apelido'] });
      return this.participant(inserted.id);
    });
  }

  async updateParticipant(actorId, participantId, input = {}) {
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      body(input, ['nome_completo', 'nome_apelido', 'motivo']);
      const previous = await this.participant(participantId);
      const explanation = reason(input.motivo);
      const fields = ['nome_completo', 'nome_apelido'].filter(field => Object.hasOwn(input, field));
      if (!fields.length) throw authError(400, 'Informe um nome ou apelido para atualizar.');
      const updates = {};
      if (fields.includes('nome_completo')) updates.nome_completo = text(input.nome_completo, 'Nome', 120);
      if (fields.includes('nome_apelido')) updates.nome_apelido = text(input.nome_apelido, 'Apelido', 80, true);
      const historical = await this.db.get(`SELECT mt.id FROM membros_tribo mt
        JOIN tribos t ON t.id = mt.tribo_id JOIN rallies r ON r.id = t.rally_id
        WHERE mt.participante_id = ? AND (r.legado = 1 OR r.status NOT IN ('planejamento', 'ativo')) LIMIT 1`, [previous.id]);
      if (historical) throw authError(409, 'O cadastro possui vinculo em edicao historica ou finalizada e e preservado para consulta.');
      const changed = fields.filter(field => updates[field] !== previous[field]);
      if (!changed.length) throw authError(409, 'Nenhuma alteracao foi informada.');
      await this.db.run(`UPDATE participantes SET ${changed.map(field => field + ' = ?').join(', ')} WHERE id = ?`,
        [...changed.map(field => updates[field]), previous.id]);
      await this.audit('participant_updated', actorId, previous.id, null, null, null, { campos: changed, motivo: explanation });
      return this.participant(previous.id);
    });
  }

  async getTeams(actorId, rallyId) {
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      const rally = await this.rally(rallyId);
      const tribes = await this.db.all('SELECT id, catalogo_id, nome, cor FROM tribos WHERE rally_id = ? ORDER BY nome', [rally.id]);
      const history = await this.db.all(PERIOD_SELECT + ' WHERE t.rally_id = ? ORDER BY mt.data_entrada DESC, mt.id DESC', [rally.id]);
      return { rally, tribos: tribes.map(tribe => ({ ...tribe, membros: history.filter(period => period.tribo_id === tribe.id && period.ativo === 1) })), historico: history };
    });
  }

  async addMember(actorId, rallyId, input = {}) {
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      body(input, ['tribo_id', 'participante_id', 'papel', 'data_entrada', 'motivo']);
      const rally = await this.rally(rallyId, true);
      const tribe = await this.tribe(rally.id, input.tribo_id);
      const person = await this.participant(input.participante_id, true);
      const memberRole = role(input.papel);
      const entry = date(input.data_entrada, 'Entrada');
      const explanation = reason(input.motivo);
      await this.assertNoOverlap(rally.id, person.id, entry);
      await this.assertLeadershipAvailable(tribe.id, memberRole);
      const inserted = await this.db.run(`INSERT INTO membros_tribo (tribo_id, participante_id, papel, data_entrada, ativo)
        VALUES (?, ?, ?, ?, 1)`, [tribe.id, person.id, memberRole, entry]);
      await this.audit('member_added', actorId, person.id, rally.id, null, inserted.id,
        { tribo_id: tribe.id, papel: memberRole, data_entrada: entry, motivo: explanation });
      return this.membership(rally.id, inserted.id);
    });
  }

  async endMembership(actorId, rallyId, memberId, input = {}) {
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      body(input, ['data_saida', 'motivo']);
      const rally = await this.rally(rallyId, true);
      const previous = await this.membership(rally.id, memberId, true);
      await this.participant(previous.participante_id, true);
      const departure = date(input.data_saida, 'Saida');
      const explanation = reason(input.motivo);
      await this.assertChronologicalChange(rally.id, previous, departure);
      await this.db.run('UPDATE membros_tribo SET ativo = 0, data_saida = ? WHERE id = ? AND ativo = 1', [departure, previous.id]);
      await this.audit('member_left', actorId, previous.participante_id, rally.id, previous.id, null,
        { tribo_id: previous.tribo_id, papel: previous.papel, data_entrada: previous.data_entrada, data_saida: departure, motivo: explanation });
      return this.membership(rally.id, previous.id);
    });
  }

  async replaceMembership(actorId, rallyId, memberId, input, transfer) {
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      body(input, transfer ? ['tribo_destino_id', 'papel', 'data', 'motivo'] : ['papel', 'data', 'motivo']);
      const rally = await this.rally(rallyId, true);
      const previous = await this.membership(rally.id, memberId, true);
      await this.participant(previous.participante_id, true);
      const destination = transfer ? await this.tribe(rally.id, input.tribo_destino_id) : await this.tribe(rally.id, previous.tribo_id);
      const memberRole = role(input.papel);
      const movementDate = date(input.data, 'Movimentacao');
      const explanation = reason(input.motivo);
      if (transfer && destination.id === previous.tribo_id) throw authError(409, 'Escolha outra tribo para transferir.');
      if (!transfer && memberRole === previous.papel) throw authError(409, 'Este integrante ja exerce o papel informado.');
      await this.assertChronologicalChange(rally.id, previous, movementDate);
      await this.assertNoOverlap(rally.id, previous.participante_id, movementDate, null, previous.id);
      await this.assertLeadershipAvailable(destination.id, memberRole, previous.id);
      await this.db.run('UPDATE membros_tribo SET ativo = 0, data_saida = ? WHERE id = ? AND ativo = 1', [movementDate, previous.id]);
      const inserted = await this.db.run(`INSERT INTO membros_tribo (tribo_id, participante_id, papel, data_entrada, ativo)
        VALUES (?, ?, ?, ?, 1)`, [destination.id, previous.participante_id, memberRole, movementDate]);
      await this.audit(transfer ? 'member_transferred' : 'member_role_changed', actorId, previous.participante_id, rally.id, previous.id, inserted.id,
        { tribo_anterior_id: previous.tribo_id, tribo_nova_id: destination.id, papel_anterior: previous.papel, papel_novo: memberRole, data: movementDate, motivo: explanation });
      return { anterior: await this.membership(rally.id, previous.id), atual: await this.membership(rally.id, inserted.id) };
    });
  }

  async transferMember(actorId, rallyId, memberId, input = {}) {
    return this.replaceMembership(actorId, rallyId, memberId, input, true);
  }

  async changeRole(actorId, rallyId, memberId, input = {}) {
    return this.replaceMembership(actorId, rallyId, memberId, input, false);
  }
}

module.exports = { TeamService };
