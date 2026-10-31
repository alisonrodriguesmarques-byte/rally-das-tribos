-- Append compensation entries instead of rewriting scores.
ALTER TABLE pontuacoes ADD COLUMN compensa_id INTEGER REFERENCES pontuacoes(id) ON DELETE RESTRICT;
ALTER TABLE pontuacoes ADD COLUMN corrige_id INTEGER REFERENCES pontuacoes(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX idx_pontuacao_compensa ON pontuacoes(compensa_id) WHERE compensa_id IS NOT NULL;
CREATE TABLE score_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 rally_id INTEGER NOT NULL REFERENCES rallies(id) ON DELETE RESTRICT,
 request_key TEXT NOT NULL,
 payload_hash TEXT NOT NULL,
 result_id INTEGER NOT NULL REFERENCES pontuacoes(id) ON DELETE RESTRICT,
 UNIQUE(rally_id, request_key)
);
CREATE TRIGGER pontuacoes_append_update BEFORE UPDATE ON pontuacoes
BEGIN SELECT RAISE(ABORT, 'Corrija por lancamento compensatorio, sem editar o original'); END;
CREATE TRIGGER pontuacoes_append_delete BEFORE DELETE ON pontuacoes
BEGIN SELECT RAISE(ABORT, 'Historico de pontos nao pode ser apagado'); END;
CREATE TRIGGER historico_append_update BEFORE UPDATE ON historico_pontuacoes
BEGIN SELECT RAISE(ABORT, 'Historico de pontos e append-only'); END;
CREATE TRIGGER historico_append_delete BEFORE DELETE ON historico_pontuacoes
BEGIN SELECT RAISE(ABORT, 'Historico de pontos e append-only'); END;
CREATE TRIGGER score_requests_no_update BEFORE UPDATE ON score_requests
BEGIN SELECT RAISE(ABORT, 'Registro de operacao e imutavel'); END;
CREATE TRIGGER score_requests_no_delete BEFORE DELETE ON score_requests
BEGIN SELECT RAISE(ABORT, 'Registro de operacao e imutavel'); END;
