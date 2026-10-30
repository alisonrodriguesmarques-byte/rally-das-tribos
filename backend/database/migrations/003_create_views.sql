-- Migration 003: Criação das views
-- Rally das Tribos - Views para consultas comuns

-- View: v_ranking_atual
-- Calcula o ranking atual das tribos para um rally
CREATE VIEW IF NOT EXISTS v_ranking_atual AS
SELECT
    t.id,
    t.nome,
    t.rally_id,
    t.cor,
    COUNT(DISTINCT mt.id) as total_participantes,
    COALESCE(SUM(p.pontos), 0) as pontuacao_total,
    ROW_NUMBER() OVER (PARTITION BY t.rally_id ORDER BY COALESCE(SUM(p.pontos), 0) DESC) as posicao
FROM tribos t
LEFT JOIN membros_tribo mt ON t.id = mt.tribo_id AND mt.ativo = 1
LEFT JOIN pontuacoes p ON t.id = p.tribo_id
GROUP BY t.id, t.nome, t.rally_id, t.cor;

-- View: v_pontuacoes_por_categoria
-- Soma pontuações por categoria para cada tribo
CREATE VIEW IF NOT EXISTS v_pontuacoes_por_categoria AS
SELECT
    t.id as tribo_id,
    t.nome as tribo_nome,
    cp.nome as categoria_nome,
    COALESCE(SUM(p.pontos), 0) as pontuacao_total
FROM tribos t
LEFT JOIN pontuacoes p ON t.id = p.tribo_id
LEFT JOIN categorias_pontos cp ON p.categoria_id = cp.id
GROUP BY t.id, t.nome, cp.nome;

-- View: v_historico_semanal
-- Mostra a evolução das pontuações por semana
CREATE VIEW IF NOT EXISTS v_historico_semanal AS
SELECT
    t.id as tribo_id,
    t.nome as tribo_nome,
    strftime('%Y-%W', p.data_registro) as semana,
    COALESCE(SUM(p.pontos), 0) as pontuacao_semana
FROM tribos t
LEFT JOIN pontuacoes p ON t.id = p.tribo_id
GROUP BY t.id, t.nome, strftime('%Y-%W', p.data_registro)
ORDER BY semana DESC, pontuacao_semana DESC;

-- View: v_membros_por_tribo
-- Mostra os membros de cada tribo com seus papéis
CREATE VIEW IF NOT EXISTS v_membros_por_tribo AS
SELECT
    t.id as tribo_id,
    t.nome as tribo_nome,
    t.rally_id,
    p.id as participante_id,
    p.nome_completo,
    p.nome_apelido,
    mt.papel,
    mt.ativo,
    mt.data_entrada
FROM tribos t
JOIN membros_tribo mt ON t.id = mt.tribo_id
JOIN participantes p ON mt.participante_id = p.id
ORDER BY t.nome, mt.papel DESC, p.nome_completo;
