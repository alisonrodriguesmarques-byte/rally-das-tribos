-- Migration 002: Criação dos índices
-- Rally das Tribos - Índices para performance

-- Índices da tabela rallies
CREATE INDEX IF NOT EXISTS idx_rallies_status ON rallies(status);
CREATE INDEX IF NOT EXISTS idx_rallies_datas ON rallies(data_inicio, data_fim);

-- Índices da tabela usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios(tipo_usuario);

-- Índices da tabela tribos
CREATE INDEX IF NOT EXISTS idx_tribos_rally ON tribos(rally_id);
CREATE INDEX IF NOT EXISTS idx_tribos_nome ON tribos(nome);

-- Índices da tabela participantes
CREATE INDEX IF NOT EXISTS idx_participantes_usuario ON participantes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_participantes_nome ON participantes(nome_completo);

-- Índices da tabela membros_tribo
CREATE INDEX IF NOT EXISTS idx_membros_tribo ON membros_tribo(tribo_id);
CREATE INDEX IF NOT EXISTS idx_membros_participante ON membros_tribo(participante_id);
CREATE INDEX IF NOT EXISTS idx_membros_papel ON membros_tribo(papel);

-- Índices da tabela missoes
CREATE INDEX IF NOT EXISTS idx_missoes_rally ON missoes(rally_id);
CREATE INDEX IF NOT EXISTS idx_missoes_status ON missoes(status);
CREATE INDEX IF NOT EXISTS idx_missoes_datas ON missoes(data_inicio, data_limite);

-- Índices da tabela categorias_pontos
CREATE INDEX IF NOT EXISTS idx_categorias_rally ON categorias_pontos(rally_id);

-- Índices da tabela provas
CREATE INDEX IF NOT EXISTS idx_provas_rally ON provas(rally_id);
CREATE INDEX IF NOT EXISTS idx_provas_categoria ON provas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_provas_tipo ON provas(tipo_prova);
CREATE INDEX IF NOT EXISTS idx_provas_status ON provas(status);

-- Índices da tabela quiz_questoes
CREATE INDEX IF NOT EXISTS idx_quiz_questoes_prova ON quiz_questoes(prova_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questoes_ordem ON quiz_questoes(prova_id, ordem);

-- Índices da tabela quiz_alternativas
CREATE INDEX IF NOT EXISTS idx_alternativas_questao ON quiz_alternativas(questao_id);
CREATE INDEX IF NOT EXISTS idx_alternativas_ordem ON quiz_alternativas(questao_id, ordem);

-- Índices da tabela quiz_respostas
CREATE INDEX IF NOT EXISTS idx_respostas_prova ON quiz_respostas(prova_id);
CREATE INDEX IF NOT EXISTS idx_respostas_tribo ON quiz_respostas(tribo_id);
CREATE INDEX IF NOT EXISTS idx_respostas_questao ON quiz_respostas(questao_id);
CREATE INDEX IF NOT EXISTS idx_respostas_participante ON quiz_respostas(participante_id);

-- Índices da tabela dinamicas
CREATE INDEX IF NOT EXISTS idx_dinamicas_rally ON dinamicas(rally_id);
CREATE INDEX IF NOT EXISTS idx_dinamicas_tribo ON dinamicas(tribo_id);
CREATE INDEX IF NOT EXISTS idx_dinamicas_status ON dinamicas(status);
CREATE INDEX IF NOT EXISTS idx_dinamicas_data ON dinamicas(data);

-- Índices da tabela pontuacoes
CREATE INDEX IF NOT EXISTS idx_pontuacoes_rally ON pontuacoes(rally_id);
CREATE INDEX IF NOT EXISTS idx_pontuacoes_tribo ON pontuacoes(tribo_id);
CREATE INDEX IF NOT EXISTS idx_pontuacoes_categoria ON pontuacoes(categoria_id);
CREATE INDEX IF NOT EXISTS idx_pontuacoes_tipo ON pontuacoes(tipo_origem);
CREATE INDEX IF NOT EXISTS idx_pontuacoes_data ON pontuacoes(data_registro);

-- Índices da tabela historico_pontuacoes
CREATE INDEX IF NOT EXISTS idx_historico_pontuacao ON historico_pontuacoes(pontuacao_id);
CREATE INDEX IF NOT EXISTS idx_historico_tribo ON historico_pontuacoes(tribo_id);
CREATE INDEX IF NOT EXISTS idx_historico_data ON historico_pontuacoes(data_alteracao);
