'use strict';

const crypto = require('crypto');
const { hashPassword, verifyPassword, validatePassword } = require('../utils/password');

const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const IDLE_MS = 30 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const USER_FIELDS = 'id, nome_completo, email, tipo_usuario, status, aprovacao';
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function authError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  if (code) error.code = code;
  return error;
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeEmail(email) {
  if (typeof email !== 'string') throw authError(400, 'Informe um email valido.');
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw authError(400, 'Informe um email valido.');
  }
  return normalized;
}

function publicUser(row) {
  return Object.fromEntries(USER_FIELDS.split(', ').map(field => [field, row[field]]));
}

function parseId(id) {
  const parsed = typeof id === 'number' ? id : (/^[1-9]\d*$/.test(id || '') ? Number(id) : NaN);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw authError(400, 'Identificador invalido.');
  return parsed;
}

function reason(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 500) {
    throw authError(400, 'Informe um motivo de ate 500 caracteres.');
  }
  return value.trim();
}

function validUser(row) {
  return Boolean(row && row.status === 'ativo' && row.aprovacao === 'aprovado');
}

class AuthService {
  constructor(db, { now = () => Date.now(), absoluteMs = ABSOLUTE_MS, idleMs = IDLE_MS } = {}) {
    if (typeof now !== 'function' || !Number.isSafeInteger(absoluteMs) || absoluteMs <= 0 ||
        absoluteMs > ABSOLUTE_MS || !Number.isSafeInteger(idleMs) || idleMs <= 0 || idleMs > IDLE_MS) {
      throw new Error('Invalid authentication clock or session limits');
    }
    this.db = db;
    this.now = now;
    this.absoluteMs = absoluteMs;
    this.idleMs = idleMs;
    this.attempts = new Map();
  }

  async audit(event, actorId, targetId, detail = {}) {
    await this.db.run('INSERT INTO auth_audit (actor_id, target_user_id, event, detail, created_at) VALUES (?, ?, ?, ?, ?)',
      [actorId, targetId, event, JSON.stringify(detail), this.now()]);
  }

  rateLimit(email, source) {
    const now = this.now();
    for (const [key, bucket] of this.attempts) {
      if (now >= bucket.until) this.attempts.delete(key);
    }
    const sourceKey = digest(String(source || 'local'));
    const keys = [['ip:' + sourceKey, 100], ['account:' + sourceKey + ':' + digest(email), 10]];
    if (keys.some(([key, limit]) => (this.attempts.get(key)?.count || 0) >= limit)) {
      throw authError(429, 'Muitas tentativas. Aguarde antes de tentar novamente.', 'AUTH_RATE_LIMIT');
    }
    if (this.attempts.size + keys.filter(([key]) => !this.attempts.has(key)).length > 10000) {
      throw authError(429, 'Muitas tentativas. Aguarde antes de tentar novamente.', 'AUTH_RATE_LIMIT');
    }
    for (const [key] of keys) {
      const bucket = this.attempts.get(key) || { count: 0, until: now + RATE_WINDOW_MS };
      bucket.count++;
      this.attempts.set(key, bucket);
    }
  }

  async login(email, password, { source = 'local', previousToken } = {}) {
    const normalizedEmail = normalizeEmail(email);
    this.rateLimit(normalizedEmail, source);
    if (typeof password !== 'string' || password.length > 128 || Buffer.byteLength(password, 'utf8') > 512) {
      throw authError(400, 'Informe email e senha validos.');
    }
    const found = await this.db.get('SELECT * FROM usuarios WHERE lower(email) = ?', [normalizedEmail]);
    const correct = await verifyPassword(password, found?.senha_hash);
    if (!correct || !validUser(found)) {
      await this.audit('login_failed', null, null);
      throw authError(401, 'Email ou senha invalidos, ou conta indisponivel.', 'AUTH_INVALID_CREDENTIALS');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const sessionHash = digest(token);
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const created = this.now();
    const user = await this.db.transaction(async () => {
      const current = await this.db.get('SELECT * FROM usuarios WHERE id = ?', [found.id]);
      if (!validUser(current) || current.senha_hash !== found.senha_hash) {
        throw authError(401, 'Email ou senha invalidos, ou conta indisponivel.', 'AUTH_INVALID_CREDENTIALS');
      }
      if (TOKEN_PATTERN.test(previousToken || '')) {
        const previous = await this.db.get('SELECT user_id FROM auth_sessions WHERE session_hash = ? AND revoked_at IS NULL', [digest(previousToken)]);
        if (previous) {
          await this.db.run('UPDATE auth_sessions SET revoked_at = ? WHERE session_hash = ?', [created, digest(previousToken)]);
          await this.audit('session_rotated', previous.user_id, previous.user_id);
        }
      }
      await this.db.run('INSERT INTO auth_sessions (session_hash, user_id, csrf_token, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionHash, found.id, csrfToken, created, created, created + this.absoluteMs]);
      await this.audit('login_success', found.id, found.id);
      return publicUser(current);
    });
    // Successful credentials reset only their own bucket. Keep the per-source
    // ceiling to prevent cycling accounts from bypassing the broader limit.
    this.attempts.delete('account:' + digest(String(source || 'local')) + ':' + digest(normalizedEmail));
    return { token, user, csrfToken, sessionHash, expiresAt: created + this.absoluteMs };
  }

  async authenticate(token) {
    if (!TOKEN_PATTERN.test(token || '')) return null;
    const sessionHash = digest(token);
    return this.db.transaction(async () => {
      const row = await this.db.get(`SELECT u.*, s.csrf_token, s.created_at AS session_created_at,
        s.last_seen_at, s.expires_at, s.revoked_at FROM auth_sessions s
        JOIN usuarios u ON u.id = s.user_id WHERE s.session_hash = ?`, [sessionHash]);
      if (!row || row.revoked_at !== null) return null;
      const now = this.now();
      if (!validUser(row) || row.expires_at <= now || row.last_seen_at + this.idleMs <= now ||
          row.session_created_at > now || row.last_seen_at > now) {
        await this.db.run('UPDATE auth_sessions SET revoked_at = ? WHERE session_hash = ? AND revoked_at IS NULL', [now, sessionHash]);
        await this.audit('session_invalidated', row.id, row.id);
        return null;
      }
      await this.db.run('UPDATE auth_sessions SET last_seen_at = ? WHERE session_hash = ?', [now, sessionHash]);
      return { user: publicUser(row), csrfToken: row.csrf_token, sessionHash, expiresAt: row.expires_at };
    });
  }

  async logout(token) {
    if (!TOKEN_PATTERN.test(token || '')) return;
    const sessionHash = digest(token);
    await this.db.transaction(async () => {
      const session = await this.db.get('SELECT user_id FROM auth_sessions WHERE session_hash = ? AND revoked_at IS NULL', [sessionHash]);
      if (!session) return;
      await this.db.run('UPDATE auth_sessions SET revoked_at = ? WHERE session_hash = ?', [this.now(), sessionHash]);
      await this.audit('logout', session.user_id, session.user_id);
    });
  }

  async assertAdmin(actorId) {
    const actor = await this.db.get('SELECT ' + USER_FIELDS + ' FROM usuarios WHERE id = ?', [parseId(actorId)]);
    if (!validUser(actor) || actor.tipo_usuario !== 'admin') throw authError(403, 'Acesso restrito ao administrador.');
    return actor;
  }

  async listUsers(actorId) {
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      return this.db.all('SELECT ' + USER_FIELDS + ' FROM usuarios ORDER BY id');
    });
  }

  async createUser(actorId, input = {}) {
    // Validate before spending scrypt resources, and recheck the actor in the write transaction.
    await this.assertAdmin(actorId);
    const email = normalizeEmail(input.email);
    const name = typeof input.nome_completo === 'string' ? input.nome_completo.trim() : '';
    if (!name || name.length > 120) throw authError(400, 'Informe um nome de ate 120 caracteres.');
    if (!['lider', 'auxiliar', 'participante'].includes(input.tipo_usuario)) throw authError(400, 'Perfil de usuario invalido.');
    validatePassword(input.password);
    const passwordHash = await hashPassword(input.password);
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      if (await this.db.get('SELECT id FROM usuarios WHERE lower(email) = ?', [email])) throw authError(409, 'Este email ja esta cadastrado.');
      const inserted = await this.db.run(`INSERT INTO usuarios (nome_completo, email, senha_hash, tipo_usuario, status, aprovacao)
        VALUES (?, ?, ?, ?, 'ativo', 'pendente')`, [name, email, passwordHash, input.tipo_usuario]);
      await this.audit('user_created', actorId, inserted.id, { tipo_usuario: input.tipo_usuario });
      return this.db.get('SELECT ' + USER_FIELDS + ' FROM usuarios WHERE id = ?', [inserted.id]);
    });
  }

  async reviewUser(actorId, userId, approval, explanation) {
    const id = parseId(userId);
    if (!['aprovado', 'rejeitado'].includes(approval)) throw authError(400, 'Decisao de aprovacao invalida.');
    const motive = reason(explanation);
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      const target = await this.db.get('SELECT ' + USER_FIELDS + ' FROM usuarios WHERE id = ?', [id]);
      if (!target) throw authError(404, 'Usuario nao encontrado.');
      if (id === Number(actorId) || target.tipo_usuario === 'admin') throw authError(403, 'Esta conta administrativa nao pode ser alterada por esta operacao.');
      if (target.aprovacao === approval) throw authError(409, 'Esta decisao ja foi registrada.');
      const now = this.now();
      await this.db.run('UPDATE usuarios SET aprovacao = ?, aprovado_por = ?, data_aprovacao = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?',
        [approval, actorId, now, id]);
      await this.db.run('UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [now, id]);
      await this.audit('user_approval_changed', actorId, id, { anterior: target.aprovacao, novo: approval, motivo: motive });
      return this.db.get('SELECT ' + USER_FIELDS + ' FROM usuarios WHERE id = ?', [id]);
    });
  }

  async setUserStatus(actorId, userId, status, explanation) {
    const id = parseId(userId);
    if (!['ativo', 'inativo'].includes(status)) throw authError(400, 'Status de usuario invalido.');
    const motive = reason(explanation);
    return this.db.transaction(async () => {
      await this.assertAdmin(actorId);
      const target = await this.db.get('SELECT ' + USER_FIELDS + ' FROM usuarios WHERE id = ?', [id]);
      if (!target) throw authError(404, 'Usuario nao encontrado.');
      if (id === Number(actorId) || target.tipo_usuario === 'admin') throw authError(403, 'Esta conta administrativa nao pode ser alterada por esta operacao.');
      if (target.status === status) throw authError(409, 'Este status ja esta registrado.');
      await this.db.run('UPDATE usuarios SET status = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
      await this.db.run('UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [this.now(), id]);
      await this.audit('user_status_changed', actorId, id, { anterior: target.status, novo: status, motivo: motive });
      return this.db.get('SELECT ' + USER_FIELDS + ' FROM usuarios WHERE id = ?', [id]);
    });
  }
}

module.exports = { AuthService, authError, normalizeEmail };
