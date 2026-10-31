-- Existing activity records stay private until explicitly published.
ALTER TABLE missoes ADD COLUMN publicada INTEGER NOT NULL DEFAULT 0 CHECK(publicada IN (0,1));
ALTER TABLE missoes ADD COLUMN abre_em INTEGER;
ALTER TABLE missoes ADD COLUMN encerra_em INTEGER;
ALTER TABLE provas ADD COLUMN respondedor TEXT CHECK(respondedor IN ('participantes','representante'));
ALTER TABLE provas ADD COLUMN abre_em INTEGER;
ALTER TABLE provas ADD COLUMN encerra_em INTEGER;
ALTER TABLE provas ADD COLUMN traducao TEXT;
ALTER TABLE quiz_questoes ADD COLUMN referencia TEXT;
ALTER TABLE quiz_questoes ADD COLUMN dificuldade TEXT;
CREATE TABLE missao_tribos (
 missao_id INTEGER NOT NULL REFERENCES missoes(id) ON DELETE RESTRICT,
 tribo_id INTEGER NOT NULL REFERENCES tribos(id) ON DELETE RESTRICT,
 PRIMARY KEY(missao_id,tribo_id)
);
CREATE TABLE prova_tribos (
 prova_id INTEGER NOT NULL REFERENCES provas(id) ON DELETE RESTRICT,
 tribo_id INTEGER NOT NULL REFERENCES tribos(id) ON DELETE RESTRICT,
 representante_id INTEGER REFERENCES participantes(id) ON DELETE RESTRICT,
 PRIMARY KEY(prova_id,tribo_id)
);
CREATE TABLE mission_deliveries (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 missao_id INTEGER NOT NULL REFERENCES missoes(id) ON DELETE RESTRICT,
 tribo_id INTEGER NOT NULL REFERENCES tribos(id) ON DELETE RESTRICT,
 actor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 membro_id INTEGER NOT NULL REFERENCES membros_tribo(id) ON DELETE RESTRICT,
 conteudo TEXT NOT NULL,
 estado TEXT NOT NULL DEFAULT 'pendente' CHECK(estado IN ('pendente','aprovada','rejeitada')),
 score_id INTEGER REFERENCES pontuacoes(id) ON DELETE RESTRICT,
 created_at INTEGER NOT NULL,
 decidido_por INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
 decidido_em INTEGER,
 motivo TEXT
);
CREATE UNIQUE INDEX idx_delivery_current ON mission_deliveries(missao_id,tribo_id) WHERE estado IN ('pendente','aprovada');
CREATE TABLE exam_attempts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 prova_id INTEGER NOT NULL REFERENCES provas(id) ON DELETE RESTRICT,
 tribo_id INTEGER NOT NULL REFERENCES tribos(id) ON DELETE RESTRICT,
 actor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 participante_id INTEGER NOT NULL REFERENCES participantes(id) ON DELETE RESTRICT,
 membro_id INTEGER NOT NULL REFERENCES membros_tribo(id) ON DELETE RESTRICT,
 slot TEXT NOT NULL,
 started_at INTEGER NOT NULL,
 deadline_at INTEGER NOT NULL,
 finished_at INTEGER,
 payload_hash TEXT,
 pontos INTEGER,
 score_id INTEGER REFERENCES pontuacoes(id) ON DELETE RESTRICT,
 UNIQUE(prova_id,slot), UNIQUE(prova_id,actor_id)
);
ALTER TABLE quiz_respostas ADD COLUMN tentativa_id INTEGER REFERENCES exam_attempts(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX idx_answer_attempt ON quiz_respostas(tentativa_id,questao_id) WHERE tentativa_id IS NOT NULL;
CREATE TABLE activity_awards (
 kind TEXT NOT NULL CHECK(kind IN ('missao','prova')),
 entity_id INTEGER NOT NULL,
 score_id INTEGER UNIQUE REFERENCES pontuacoes(id) ON DELETE RESTRICT,
 PRIMARY KEY(kind,entity_id)
);
CREATE TABLE activity_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 rally_id INTEGER REFERENCES rallies(id) ON DELETE RESTRICT,
 event TEXT NOT NULL,
 detail TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TRIGGER activity_audit_no_update BEFORE UPDATE ON activity_audit
BEGIN SELECT RAISE(ABORT,'Activity audit is append-only'); END;
CREATE TRIGGER activity_audit_no_delete BEFORE DELETE ON activity_audit
BEGIN SELECT RAISE(ABORT,'Activity audit is append-only'); END;
CREATE TRIGGER activity_audit_no_replace BEFORE INSERT ON activity_audit WHEN EXISTS(SELECT 1 FROM activity_audit WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'Activity audit is append-only'); END;
CREATE TRIGGER delivery_decision_final BEFORE UPDATE ON mission_deliveries WHEN OLD.estado<>'pendente'
BEGIN SELECT RAISE(ABORT,'Decisao final preservada'); END;
CREATE TRIGGER delivery_no_delete BEFORE DELETE ON mission_deliveries
BEGIN SELECT RAISE(ABORT,'Entrega preservada'); END;
CREATE TRIGGER attempt_final BEFORE UPDATE ON exam_attempts WHEN OLD.finished_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Resultado final preservado'); END;
CREATE TRIGGER attempt_no_delete BEFORE DELETE ON exam_attempts
BEGIN SELECT RAISE(ABORT,'Tentativa preservada'); END;
CREATE TRIGGER award_no_update BEFORE UPDATE ON activity_awards
BEGIN SELECT RAISE(ABORT,'Pontuacao de atividade preservada'); END;
CREATE TRIGGER award_no_delete BEFORE DELETE ON activity_awards
BEGIN SELECT RAISE(ABORT,'Pontuacao de atividade preservada'); END;
CREATE TRIGGER mission_deliveries_no_replace BEFORE INSERT ON mission_deliveries WHEN EXISTS(SELECT 1 FROM mission_deliveries WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'Resultado de atividade preservado'); END;
CREATE TRIGGER exam_attempts_no_replace BEFORE INSERT ON exam_attempts WHEN EXISTS(SELECT 1 FROM exam_attempts WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'Resultado de atividade preservado'); END;
CREATE TRIGGER activity_awards_no_replace BEFORE INSERT ON activity_awards WHEN EXISTS(SELECT 1 FROM activity_awards WHERE kind=NEW.kind AND entity_id=NEW.entity_id)
BEGIN SELECT RAISE(ABORT,'Resultado de atividade preservado'); END;
CREATE TRIGGER activity_answer_no_update BEFORE UPDATE ON quiz_respostas WHEN OLD.tentativa_id IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Resposta final preservada'); END;
CREATE TRIGGER activity_answer_no_delete BEFORE DELETE ON quiz_respostas WHEN OLD.tentativa_id IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Resposta final preservada'); END;
CREATE TRIGGER account_link_fixed BEFORE UPDATE OF usuario_id ON participantes
WHEN OLD.usuario_id IS NOT NULL AND NEW.usuario_id IS NOT OLD.usuario_id
BEGIN SELECT RAISE(ABORT,'Associacao de conta nao pode ser reatribuida'); END;
