-- Global identity is separate from each Rally's participation (tribos.id).
CREATE TABLE tribos_catalogo (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    cor TEXT NOT NULL
);
INSERT INTO tribos_catalogo (id, nome, cor) VALUES
(1, 'Rúben', '#20E6D2'), (2, 'Simeão', '#E54855'),
(3, 'Levi', '#102A43'), (4, 'Judá', '#F5F7FA'),
(5, 'Dã', '#20E6D2'), (6, 'Naftali', '#E54855'),
(7, 'Gade', '#102A43'), (8, 'Aser', '#F5F7FA'),
(9, 'Issacar', '#20E6D2'), (10, 'Zebulom', '#E54855'),
(11, 'José', '#102A43'), (12, 'Benjamim', '#F5F7FA');

ALTER TABLE rallies ADD COLUMN legado INTEGER NOT NULL DEFAULT 0 CHECK (legado IN (0, 1));
ALTER TABLE tribos ADD COLUMN catalogo_id INTEGER REFERENCES tribos_catalogo(id) ON DELETE RESTRICT;

-- Backfill metadata only. Preserve historical names, colours, IDs and timestamps.
DROP TRIGGER update_data_atualizacao_rallies;
DROP TRIGGER update_data_atualizacao_tribos;
UPDATE rallies SET legado = 1;
UPDATE tribos SET catalogo_id = (SELECT id FROM tribos_catalogo WHERE nome = tribos.nome);
CREATE TRIGGER update_data_atualizacao_rallies AFTER UPDATE ON rallies
BEGIN
    UPDATE rallies SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE TRIGGER update_data_atualizacao_tribos AFTER UPDATE ON tribos
BEGIN
    UPDATE tribos SET data_atualizacao = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
CREATE UNIQUE INDEX idx_tribos_rally_catalogo ON tribos(rally_id, catalogo_id) WHERE catalogo_id IS NOT NULL;

CREATE TRIGGER catalogo_no_insert BEFORE INSERT ON tribos_catalogo
BEGIN SELECT RAISE(ABORT, 'O catalogo oficial e somente consulta'); END;
CREATE TRIGGER catalogo_no_update BEFORE UPDATE ON tribos_catalogo
BEGIN SELECT RAISE(ABORT, 'O catalogo oficial e somente consulta'); END;
CREATE TRIGGER catalogo_no_delete BEFORE DELETE ON tribos_catalogo
BEGIN SELECT RAISE(ABORT, 'O catalogo oficial e somente consulta'); END;

CREATE TRIGGER rally_new_rules BEFORE INSERT ON rallies
WHEN NEW.legado <> 0 OR NEW.status <> 'planejamento'
BEGIN SELECT RAISE(ABORT, 'Novo Rally deve iniciar em planejamento e nao pode ser legado'); END;
CREATE TRIGGER rally_legacy_flag_fixed BEFORE UPDATE OF legado ON rallies
WHEN NEW.legado <> OLD.legado
BEGIN SELECT RAISE(ABORT, 'A classificacao de legado nao pode ser alterada'); END;
CREATE TRIGGER rally_legacy_readonly BEFORE UPDATE ON rallies WHEN OLD.legado = 1
BEGIN SELECT RAISE(ABORT, 'Rally legado e somente consulta'); END;
CREATE TRIGGER rally_legacy_no_delete BEFORE DELETE ON rallies WHEN OLD.legado = 1
BEGIN SELECT RAISE(ABORT, 'Rally legado e somente consulta'); END;
CREATE TRIGGER rally_valid_transition BEFORE UPDATE OF status ON rallies
WHEN NEW.status <> OLD.status AND NOT (
    (OLD.status = 'planejamento' AND NEW.status IN ('ativo', 'cancelado')) OR
    (OLD.status = 'ativo' AND NEW.status = 'encerrado') OR
    (OLD.status = 'encerrado' AND NEW.status = 'arquivado'))
BEGIN SELECT RAISE(ABORT, 'Transicao de estado do Rally invalida'); END;
CREATE TRIGGER rally_start_two BEFORE UPDATE OF status ON rallies
WHEN NEW.status = 'ativo' AND OLD.status <> 'ativo' AND (
    (SELECT COUNT(*) FROM tribos WHERE rally_id = OLD.id) <> 2 OR
    (SELECT COUNT(DISTINCT catalogo_id) FROM tribos WHERE rally_id = OLD.id) <> 2)
BEGIN SELECT RAISE(ABORT, 'O Rally precisa de exatamente duas tribos oficiais distintas'); END;
CREATE TRIGGER rally_final_metadata BEFORE UPDATE ON rallies
WHEN OLD.status IN ('encerrado', 'arquivado', 'cancelado') AND
    (NEW.nome IS NOT OLD.nome OR NEW.descricao IS NOT OLD.descricao OR
     NEW.data_inicio IS NOT OLD.data_inicio OR NEW.data_fim IS NOT OLD.data_fim)
BEGIN SELECT RAISE(ABORT, 'Os dados de uma edicao finalizada sao somente consulta'); END;

CREATE TRIGGER tribo_selected_only BEFORE INSERT ON tribos
BEGIN
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 0 AND status = 'planejamento')
        THEN RAISE(ABORT, 'Selecao de tribos permitida apenas no planejamento de novo Rally') END;
    SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM tribos_catalogo WHERE id = NEW.catalogo_id AND nome = NEW.nome)
        THEN RAISE(ABORT, 'Selecione uma tribo do catalogo oficial') END;
    SELECT CASE WHEN (SELECT COUNT(*) FROM tribos WHERE rally_id = NEW.rally_id) >= 2
        THEN RAISE(ABORT, 'O Rally aceita somente duas tribos') END;
END;
CREATE TRIGGER tribo_identity_fixed BEFORE UPDATE OF id, rally_id, catalogo_id, nome ON tribos
WHEN NEW.id IS NOT OLD.id OR NEW.rally_id IS NOT OLD.rally_id OR NEW.catalogo_id IS NOT OLD.catalogo_id OR NEW.nome IS NOT OLD.nome
BEGIN SELECT RAISE(ABORT, 'Use a selecao de tribos no planejamento; identidade da participacao e preservada'); END;
CREATE TRIGGER tribo_legacy_readonly BEFORE UPDATE ON tribos
WHEN EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1)
BEGIN SELECT RAISE(ABORT, 'Tribo de Rally legado e somente consulta'); END;
CREATE TRIGGER tribo_selection_delete BEFORE DELETE ON tribos
WHEN NOT EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 0 AND status = 'planejamento')
BEGIN SELECT RAISE(ABORT, 'As tribos escolhidas ficam fixas apos o inicio; integrantes podem mudar'); END;

-- A member is a historical period of participation, not the team's identity.
-- Active Rallys allow entries and exits. Transfers close one link and open another.
DROP TRIGGER check_participante_unico_tribo;
CREATE TRIGGER check_participante_unico_tribo BEFORE INSERT ON membros_tribo
WHEN NEW.ativo = 1 AND EXISTS (
    SELECT 1 FROM membros_tribo mt JOIN tribos t ON t.id = mt.tribo_id
    WHERE mt.participante_id = NEW.participante_id AND mt.ativo = 1
      AND t.rally_id = (SELECT rally_id FROM tribos WHERE id = NEW.tribo_id))
BEGIN SELECT RAISE(ABORT, 'Participante ja esta em uma tribo deste rally'); END;
CREATE TRIGGER check_participante_unico_tribo_update BEFORE UPDATE ON membros_tribo
WHEN NEW.ativo = 1 AND EXISTS (
    SELECT 1 FROM membros_tribo mt JOIN tribos t ON t.id = mt.tribo_id
    WHERE mt.id <> OLD.id AND mt.participante_id = NEW.participante_id AND mt.ativo = 1
      AND t.rally_id = (SELECT rally_id FROM tribos WHERE id = NEW.tribo_id))
BEGIN SELECT RAISE(ABORT, 'Participante ja esta em uma tribo deste rally'); END;
CREATE TRIGGER membro_period_identity BEFORE UPDATE OF id, tribo_id, participante_id, data_entrada, papel ON membros_tribo
WHEN NEW.id IS NOT OLD.id OR NEW.tribo_id IS NOT OLD.tribo_id OR NEW.participante_id IS NOT OLD.participante_id OR NEW.data_entrada IS NOT OLD.data_entrada OR NEW.papel IS NOT OLD.papel
BEGIN SELECT RAISE(ABORT, 'Preserve o vinculo anterior e registre novo periodo para transferir integrante'); END;
CREATE TRIGGER membro_history_no_delete BEFORE DELETE ON membros_tribo
BEGIN SELECT RAISE(ABORT, 'Preserve o historico: encerre o vinculo sem excluir'); END;
CREATE TRIGGER membro_rally_writable_insert BEFORE INSERT ON membros_tribo
WHEN NOT EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id
    WHERE t.id = NEW.tribo_id AND r.legado = 0 AND r.status IN ('planejamento', 'ativo'))
BEGIN SELECT RAISE(ABORT, 'Integrantes podem mudar no planejamento ou durante Rally ativo'); END;
CREATE TRIGGER membro_rally_writable_update BEFORE UPDATE ON membros_tribo
WHEN NOT EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id
    WHERE t.id = OLD.tribo_id AND r.legado = 0 AND r.status IN ('planejamento', 'ativo'))
BEGIN SELECT RAISE(ABORT, 'Historico de integrantes de edicao finalizada ou legada e somente consulta'); END;

CREATE TRIGGER membro_closed_period BEFORE UPDATE ON membros_tribo
WHEN OLD.ativo = 0 AND (NEW.ativo IS NOT OLD.ativo OR NEW.data_saida IS NOT OLD.data_saida)
BEGIN SELECT RAISE(ABORT, 'Vinculo encerrado e historico; registre novo periodo para retornar'); END;

-- Preserve legacy activity/results through direct SQL as well as the API.
CREATE TRIGGER legado_pontuacoes_insert BEFORE INSERT ON pontuacoes
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_pontuacoes_update BEFORE UPDATE ON pontuacoes
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1)) OR (EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_pontuacoes_delete BEFORE DELETE ON pontuacoes
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_missoes_insert BEFORE INSERT ON missoes
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_missoes_update BEFORE UPDATE ON missoes
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1)) OR (EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_missoes_delete BEFORE DELETE ON missoes
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_provas_insert BEFORE INSERT ON provas
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_provas_update BEFORE UPDATE ON provas
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1)) OR (EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_provas_delete BEFORE DELETE ON provas
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_dinamicas_insert BEFORE INSERT ON dinamicas
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_dinamicas_update BEFORE UPDATE ON dinamicas
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1)) OR (EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_dinamicas_delete BEFORE DELETE ON dinamicas
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_categorias_pontos_insert BEFORE INSERT ON categorias_pontos
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_categorias_pontos_update BEFORE UPDATE ON categorias_pontos
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1)) OR (EXISTS (SELECT 1 FROM rallies WHERE id = NEW.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_categorias_pontos_delete BEFORE DELETE ON categorias_pontos
WHEN (EXISTS (SELECT 1 FROM rallies WHERE id = OLD.rally_id AND legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_quiz_questoes_insert BEFORE INSERT ON quiz_questoes
WHEN (EXISTS (SELECT 1 FROM provas p JOIN rallies r ON r.id = p.rally_id WHERE p.id = NEW.prova_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_quiz_questoes_update BEFORE UPDATE ON quiz_questoes
WHEN (EXISTS (SELECT 1 FROM provas p JOIN rallies r ON r.id = p.rally_id WHERE p.id = OLD.prova_id AND r.legado = 1)) OR (EXISTS (SELECT 1 FROM provas p JOIN rallies r ON r.id = p.rally_id WHERE p.id = NEW.prova_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_quiz_questoes_delete BEFORE DELETE ON quiz_questoes
WHEN (EXISTS (SELECT 1 FROM provas p JOIN rallies r ON r.id = p.rally_id WHERE p.id = OLD.prova_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_quiz_alternativas_insert BEFORE INSERT ON quiz_alternativas
WHEN (EXISTS (SELECT 1 FROM quiz_questoes q JOIN provas p ON p.id = q.prova_id JOIN rallies r ON r.id = p.rally_id WHERE q.id = NEW.questao_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_quiz_alternativas_update BEFORE UPDATE ON quiz_alternativas
WHEN (EXISTS (SELECT 1 FROM quiz_questoes q JOIN provas p ON p.id = q.prova_id JOIN rallies r ON r.id = p.rally_id WHERE q.id = OLD.questao_id AND r.legado = 1)) OR (EXISTS (SELECT 1 FROM quiz_questoes q JOIN provas p ON p.id = q.prova_id JOIN rallies r ON r.id = p.rally_id WHERE q.id = NEW.questao_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_quiz_alternativas_delete BEFORE DELETE ON quiz_alternativas
WHEN (EXISTS (SELECT 1 FROM quiz_questoes q JOIN provas p ON p.id = q.prova_id JOIN rallies r ON r.id = p.rally_id WHERE q.id = OLD.questao_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_quiz_respostas_insert BEFORE INSERT ON quiz_respostas
WHEN (EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id WHERE t.id = NEW.tribo_id AND r.legado = 1) OR EXISTS (SELECT 1 FROM provas p JOIN rallies r ON r.id = p.rally_id WHERE p.id = NEW.prova_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_quiz_respostas_update BEFORE UPDATE ON quiz_respostas
WHEN (EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id WHERE t.id = OLD.tribo_id AND r.legado = 1) OR EXISTS (SELECT 1 FROM provas p JOIN rallies r ON r.id = p.rally_id WHERE p.id = OLD.prova_id AND r.legado = 1)) OR (EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id WHERE t.id = NEW.tribo_id AND r.legado = 1) OR EXISTS (SELECT 1 FROM provas p JOIN rallies r ON r.id = p.rally_id WHERE p.id = NEW.prova_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_quiz_respostas_delete BEFORE DELETE ON quiz_respostas
WHEN (EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id WHERE t.id = OLD.tribo_id AND r.legado = 1) OR EXISTS (SELECT 1 FROM provas p JOIN rallies r ON r.id = p.rally_id WHERE p.id = OLD.prova_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_historico_pontuacoes_insert BEFORE INSERT ON historico_pontuacoes
WHEN (EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id WHERE t.id = NEW.tribo_id AND r.legado = 1) OR EXISTS (SELECT 1 FROM pontuacoes p JOIN rallies r ON r.id = p.rally_id WHERE p.id = NEW.pontuacao_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_historico_pontuacoes_update BEFORE UPDATE ON historico_pontuacoes
WHEN (EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id WHERE t.id = OLD.tribo_id AND r.legado = 1) OR EXISTS (SELECT 1 FROM pontuacoes p JOIN rallies r ON r.id = p.rally_id WHERE p.id = OLD.pontuacao_id AND r.legado = 1)) OR (EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id WHERE t.id = NEW.tribo_id AND r.legado = 1) OR EXISTS (SELECT 1 FROM pontuacoes p JOIN rallies r ON r.id = p.rally_id WHERE p.id = NEW.pontuacao_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;
CREATE TRIGGER legado_historico_pontuacoes_delete BEFORE DELETE ON historico_pontuacoes
WHEN (EXISTS (SELECT 1 FROM tribos t JOIN rallies r ON r.id = t.rally_id WHERE t.id = OLD.tribo_id AND r.legado = 1) OR EXISTS (SELECT 1 FROM pontuacoes p JOIN rallies r ON r.id = p.rally_id WHERE p.id = OLD.pontuacao_id AND r.legado = 1))
BEGIN SELECT RAISE(ABORT, 'Dados de Rally legado sao somente consulta'); END;

CREATE TRIGGER rally_id_fixed BEFORE UPDATE OF id ON rallies
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'A identidade da edicao e preservada'); END;
-- REPLACE must not silently delete and recreate an existing historical row.
CREATE TRIGGER preserve_rallies_insert_id BEFORE INSERT ON rallies
WHEN EXISTS (SELECT 1 FROM rallies WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_tribos_insert_id BEFORE INSERT ON tribos
WHEN EXISTS (SELECT 1 FROM tribos WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_membros_tribo_insert_id BEFORE INSERT ON membros_tribo
WHEN EXISTS (SELECT 1 FROM membros_tribo WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_pontuacoes_insert_id BEFORE INSERT ON pontuacoes
WHEN EXISTS (SELECT 1 FROM pontuacoes WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_missoes_insert_id BEFORE INSERT ON missoes
WHEN EXISTS (SELECT 1 FROM missoes WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_provas_insert_id BEFORE INSERT ON provas
WHEN EXISTS (SELECT 1 FROM provas WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_dinamicas_insert_id BEFORE INSERT ON dinamicas
WHEN EXISTS (SELECT 1 FROM dinamicas WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_categorias_pontos_insert_id BEFORE INSERT ON categorias_pontos
WHEN EXISTS (SELECT 1 FROM categorias_pontos WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_quiz_questoes_insert_id BEFORE INSERT ON quiz_questoes
WHEN EXISTS (SELECT 1 FROM quiz_questoes WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_quiz_alternativas_insert_id BEFORE INSERT ON quiz_alternativas
WHEN EXISTS (SELECT 1 FROM quiz_alternativas WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_quiz_respostas_insert_id BEFORE INSERT ON quiz_respostas
WHEN EXISTS (SELECT 1 FROM quiz_respostas WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_historico_pontuacoes_insert_id BEFORE INSERT ON historico_pontuacoes
WHEN EXISTS (SELECT 1 FROM historico_pontuacoes WHERE id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'Substituicao de identidade existente nao e permitida'); END;
CREATE TRIGGER preserve_pontuacoes_update_id BEFORE UPDATE OF id ON pontuacoes
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'A identidade do registro e preservada'); END;
CREATE TRIGGER preserve_missoes_update_id BEFORE UPDATE OF id ON missoes
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'A identidade do registro e preservada'); END;
CREATE TRIGGER preserve_provas_update_id BEFORE UPDATE OF id ON provas
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'A identidade do registro e preservada'); END;
CREATE TRIGGER preserve_dinamicas_update_id BEFORE UPDATE OF id ON dinamicas
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'A identidade do registro e preservada'); END;
CREATE TRIGGER preserve_categorias_pontos_update_id BEFORE UPDATE OF id ON categorias_pontos
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'A identidade do registro e preservada'); END;
CREATE TRIGGER preserve_quiz_questoes_update_id BEFORE UPDATE OF id ON quiz_questoes
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'A identidade do registro e preservada'); END;
CREATE TRIGGER preserve_quiz_alternativas_update_id BEFORE UPDATE OF id ON quiz_alternativas
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'A identidade do registro e preservada'); END;
CREATE TRIGGER preserve_quiz_respostas_update_id BEFORE UPDATE OF id ON quiz_respostas
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'A identidade do registro e preservada'); END;
CREATE TRIGGER preserve_historico_pontuacoes_update_id BEFORE UPDATE OF id ON historico_pontuacoes
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'A identidade do registro e preservada'); END;
