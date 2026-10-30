-- Migration 001: Criação inicial das tabelas
-- Rally das Tribos - Modelagem do Banco de Dados

-- Tabela: rallies
CREATE TABLE IF NOT EXISTS rallies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'encerrado', 'arquivado', 'cancelado')),
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_completo TEXT NOT NULL,
    nome_apelido TEXT,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    tipo_usuario TEXT NOT NULL CHECK(tipo_usuario IN ('admin', 'lider', 'auxiliar', 'participante')),
    foto_url TEXT,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'inativo')),
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: tribos
CREATE TABLE IF NOT EXISTS tribos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rally_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    cor TEXT,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rally_id) REFERENCES rallies(id) ON DELETE RESTRICT
);

-- Tabela: participantes
CREATE TABLE IF NOT EXISTS participantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER UNIQUE,
    nome_completo TEXT NOT NULL,
    nome_apelido TEXT,
    foto_url TEXT,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'inativo')),
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabela: membros_tribo
CREATE TABLE IF NOT EXISTS membros_tribo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tribo_id INTEGER NOT NULL,
    participante_id INTEGER NOT NULL,
    papel TEXT NOT NULL DEFAULT 'participante' CHECK(papel IN ('participante', 'lider', 'auxiliar')),
    data_entrada DATE NOT NULL,
    data_saida DATE,
    ativo INTEGER DEFAULT 1 CHECK(ativo IN (0, 1)),
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tribo_id) REFERENCES tribos(id) ON DELETE RESTRICT,
    FOREIGN KEY (participante_id) REFERENCES participantes(id) ON DELETE RESTRICT
);

-- Tabela: missoes
CREATE TABLE IF NOT EXISTS missoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rally_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    data_inicio DATE NOT NULL,
    data_limite DATE NOT NULL,
    tipo_missao TEXT NOT NULL CHECK(tipo_missao IN ('semanal', 'especial', 'dinamica')),
    tipo_pontuacao TEXT NOT NULL CHECK(tipo_pontuacao IN ('fixa', 'quantidade', 'meta', 'manual')),
    valor_pontuacao INTEGER NOT NULL,
    pontuacao_variavel INTEGER DEFAULT 0 CHECK(pontuacao_variavel IN (0, 1)),
    necessita_aprovacao INTEGER DEFAULT 0 CHECK(necessita_aprovacao IN (0, 1)),
    observacoes TEXT,
    status TEXT NOT NULL DEFAULT 'aberta' CHECK(status IN ('aberta', 'encerrada', 'cancelada')),
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rally_id) REFERENCES rallies(id) ON DELETE RESTRICT
);

-- Tabela: categorias_pontos
CREATE TABLE IF NOT EXISTS categorias_pontos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rally_id INTEGER,
    nome TEXT NOT NULL,
    descricao TEXT,
    cor TEXT,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rally_id) REFERENCES rallies(id) ON DELETE CASCADE
);

-- Tabela: provas
CREATE TABLE IF NOT EXISTS provas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rally_id INTEGER NOT NULL,
    categoria_id INTEGER,
    titulo TEXT NOT NULL,
    descricao TEXT,
    tipo_prova TEXT NOT NULL CHECK(tipo_prova IN ('quiz', 'verdadeiro_falso', 'complete_versiculo', 'aberta', 'associacao', 'ordem')),
    data DATE NOT NULL,
    tempo_limite_minutos INTEGER,
    tentativas_maximas INTEGER,
    pontuacao_maxima INTEGER NOT NULL,
    correcao_automatica INTEGER DEFAULT 1 CHECK(correcao_automatica IN (0, 1)),
    observacoes TEXT,
    status TEXT NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho', 'aberta', 'encerrada')),
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rally_id) REFERENCES rallies(id) ON DELETE RESTRICT,
    FOREIGN KEY (categoria_id) REFERENCES categorias_pontos(id) ON DELETE SET NULL
);

-- Tabela: quiz_questoes
CREATE TABLE IF NOT EXISTS quiz_questoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prova_id INTEGER NOT NULL,
    ordem INTEGER NOT NULL,
    pergunta TEXT NOT NULL,
    imagem_url TEXT,
    video_url TEXT,
    valor_questao INTEGER NOT NULL,
    resposta_correta TEXT NOT NULL,
    variacoes_aceitas TEXT,
    observacoes TEXT,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE
);

-- Tabela: quiz_alternativas
CREATE TABLE IF NOT EXISTS quiz_alternativas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questao_id INTEGER NOT NULL,
    ordem INTEGER NOT NULL,
    texto TEXT NOT NULL,
    correta INTEGER DEFAULT 0 CHECK(correta IN (0, 1)),
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (questao_id) REFERENCES quiz_questoes(id) ON DELETE CASCADE
);

-- Tabela: quiz_respostas
CREATE TABLE IF NOT EXISTS quiz_respostas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prova_id INTEGER NOT NULL,
    tribo_id INTEGER NOT NULL,
    questao_id INTEGER NOT NULL,
    participante_id INTEGER,
    resposta TEXT NOT NULL,
    alternativa_id INTEGER,
    correta INTEGER,
    pontos_obtidos INTEGER DEFAULT 0,
    tempo_gasto_segundos INTEGER,
    data_resposta DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE CASCADE,
    FOREIGN KEY (tribo_id) REFERENCES tribos(id) ON DELETE RESTRICT,
    FOREIGN KEY (questao_id) REFERENCES quiz_questoes(id) ON DELETE CASCADE,
    FOREIGN KEY (participante_id) REFERENCES participantes(id) ON DELETE SET NULL,
    FOREIGN KEY (alternativa_id) REFERENCES quiz_alternativas(id) ON DELETE SET NULL
);

-- Tabela: dinamicas
CREATE TABLE IF NOT EXISTS dinamicas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rally_id INTEGER NOT NULL,
    tribo_id INTEGER NOT NULL,
    categoria_id INTEGER,
    titulo TEXT NOT NULL,
    descricao TEXT,
    tema TEXT,
    data DATE NOT NULL,
    responsavel_id INTEGER,
    pontuacao INTEGER NOT NULL,
    evidencia_url TEXT,
    observacao_admin TEXT,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'enviada', 'aprovada', 'realizada', 'nao_realizada')),
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rally_id) REFERENCES rallies(id) ON DELETE RESTRICT,
    FOREIGN KEY (tribo_id) REFERENCES tribos(id) ON DELETE RESTRICT,
    FOREIGN KEY (categoria_id) REFERENCES categorias_pontos(id) ON DELETE SET NULL,
    FOREIGN KEY (responsavel_id) REFERENCES participantes(id) ON DELETE SET NULL
);

-- Tabela: pontuacoes
CREATE TABLE IF NOT EXISTS pontuacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rally_id INTEGER NOT NULL,
    tribo_id INTEGER NOT NULL,
    categoria_id INTEGER,
    prova_id INTEGER,
    missao_id INTEGER,
    dinamica_id INTEGER,
    tipo_origem TEXT NOT NULL CHECK(tipo_origem IN ('missao', 'prova', 'quiz', 'dinamica', 'manual')),
    descricao TEXT NOT NULL,
    pontos INTEGER NOT NULL,
    tipo_pontuacao TEXT NOT NULL CHECK(tipo_pontuacao IN ('fixa', 'quantidade', 'meta', 'manual')),
    quantidade INTEGER,
    criado_por INTEGER NOT NULL,
    aprovado_por INTEGER,
    data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_aprovacao DATETIME,
    observacoes TEXT,
    FOREIGN KEY (rally_id) REFERENCES rallies(id) ON DELETE RESTRICT,
    FOREIGN KEY (tribo_id) REFERENCES tribos(id) ON DELETE RESTRICT,
    FOREIGN KEY (categoria_id) REFERENCES categorias_pontos(id) ON DELETE SET NULL,
    FOREIGN KEY (prova_id) REFERENCES provas(id) ON DELETE SET NULL,
    FOREIGN KEY (missao_id) REFERENCES missoes(id) ON DELETE SET NULL,
    FOREIGN KEY (dinamica_id) REFERENCES dinamicas(id) ON DELETE SET NULL,
    FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (aprovado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabela: historico_pontuacoes
CREATE TABLE IF NOT EXISTS historico_pontuacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pontuacao_id INTEGER NOT NULL,
    tribo_id INTEGER NOT NULL,
    pontos_anterior INTEGER,
    pontos_novo INTEGER NOT NULL,
    tipo_alteracao TEXT NOT NULL CHECK(tipo_alteracao IN ('criacao', 'edicao', 'exclusao')),
    motivo TEXT,
    alterado_por INTEGER NOT NULL,
    data_alteracao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pontuacao_id) REFERENCES pontuacoes(id) ON DELETE CASCADE,
    FOREIGN KEY (tribo_id) REFERENCES tribos(id) ON DELETE RESTRICT,
    FOREIGN KEY (alterado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);
