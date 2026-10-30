-- Migration 006: status planejamento, unicidade de tribos por rally e ranking com RANK()
-- Preserva registros existentes. Não converte status automaticamente.

PRAGMA foreign_keys = OFF;

BEGIN;

-- Repair the trigger created by migration 005 using explicit NEW row references.
DROP TRIGGER IF EXISTS check_pontuacao_origem;
CREATE TRIGGER check_pontuacao_origem
BEFORE INSERT ON pontuacoes
WHEN (NEW.prova_id IS NOT NULL AND NEW.missao_id IS NOT NULL) OR
      (NEW.prova_id IS NOT NULL AND NEW.dinamica_id IS NOT NULL) OR
      (NEW.missao_id IS NOT NULL AND NEW.dinamica_id IS NOT NULL)
BEGIN
    SELECT RAISE(ABORT, 'Apenas uma origem (prova_id, missao_id ou dinamica_id) deve ser informada');
END;
CREATE TABLE rallies_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'planejamento' CHECK(status IN ('planejamento', 'ativo', 'encerrado', 'arquivado', 'cancelado')),
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO rallies_new (id, nome, descricao, data_inicio, data_fim, status, data_criacao, data_atualizacao)
SELECT id, nome, descricao, data_inicio, data_fim, status, data_criacao, data_atualizacao
FROM rallies;

DROP TABLE rallies;
ALTER TABLE rallies_new RENAME TO rallies;

CREATE INDEX IF NOT EXISTS idx_rallies_status ON rallies(status);
CREATE INDEX IF NOT EXISTS idx_rallies_datas ON rallies(data_inicio, data_fim);

DROP TRIGGER IF EXISTS update_data_atualizacao_rallies;
CREATE TRIGGER update_data_atualizacao_rallies
AFTER UPDATE ON rallies
BEGIN
    UPDATE rallies SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tribos_rally_nome ON tribos(rally_id, nome);

DROP VIEW IF EXISTS v_ranking_atual;
CREATE VIEW v_ranking_atual AS
SELECT
    s.id,
    s.nome,
    s.rally_id,
    s.cor,
    s.total_participantes,
    s.pontuacao_total,
    RANK() OVER (PARTITION BY s.rally_id ORDER BY s.pontuacao_total DESC) AS posicao
FROM (
    SELECT
        t.id,
        t.nome,
        t.rally_id,
        t.cor,
        (SELECT COUNT(*) FROM membros_tribo mt WHERE mt.tribo_id = t.id AND mt.ativo = 1) AS total_participantes,
        COALESCE((SELECT SUM(p.pontos) FROM pontuacoes p WHERE p.tribo_id = t.id), 0) AS pontuacao_total
    FROM tribos t
) s;

COMMIT;

PRAGMA foreign_keys = ON;
