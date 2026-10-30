-- Migration 005: Triggers para validações e integridade
-- Rally das Tribos - Triggers para garantir regras de negócio

-- Trigger: check_pontuacao_origem
-- Garante que apenas uma origem (prova_id, missao_id, dinamica_id) seja informada por pontuação
CREATE TRIGGER IF NOT EXISTS check_pontuacao_origem
BEFORE INSERT ON pontuacoes
WHEN (NEW.prova_id IS NOT NULL AND NEW.missao_id IS NOT NULL) OR
      (NEW.prova_id IS NOT NULL AND NEW.dinamica_id IS NOT NULL) OR
      (NEW.missao_id IS NOT NULL AND NEW.dinamica_id IS NOT NULL)
BEGIN
    SELECT RAISE(ABORT, 'Apenas uma origem (prova_id, missao_id ou dinamica_id) deve ser informada');
END;

-- Trigger: check_participante_unico_tribo
-- Garante que um participante esteja em apenas uma tribo por rally
CREATE TRIGGER IF NOT EXISTS check_participante_unico_tribo
BEFORE INSERT ON membros_tribo
WHEN EXISTS (
    SELECT 1 FROM membros_tribo mt
    JOIN tribos t ON mt.tribo_id = t.id
    WHERE mt.participante_id = NEW.participante_id
    AND mt.tribo_id IN (SELECT id FROM tribos WHERE rally_id = (SELECT rally_id FROM tribos WHERE id = NEW.tribo_id))
    AND mt.ativo = 1
)
BEGIN
    SELECT RAISE(ABORT, 'Participante já está em uma tribo deste rally');
END;

-- Trigger: update_data_atualizacao_rallies
-- Atualiza automaticamente o campo data_atualizacao quando há alterações
CREATE TRIGGER IF NOT EXISTS update_data_atualizacao_rallies
AFTER UPDATE ON rallies
BEGIN
    UPDATE rallies SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: update_data_atualizacao_tribos
CREATE TRIGGER IF NOT EXISTS update_data_atualizacao_tribos
AFTER UPDATE ON tribos
BEGIN
    UPDATE tribos SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: update_data_atualizacao_participantes
CREATE TRIGGER IF NOT EXISTS update_data_atualizacao_participantes
AFTER UPDATE ON participantes
BEGIN
    UPDATE participantes SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: update_data_atualizacao_membros_tribo
CREATE TRIGGER IF NOT EXISTS update_data_atualizacao_membros_tribo
AFTER UPDATE ON membros_tribo
BEGIN
    UPDATE membros_tribo SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: update_data_atualizacao_missoes
CREATE TRIGGER IF NOT EXISTS update_data_atualizacao_missoes
AFTER UPDATE ON missoes
BEGIN
    UPDATE missoes SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: update_data_atualizacao_provas
CREATE TRIGGER IF NOT EXISTS update_data_atualizacao_provas
AFTER UPDATE ON provas
BEGIN
    UPDATE provas SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger: update_data_atualizacao_dinamicas
CREATE TRIGGER IF NOT EXISTS update_data_atualizacao_dinamicas
AFTER UPDATE ON dinamicas
BEGIN
    UPDATE dinamicas SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
