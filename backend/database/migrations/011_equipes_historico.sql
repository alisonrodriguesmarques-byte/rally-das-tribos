-- Team operations keep periods and an append-only administrative record.
CREATE TABLE team_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    rally_id INTEGER REFERENCES rallies(id) ON DELETE RESTRICT,
    participante_id INTEGER NOT NULL REFERENCES participantes(id) ON DELETE RESTRICT,
    membro_anterior_id INTEGER REFERENCES membros_tribo(id) ON DELETE RESTRICT,
    membro_novo_id INTEGER REFERENCES membros_tribo(id) ON DELETE RESTRICT,
    event TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_team_audit_rally ON team_audit(rally_id, id);
CREATE INDEX idx_team_audit_participante ON team_audit(participante_id, id);
CREATE TRIGGER team_audit_no_update BEFORE UPDATE ON team_audit
BEGIN SELECT RAISE(ABORT, 'Team audit is append-only'); END;
CREATE TRIGGER team_audit_no_delete BEFORE DELETE ON team_audit
BEGIN SELECT RAISE(ABORT, 'Team audit is append-only'); END;
CREATE TRIGGER team_audit_no_replace BEFORE INSERT ON team_audit
WHEN EXISTS (SELECT 1 FROM team_audit WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Team audit is append-only'); END;

-- One active head and one active auxiliary per team. Do not rewrite legacy
-- leadership or silently demote anyone. Vacancies are allowed during setup.
CREATE TRIGGER membro_lideranca_insert BEFORE INSERT ON membros_tribo
WHEN NEW.ativo = 1 AND NEW.papel IN ('lider', 'auxiliar') AND
    EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id
            WHERE t.id = NEW.tribo_id AND r.legado = 0) AND
    EXISTS (SELECT 1 FROM membros_tribo WHERE tribo_id = NEW.tribo_id
            AND papel = NEW.papel AND ativo = 1)
BEGIN SELECT RAISE(ABORT, 'A tribo permite apenas um cabeca e um auxiliar ativos'); END;
CREATE TRIGGER membro_lideranca_update BEFORE UPDATE ON membros_tribo
WHEN NEW.ativo = 1 AND NEW.papel IN ('lider', 'auxiliar') AND
    EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id
            WHERE t.id = NEW.tribo_id AND r.legado = 0) AND
    EXISTS (SELECT 1 FROM membros_tribo WHERE tribo_id = NEW.tribo_id
            AND papel = NEW.papel AND ativo = 1 AND id <> OLD.id)
BEGIN SELECT RAISE(ABORT, 'A tribo permite apenas um cabeca e um auxiliar ativos'); END;
