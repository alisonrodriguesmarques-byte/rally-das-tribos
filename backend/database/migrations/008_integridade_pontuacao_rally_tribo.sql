-- Migration 008: impede que pontuacoes associem um Rally a tribo de outro Rally.
-- Reversivel: DROP TRIGGER IF EXISTS check_pontuacao_rally_tribo_insert;
--            DROP TRIGGER IF EXISTS check_pontuacao_rally_tribo_update;
--            DROP TRIGGER IF EXISTS check_tribo_rally_com_pontuacoes;
-- A validacao preserva as FKs, triggers, indices e historico existentes.

BEGIN IMMEDIATE;

CREATE TRIGGER IF NOT EXISTS check_pontuacao_rally_tribo_insert
BEFORE INSERT ON pontuacoes
WHEN NOT EXISTS (
    SELECT 1 FROM tribos t
    WHERE t.id = NEW.tribo_id
      AND t.rally_id = NEW.rally_id
)
BEGIN
    SELECT RAISE(ABORT, 'A pontuacao deve pertencer ao Rally da tribo');
END;

CREATE TRIGGER IF NOT EXISTS check_pontuacao_rally_tribo_update
BEFORE UPDATE OF rally_id, tribo_id ON pontuacoes
WHEN NOT EXISTS (
    SELECT 1 FROM tribos t
    WHERE t.id = NEW.tribo_id
      AND t.rally_id = NEW.rally_id
)
BEGIN
    SELECT RAISE(ABORT, 'A pontuacao deve pertencer ao Rally da tribo');
END;

CREATE TRIGGER IF NOT EXISTS check_tribo_rally_com_pontuacoes
BEFORE UPDATE OF rally_id ON tribos
WHEN EXISTS (
    SELECT 1 FROM pontuacoes p
    WHERE p.tribo_id = OLD.id
      AND p.rally_id <> NEW.rally_id
)
BEGIN
    SELECT RAISE(ABORT, 'Uma tribo com pontuacoes nao pode mudar de Rally');
END;

COMMIT;
