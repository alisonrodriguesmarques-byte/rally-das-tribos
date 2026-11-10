-- Rally das Tribos — esquema inicial (SQLite, compatível com migração para PostgreSQL)
-- Convenções: ids INTEGER autoincrement, datas em ISO-8601 (TEXT), booleanos 0/1,
-- nada é apagado fisicamente em rallies encerrados (status / cancelamento lógico).

PRAGMA foreign_keys = ON;

-- =========================================================
-- 1. PESSOAS E ACESSO
-- =========================================================

-- Toda pessoa conhecida (jovem, líder, auxiliar). Existe uma vez só, entre rallies.
CREATE TABLE pessoas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_completo TEXT    NOT NULL,
  apelido       TEXT,
  foto_url      TEXT,
  telefone      TEXT,
  ativo         INTEGER NOT NULL DEFAULT 1,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pessoas_nome ON pessoas(nome_completo);

-- Conta de login. Papel global: admin ou membro. Cabeça/auxiliar/participante
-- são derivados do vínculo da pessoa no rally (rally_tribos / membros_tribo).
CREATE TABLE usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pessoa_id     INTEGER UNIQUE REFERENCES pessoas(id),
  email         TEXT    NOT NULL UNIQUE,
  senha_hash    TEXT    NOT NULL,
  papel         TEXT    NOT NULL DEFAULT 'membro' CHECK (papel IN ('admin','membro')),
  ativo         INTEGER NOT NULL DEFAULT 1,
  ultimo_login  TEXT,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================
-- 2. RALLY E TRIBOS
-- =========================================================

CREATE TABLE rallies (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nome         TEXT NOT NULL,                       -- "Rally 2026 — Jovens"
  data_inicio  TEXT NOT NULL,
  data_fim     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'planejado'
               CHECK (status IN ('planejado','ativo','encerrado')),
  criado_por   INTEGER REFERENCES usuarios(id),
  criado_em    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (data_fim >= data_inicio)
);

-- Catálogo fixo das 12 tribos (seed). Não muda entre rallies.
CREATE TABLE tribos (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome   TEXT NOT NULL UNIQUE,                     -- Rúben, Simeão, ... Benjamim
  slug   TEXT NOT NULL UNIQUE,
  cor    TEXT,
  ordem  INTEGER NOT NULL
);

-- A tribo dentro de um rally específico: aqui ficam cabeça e auxiliar daquele rally.
CREATE TABLE rally_tribos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  rally_id            INTEGER NOT NULL REFERENCES rallies(id),
  tribo_id            INTEGER NOT NULL REFERENCES tribos(id),
  cabeca_pessoa_id    INTEGER REFERENCES pessoas(id),
  auxiliar_pessoa_id  INTEGER REFERENCES pessoas(id),
  UNIQUE (rally_id, tribo_id)
);

-- Participante inscrito em uma tribo de um rally. Transferência = fecha a linha
-- (saiu_em) e abre outra; o histórico fica preservado.
CREATE TABLE membros_tribo (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  rally_tribo_id  INTEGER NOT NULL REFERENCES rally_tribos(id),
  pessoa_id       INTEGER NOT NULL REFERENCES pessoas(id),
  entrou_em       TEXT    NOT NULL DEFAULT (datetime('now')),
  saiu_em         TEXT,
  motivo_saida    TEXT,                             -- 'transferencia', 'desistencia', ...
  status          TEXT    NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo'))
);
CREATE INDEX idx_membros_tribo_pessoa ON membros_tribo(pessoa_id);
-- Uma pessoa só pode estar ativa em uma tribo por vez (checagem no service, pois
-- envolve o rally_id da rally_tribo; no PostgreSQL vira índice parcial/exclusion).

-- =========================================================
-- 3. CATEGORIAS DE PONTOS
-- =========================================================

CREATE TABLE categorias (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome   TEXT NOT NULL UNIQUE,                     -- Quiz, Dinâmica, Evangelização, ...
  cor    TEXT,
  ativa  INTEGER NOT NULL DEFAULT 1
);

-- =========================================================
-- 4. MISSÕES
-- =========================================================

CREATE TABLE missoes (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  rally_id           INTEGER NOT NULL REFERENCES rallies(id),
  categoria_id       INTEGER REFERENCES categorias(id),
  titulo             TEXT    NOT NULL,
  descricao          TEXT,
  observacoes        TEXT,
  data_inicio        TEXT    NOT NULL,
  data_limite        TEXT,
  tipo_pontuacao     TEXT    NOT NULL
                     CHECK (tipo_pontuacao IN ('fixa','quantidade','meta','manual')),
  pontos             INTEGER,                       -- fixa: total; quantidade: por unidade; meta: prêmio
  meta_quantidade    INTEGER,                       -- só para 'meta'
  limite_por_tribo   INTEGER,                       -- ex.: "5 para cada tribo"
  requer_aprovacao   INTEGER NOT NULL DEFAULT 1,
  todas_tribos       INTEGER NOT NULL DEFAULT 1,
  status             TEXT    NOT NULL DEFAULT 'aberta'
                     CHECK (status IN ('aberta','encerrada','cancelada')),
  criado_por         INTEGER REFERENCES usuarios(id),
  criado_em          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_missoes_rally ON missoes(rally_id, data_inicio);

-- Usada apenas quando todas_tribos = 0.
CREATE TABLE missao_tribos (
  missao_id       INTEGER NOT NULL REFERENCES missoes(id),
  rally_tribo_id  INTEGER NOT NULL REFERENCES rally_tribos(id),
  PRIMARY KEY (missao_id, rally_tribo_id)
);

-- Resultado enviado por uma tribo para uma missão. Ao aprovar, gera um lançamento.
CREATE TABLE missao_entregas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  missao_id        INTEGER NOT NULL REFERENCES missoes(id),
  rally_tribo_id   INTEGER NOT NULL REFERENCES rally_tribos(id),
  quantidade       INTEGER,                         -- nº de convidados, almas, provas...
  pontos_manual    INTEGER,                         -- só para tipo 'manual'
  evidencia_url    TEXT,
  observacao       TEXT,
  status           TEXT NOT NULL DEFAULT 'enviada'
                   CHECK (status IN ('enviada','aprovada','rejeitada')),
  enviado_por      INTEGER REFERENCES usuarios(id),
  enviado_em       TEXT NOT NULL DEFAULT (datetime('now')),
  avaliado_por     INTEGER REFERENCES usuarios(id),
  avaliado_em      TEXT,
  lancamento_id    INTEGER REFERENCES lancamentos(id)
);

-- =========================================================
-- 5. DINÂMICAS DO ENCONTRO
-- =========================================================

CREATE TABLE dinamicas (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  rally_id               INTEGER NOT NULL REFERENCES rallies(id),
  rally_tribo_id         INTEGER NOT NULL REFERENCES rally_tribos(id),
  missao_id              INTEGER REFERENCES missoes(id),   -- opcional: dinâmica pedida numa missão
  categoria_id           INTEGER REFERENCES categorias(id),
  titulo                 TEXT NOT NULL,
  tema                   TEXT,
  descricao              TEXT,
  data_encontro          TEXT,
  responsavel_pessoa_id  INTEGER REFERENCES pessoas(id),
  pontos_previstos       INTEGER,
  status                 TEXT NOT NULL DEFAULT 'pendente'
                         CHECK (status IN ('pendente','enviada','aprovada','realizada','nao_realizada')),
  resultado              TEXT,
  evidencia_url          TEXT,
  observacao_admin       TEXT,
  lancamento_id          INTEGER REFERENCES lancamentos(id),
  criado_em              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================================================
-- 6. PROVAS (quiz, V/F, complete o versículo, aberta, associação, ordem)
-- =========================================================

CREATE TABLE provas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  rally_id          INTEGER NOT NULL REFERENCES rallies(id),
  categoria_id      INTEGER REFERENCES categorias(id),
  titulo            TEXT    NOT NULL,
  descricao         TEXT,
  modo              TEXT    NOT NULL DEFAULT 'tribo'
                    CHECK (modo IN ('tribo','individual')),  -- quem responde
  agregacao         TEXT    NOT NULL DEFAULT 'soma'
                    CHECK (agregacao IN ('soma','media','melhor')), -- individual -> tribo
  disponivel_de     TEXT,
  disponivel_ate    TEXT,
  tempo_limite_seg  INTEGER,
  max_tentativas    INTEGER,                         -- NULL = ilimitado
  embaralhar        INTEGER NOT NULL DEFAULT 0,
  todas_tribos      INTEGER NOT NULL DEFAULT 1,
  status            TEXT    NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho','publicada','encerrada','cancelada')),
  criado_por        INTEGER REFERENCES usuarios(id),
  criado_em         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE prova_tribos (
  prova_id        INTEGER NOT NULL REFERENCES provas(id),
  rally_tribo_id  INTEGER NOT NULL REFERENCES rally_tribos(id),
  PRIMARY KEY (prova_id, rally_tribo_id)
);

-- Uma prova pode misturar tipos de questão.
CREATE TABLE questoes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  prova_id            INTEGER NOT NULL REFERENCES provas(id),
  tipo                TEXT    NOT NULL
                      CHECK (tipo IN ('multipla_escolha','verdadeiro_falso','complete',
                                      'aberta','associacao','ordem')),
  enunciado           TEXT    NOT NULL,            -- no 'complete', usa ____ para a lacuna
  referencia_biblica  TEXT,                        -- "João 3:16"
  imagem_url          TEXT,
  video_url           TEXT,
  pontos              INTEGER NOT NULL DEFAULT 100,
  ordem               INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_questoes_prova ON questoes(prova_id, ordem);

-- Itens de uma questão. Mesmo formato serve para vários tipos:
--  multipla_escolha / verdadeiro_falso: texto + correta
--  ordem:      texto + posicao_correta
--  associacao: texto + lado ('A'/'B') + par_chave (itens com a mesma chave formam o par)
CREATE TABLE alternativas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  questao_id       INTEGER NOT NULL REFERENCES questoes(id),
  texto            TEXT    NOT NULL,
  correta          INTEGER NOT NULL DEFAULT 0,
  posicao_correta  INTEGER,
  lado             TEXT CHECK (lado IN ('A','B')),
  par_chave        TEXT,
  ordem            INTEGER NOT NULL DEFAULT 0
);

-- Respostas aceitas para "complete o versículo" (comparadas sem acento/caixa).
CREATE TABLE respostas_aceitas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  questao_id  INTEGER NOT NULL REFERENCES questoes(id),
  texto       TEXT    NOT NULL
);

-- Uma execução de prova por uma tribo (modo 'tribo') ou por um jovem (modo 'individual').
CREATE TABLE tentativas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  prova_id         INTEGER NOT NULL REFERENCES provas(id),
  rally_tribo_id   INTEGER NOT NULL REFERENCES rally_tribos(id),
  pessoa_id        INTEGER REFERENCES pessoas(id),
  numero           INTEGER NOT NULL DEFAULT 1,
  iniciada_em      TEXT    NOT NULL DEFAULT (datetime('now')),
  finalizada_em    TEXT,
  pontos_obtidos   INTEGER,
  status           TEXT    NOT NULL DEFAULT 'em_andamento'
                   CHECK (status IN ('em_andamento','aguardando_correcao','corrigida','anulada'))
);
CREATE INDEX idx_tentativas_prova ON tentativas(prova_id, rally_tribo_id);

CREATE TABLE respostas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tentativa_id     INTEGER NOT NULL REFERENCES tentativas(id),
  questao_id       INTEGER NOT NULL REFERENCES questoes(id),
  alternativa_id   INTEGER REFERENCES alternativas(id),  -- múltipla escolha / V-F
  texto            TEXT,                                -- complete / aberta
  resposta_json    TEXT,                                -- ordem / associação
  correta          INTEGER,                             -- NULL = aguardando correção manual
  pontos_obtidos   INTEGER,
  corrigida_por    INTEGER REFERENCES usuarios(id),     -- NULL = correção automática
  corrigida_em     TEXT,
  UNIQUE (tentativa_id, questao_id)
);

-- Resultado oficial da prova por tribo (agrega tentativas). Gera o lançamento.
CREATE TABLE prova_resultados (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  prova_id         INTEGER NOT NULL REFERENCES provas(id),
  rally_tribo_id   INTEGER NOT NULL REFERENCES rally_tribos(id),
  pontos           INTEGER NOT NULL,
  lancamento_id    INTEGER REFERENCES lancamentos(id),
  calculado_em     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (prova_id, rally_tribo_id)
);

-- =========================================================
-- 7. PONTUAÇÃO (livro-razão) E AUDITORIA
-- =========================================================

-- Fonte única da verdade do ranking. Toda pontuação, de qualquer origem, vira uma linha.
CREATE TABLE lancamentos (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  rally_id             INTEGER NOT NULL REFERENCES rallies(id),
  rally_tribo_id       INTEGER NOT NULL REFERENCES rally_tribos(id),
  categoria_id         INTEGER REFERENCES categorias(id),
  pessoa_id            INTEGER REFERENCES pessoas(id),   -- jovem que gerou o ponto (opcional)
  pontos               INTEGER NOT NULL,                 -- pode ser negativo (penalidade)
  motivo               TEXT    NOT NULL,
  origem_tipo          TEXT    NOT NULL
                       CHECK (origem_tipo IN ('missao','dinamica','prova','manual')),
  origem_id            INTEGER,                          -- id em missao_entregas / dinamicas / prova_resultados
  data_referencia      TEXT    NOT NULL,                 -- dia em que conta (define a semana)
  status               TEXT    NOT NULL DEFAULT 'ativo'
                       CHECK (status IN ('ativo','cancelado')),
  criado_por           INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em            TEXT    NOT NULL DEFAULT (datetime('now')),
  cancelado_por        INTEGER REFERENCES usuarios(id),
  cancelado_em         TEXT,
  motivo_cancelamento  TEXT
);
CREATE INDEX idx_lancamentos_ranking ON lancamentos(rally_id, status, rally_tribo_id);
CREATE INDEX idx_lancamentos_data    ON lancamentos(rally_id, data_referencia);

-- Cada criação/edição/cancelamento de lançamento registra uma linha (nunca é editada).
CREATE TABLE lancamentos_historico (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  lancamento_id      INTEGER NOT NULL REFERENCES lancamentos(id),
  acao               TEXT    NOT NULL CHECK (acao IN ('criacao','edicao','cancelamento','reativacao')),
  pontos_anteriores  INTEGER,
  pontos_novos       INTEGER,
  motivo             TEXT,
  usuario_id         INTEGER NOT NULL REFERENCES usuarios(id),
  em                 TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Auditoria genérica de cadastros (transferências, troca de cabeça, edição de participante...).
CREATE TABLE auditoria (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entidade     TEXT    NOT NULL,           -- 'pessoas', 'rally_tribos', 'membros_tribo', ...
  entidade_id  INTEGER NOT NULL,
  acao         TEXT    NOT NULL,           -- 'criar', 'editar', 'transferir', ...
  antes_json   TEXT,
  depois_json  TEXT,
  usuario_id   INTEGER REFERENCES usuarios(id),
  em           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_auditoria_entidade ON auditoria(entidade, entidade_id);

-- =========================================================
-- 8. PRESENÇA (fase futura — opcional)
-- =========================================================

CREATE TABLE encontros (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  rally_id  INTEGER NOT NULL REFERENCES rallies(id),
  data      TEXT    NOT NULL,
  titulo    TEXT
);

CREATE TABLE presencas (
  encontro_id  INTEGER NOT NULL REFERENCES encontros(id),
  pessoa_id    INTEGER NOT NULL REFERENCES pessoas(id),
  chegou_em    TEXT,
  PRIMARY KEY (encontro_id, pessoa_id)
);

-- =========================================================
-- 9. VIEWS DE RANKING (calculadas, nunca armazenadas)
-- =========================================================

CREATE VIEW vw_ranking AS
SELECT rt.rally_id,
       rt.id                         AS rally_tribo_id,
       t.nome                        AS tribo,
       COALESCE(SUM(l.pontos), 0)    AS pontos
FROM rally_tribos rt
JOIN tribos t ON t.id = rt.tribo_id
LEFT JOIN lancamentos l ON l.rally_tribo_id = rt.id AND l.status = 'ativo'
GROUP BY rt.rally_id, rt.id, t.nome;

-- Pontos por tribo por semana do rally (semana 1 = primeiros 7 dias).
CREATE VIEW vw_pontos_semana AS
SELECT l.rally_id,
       l.rally_tribo_id,
       CAST((julianday(l.data_referencia) - julianday(r.data_inicio)) / 7 AS INTEGER) + 1 AS semana,
       SUM(l.pontos) AS pontos
FROM lancamentos l
JOIN rallies r ON r.id = l.rally_id
WHERE l.status = 'ativo'
GROUP BY l.rally_id, l.rally_tribo_id, semana;

-- =========================================================
-- SEED: 12 tribos e categorias padrão
-- =========================================================

INSERT INTO tribos (nome, slug, ordem) VALUES
 ('Rúben','ruben',1),('Simeão','simeao',2),('Levi','levi',3),('Judá','juda',4),
 ('Dã','da',5),('Naftali','naftali',6),('Gade','gade',7),('Aser','aser',8),
 ('Issacar','issacar',9),('Zebulom','zebulom',10),('José','jose',11),('Benjamim','benjamim',12);

INSERT INTO categorias (nome) VALUES
 ('Quiz'),('Complete o versículo'),('Verdadeiro ou falso'),('Dinâmica'),('Evangelização'),
 ('Presença'),('Convidados'),('Organização'),('Missões especiais'),('Outros');
