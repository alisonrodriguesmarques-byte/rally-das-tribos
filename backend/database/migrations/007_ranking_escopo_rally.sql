-- Migration 007: agrega pontuacoes no escopo de cada Rally antes de disponibilizar o ranking.
-- Subconsultas escalares evitam a multiplicacao de totais por JOINs com varios membros.

BEGIN;

DROP VIEW IF EXISTS v_ranking_atual;
CREATE VIEW v_ranking_atual AS
SELECT
    s.id,
    s.nome,
    s.rally_id,
    s.cor,
    s.total_participantes,
    s.pontuacao_total,
    RANK() OVER (
        PARTITION BY s.rally_id
        ORDER BY s.pontuacao_total DESC
    ) AS posicao
FROM (
    SELECT
        t.id,
        t.nome,
        t.rally_id,
        t.cor,
        (
            SELECT COUNT(*)
            FROM membros_tribo mt
            WHERE mt.tribo_id = t.id AND mt.ativo = 1
        ) AS total_participantes,
        COALESCE((
            SELECT SUM(p.pontos)
            FROM pontuacoes p
            WHERE p.tribo_id = t.id
              AND p.rally_id = t.rally_id
        ), 0) AS pontuacao_total
    FROM tribos t
) s;

COMMIT;