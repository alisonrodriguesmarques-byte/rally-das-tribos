-- Authentication for the explicitly provisioned synthetic development workflow.
-- Existing accounts remain pending: no implicit approval or password conversion.
ALTER TABLE usuarios ADD COLUMN aprovacao TEXT NOT NULL DEFAULT 'pendente'
    CHECK (aprovacao IN ('pendente', 'aprovado', 'rejeitado'));
ALTER TABLE usuarios ADD COLUMN aprovado_por INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE usuarios ADD COLUMN data_aprovacao INTEGER;

CREATE UNIQUE INDEX idx_usuarios_email_normalizado ON usuarios(lower(email));

CREATE TABLE auth_sessions (
    session_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    csrf_token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    CHECK (length(session_hash) = 64),
    CHECK (length(csrf_token) = 64),
    CHECK (expires_at > created_at),
    CHECK (last_seen_at >= created_at)
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE auth_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    target_user_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    event TEXT NOT NULL,
    detail TEXT,
    created_at INTEGER NOT NULL
);
CREATE TRIGGER auth_audit_no_update BEFORE UPDATE ON auth_audit
BEGIN
    SELECT RAISE(ABORT, 'Authentication audit is append-only');
END;
CREATE TRIGGER auth_audit_no_delete BEFORE DELETE ON auth_audit
BEGIN
    SELECT RAISE(ABORT, 'Authentication audit is append-only');
END;

CREATE TABLE auth_bootstrap (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    used_at INTEGER NOT NULL,
    admin_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE RESTRICT
);
CREATE TRIGGER auth_bootstrap_no_update BEFORE UPDATE ON auth_bootstrap
BEGIN
    SELECT RAISE(ABORT, 'Administrator bootstrap is already consumed');
END;
CREATE TRIGGER auth_bootstrap_no_delete BEFORE DELETE ON auth_bootstrap
BEGIN
    SELECT RAISE(ABORT, 'Administrator bootstrap is already consumed');
END;
