# Rally das Tribos - Modelagem do Banco de Dados

## Visão Geral

O banco de dados será desenvolvido em SQLite3 inicialmente, com estrutura preparada para migração futura para PostgreSQL. O modelo é relacional e normalizado para evitar duplicação de dados.

**Decisões de Design para MVP:**
- **Exclusões**: RESTRICT em vez de CASCADE DELETE para preservar histórico
- **Rallies encerrados**: São arquivados, não excluídos
- **Categorias**: Podem ser globais (rally_id = NULL) ou específicas por rally
- **Provas e Dinâmicas**: Tabelas separadas para evitar complexidade inicial
- **Integridade**: Restrições para garantir dados consistentes

## Diagrama Entidade-Relacionamento (ER)

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   rallies   │         │   tribos    │         │  usuarios   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │                       │                       │
       │       ┌───────────────┴───────────────┐       │
       │       │                               │       │
       │  ┌────▼─────┐                   ┌─────▼─────┐  │
       │  │membros_  │                   │   missões │  │
       │  │  tribo   │                   └─────┬─────┘  │
       │  └────┬─────┘                         │        │
       │       │                                 │        │
       │       │       ┌────────────────────────┘        │
       │       │       │                                 │
       │  ┌────▼─────┐ │                         ┌───────▼──────┐
       │  │  partici-│ │                         │   pontuações  │
       │  │  pantes  │ │                         └───────┬──────┘
       │  └──────────┘ │                                 │
       │                │                         ┌───────▼──────┐
       │                │                         │   histórico_  │
       │                │                         │   pontuações  │
       │                │                         └──────────────┘
       │                │
       │  ┌─────────────▼─────────────┐
       │  │        provas             │
       │  └─────────────┬─────────────┘
       │                │
       │  ┌─────────────▼─────────────┐
       │  │    quiz_questoes          │
       │  └─────────────┬─────────────┘
       │                │
       │  ┌─────────────▼─────────────┐
       │  │   quiz_alternativas       │
       │  └─────────────┬─────────────┘
       │                │
       │  ┌─────────────▼─────────────┐
       │  │    quiz_respostas         │
       │  └───────────────────────────┘
       │
       │  ┌─────────────┐
       │  │  dinamicas  │
       │  └─────────────┘
```

## Tabelas e Estrutura

### 1. rallies
**Descrição**: Competições de 2-3 meses. Cada rally possui seus próprios dados. Rallies encerrados são arquivados para preservar histórico.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| nome | TEXT NOT NULL | Nome do rally (ex: "Rally 2026 — Jovens") |
| descricao | TEXT | Descrição opcional |
| data_inicio | DATE NOT NULL | Data de início da competição |
| data_fim | DATE NOT NULL | Data de encerramento |
| status | TEXT NOT NULL DEFAULT 'ativo' | Status: ativo, encerrado, arquivado, cancelado |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |
| data_atualizacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Última atualização |

**Índices**:
- `idx_rallies_status` (status)
- `idx_rallies_datas` (data_inicio, data_fim)

**Regras de Exclusão**:
- Apenas rallies sem dados dependentes podem ser excluídos
- Rallies com tribos, participantes, missões ou pontuações devem ser arquivados
- Exclusão requer confirmação explícita

---

### 2. usuarios
**Descrição**: Usuários do sistema com diferentes níveis de permissão.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| nome_completo | TEXT NOT NULL | Nome completo do usuário |
| nome_apelido | TEXT | Nome/apelido |
| email | TEXT UNIQUE NOT NULL | Email para login |
| senha_hash | TEXT NOT NULL | Senha criptografada |
| tipo_usuario | TEXT NOT NULL | Tipo: admin, lider, auxiliar, participante |
| foto_url | TEXT | URL da foto (opcional) |
| status | TEXT NOT NULL DEFAULT 'ativo' | Status: ativo, inativo |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |
| data_atualizacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Última atualização |

**Índices**:
- `idx_usuarios_email` (email)
- `idx_usuarios_tipo` (tipo_usuario)

---

### 3. tribos
**Descrição**: As 12 tribos de Israel. Cada tribo existe dentro de um rally.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| rally_id | INTEGER NOT NULL | FK → rallies.id |
| nome | TEXT NOT NULL | Nome da tribo (ex: "Judá") |
| descricao | TEXT | Descrição opcional |
| cor | TEXT | Cor para identificação visual (hex) |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |
| data_atualizacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Última atualização |

**Índices**:
- `idx_tribos_rally` (rally_id)
- `idx_tribos_nome` (nome)

**Relacionamentos**:
- `rally_id` → rallies.id (ON DELETE RESTRICT)

---

### 4. participantes
**Descrição**: Cadastro dos jovens participantes. Pode existir independentemente de usuário (sem login).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| usuario_id | INTEGER UNIQUE | FK → usuarios.id (opcional, se tiver acesso ao sistema) |
| nome_completo | TEXT NOT NULL | Nome completo |
| nome_apelido | TEXT | Nome/apelido |
| foto_url | TEXT | URL da foto (opcional) |
| status | TEXT NOT NULL DEFAULT 'ativo' | Status: ativo, inativo |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |
| data_atualizacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Última atualização |

**Índices**:
- `idx_participantes_usuario` (usuario_id)
- `idx_participantes_nome` (nome_completo)

**Relacionamentos**:
- `usuario_id` → usuarios.id (ON DELETE SET NULL)

---

### 5. membros_tribo
**Descrição**: Relacionamento entre participantes e tribos. Define também quem é líder e auxiliar. O rally é obtido através da tribo.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| tribo_id | INTEGER NOT NULL | FK → tribos.id |
| participante_id | INTEGER NOT NULL | FK → participantes.id |
| papel | TEXT NOT NULL DEFAULT 'participante' | Papel: participante, lider, auxiliar |
| data_entrada | DATE NOT NULL | Data de entrada na tribo |
| data_saida | DATE | Data de saída (se aplicável) |
| ativo | INTEGER DEFAULT 1 | Se está ativo na tribo (0 ou 1) |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |
| data_atualizacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Última atualização |

**Índices**:
- `idx_membros_tribo` (tribo_id)
- `idx_membros_participante` (participante_id)
- `idx_membros_papel` (papel)

**Relacionamentos**:
- `tribo_id` → tribos.id (ON DELETE RESTRICT)
- `participante_id` → participantes.id (ON DELETE RESTRICT)

**Restrições**:
- Cada tribo deve ter exatamente 1 líder e 1 auxiliar
- Um participante só pode estar em uma tribo por rally (validado via trigger ou aplicação)

---

### 6. missoes
**Descrição**: Missões semanais enviadas às tribos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| rally_id | INTEGER NOT NULL | FK → rallies.id |
| titulo | TEXT NOT NULL | Título da missão |
| descricao | TEXT NOT NULL | Descrição detalhada |
| data_inicio | DATE NOT NULL | Data de início |
| data_limite | DATE NOT NULL | Data limite para entrega |
| tipo_missao | TEXT NOT NULL | Tipo: semanal, especial, dinamica |
| tipo_pontuacao | TEXT NOT NULL | Tipo: fixa, quantidade, meta, manual |
| valor_pontuacao | INTEGER NOT NULL | Valor da pontuação |
| pontuacao_variavel | INTEGER DEFAULT 0 | Se a pontuação pode variar (0 ou 1) |
| necessita_aprovacao | INTEGER DEFAULT 0 | Se precisa de aprovação do admin (0 ou 1) |
| observacoes | TEXT | Observações adicionais |
| status | TEXT NOT NULL DEFAULT 'aberta' | Status: aberta, encerrada, cancelada |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |
| data_atualizacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Última atualização |

**Índices**:
- `idx_missoes_rally` (rally_id)
- `idx_missoes_status` (status)
- `idx_missoes_datas` (data_inicio, data_limite)

**Relacionamentos**:
- `rally_id` → rallies.id (ON DELETE RESTRICT)

---

### 7. categorias_pontos
**Descrição**: Categorias para classificar os tipos de pontos. Podem ser globais (rally_id = NULL) ou específicas por rally.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| rally_id | INTEGER | FK → rallies.id (NULL = categoria global) |
| nome | TEXT NOT NULL | Nome da categoria (ex: "Quiz", "Dinâmica") |
| descricao | TEXT | Descrição opcional |
| cor | TEXT | Cor para identificação visual (hex) |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |

**Índices**:
- `idx_categorias_rally` (rally_id)

**Relacionamentos**:
- `rally_id` → rallies.id (ON DELETE CASCADE - categorias específicas são apagadas com o rally, globais não)

---

### 8. provas
**Descrição**: Diferentes tipos de provas/atividades com questões (quiz, verdadeiro_falso, complete_versiculo, etc).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| rally_id | INTEGER NOT NULL | FK → rallies.id |
| categoria_id | INTEGER | FK → categorias_pontos.id |
| titulo | TEXT NOT NULL | Título da prova |
| descricao | TEXT | Descrição opcional |
| tipo_prova | TEXT NOT NULL | Tipo: quiz, verdadeiro_falso, complete_versiculo, aberta, associacao, ordem |
| data | DATE NOT NULL | Data da prova |
| tempo_limite_minutos | INTEGER | Tempo limite em minutos |
| tentativas_maximas | INTEGER | Número máximo de tentativas |
| pontuacao_maxima | INTEGER NOT NULL | Pontuação máxima possível |
| correcao_automatica | INTEGER DEFAULT 1 | Se tem correção automática (0 ou 1) |
| observacoes | TEXT | Observações |
| status | TEXT NOT NULL DEFAULT 'rascunho' | Status: rascunho, aberta, encerrada |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |
| data_atualizacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Última atualização |

**Índices**:
- `idx_provas_rally` (rally_id)
- `idx_provas_categoria` (categoria_id)
- `idx_provas_tipo` (tipo_prova)
- `idx_provas_status` (status)

**Relacionamentos**:
- `rally_id` → rallies.id (ON DELETE RESTRICT)
- `categoria_id` → categorias_pontos.id (ON DELETE SET NULL)

---

### 9. quiz_questoes
**Descrição**: Questões de quizzes e provas de múltipla escolha.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| prova_id | INTEGER NOT NULL | FK → provas.id |
| ordem | INTEGER NOT NULL | Ordem da questão |
| pergunta | TEXT NOT NULL | Texto da pergunta |
| imagem_url | TEXT | URL da imagem (opcional) |
| video_url | TEXT | URL do vídeo (opcional) |
| valor_questao | INTEGER NOT NULL | Valor da questão em pontos |
| resposta_correta | TEXT NOT NULL | Resposta correta |
| variacoes_aceitas | TEXT | Variações aceitas (JSON array) |
| observacoes | TEXT | Observações |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |

**Índices**:
- `idx_quiz_questoes_prova` (prova_id)
- `idx_quiz_questoes_ordem` (prova_id, ordem)

**Relacionamentos**:
- `prova_id` → provas.id (ON DELETE CASCADE)

---

### 10. quiz_alternativas
**Descrição**: Alternativas para questões de múltipla escolha.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| questao_id | INTEGER NOT NULL | FK → quiz_questoes.id |
| ordem | INTEGER NOT NULL | Ordem da alternativa |
| texto | TEXT NOT NULL | Texto da alternativa |
| correta | INTEGER DEFAULT 0 | Se é a alternativa correta (0 ou 1) |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |

**Índices**:
- `idx_alternativas_questao` (questao_id)
- `idx_alternativas_ordem` (questao_id, ordem)

**Relacionamentos**:
- `questao_id` → quiz_questoes.id (ON DELETE CASCADE)

---

### 11. quiz_respostas
**Descrição**: Respostas dos participantes às questões.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| prova_id | INTEGER NOT NULL | FK → provas.id |
| tribo_id | INTEGER NOT NULL | FK → tribos.id |
| questao_id | INTEGER NOT NULL | FK → quiz_questoes.id |
| participante_id | INTEGER | FK → participantes.id (quem respondeu) |
| resposta | TEXT NOT NULL | Resposta dada |
| alternativa_id | INTEGER | FK → quiz_alternativas.id (se aplicável) |
| correta | INTEGER | Se a resposta está correta (0 ou 1) |
| pontos_obtidos | INTEGER DEFAULT 0 | Pontos obtidos |
| tempo_gasto_segundos | INTEGER | Tempo gasto em segundos |
| data_resposta | DATETIME DEFAULT CURRENT_TIMESTAMP | Data/hora da resposta |

**Índices**:
- `idx_respostas_prova` (prova_id)
- `idx_respostas_tribo` (tribo_id)
- `idx_respostas_questao` (questao_id)
- `idx_respostas_participante` (participante_id)

**Relacionamentos**:
- `prova_id` → provas.id (ON DELETE CASCADE)
- `tribo_id` → tribos.id (ON DELETE RESTRICT)
- `questao_id` → quiz_questoes.id (ON DELETE CASCADE)
- `participante_id` → participantes.id (ON DELETE SET NULL)
- `alternativa_id` → quiz_alternativas.id (ON DELETE SET NULL)

---

### 12. dinamicas
**Descrição**: Dinâmicas presenciais realizadas pelas tribos. Tabela separada para evitar complexidade inicial.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| rally_id | INTEGER NOT NULL | FK → rallies.id |
| tribo_id | INTEGER NOT NULL | FK → tribos.id |
| categoria_id | INTEGER | FK → categorias_pontos.id |
| titulo | TEXT NOT NULL | Título da dinâmica |
| descricao | TEXT | Descrição detalhada |
| tema | TEXT | Tema da dinâmica |
| data | DATE NOT NULL | Data da dinâmica |
| responsavel_id | INTEGER | FK → participantes.id (responsável) |
| pontuacao | INTEGER NOT NULL | Pontuação atribuída |
| evidencia_url | TEXT | URL de evidência (foto/vídeo) |
| observacao_admin | TEXT | Observação do administrador |
| status | TEXT NOT NULL DEFAULT 'pendente' | Status: pendente, enviada, aprovada, realizada, nao_realizada |
| data_criacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |
| data_atualizacao | DATETIME DEFAULT CURRENT_TIMESTAMP | Última atualização |

**Índices**:
- `idx_dinamicas_rally` (rally_id)
- `idx_dinamicas_tribo` (tribo_id)
- `idx_dinamicas_status` (status)
- `idx_dinamicas_data` (data)

**Relacionamentos**:
- `rally_id` → rallies.id (ON DELETE RESTRICT)
- `tribo_id` → tribos.id (ON DELETE RESTRICT)
- `categoria_id` → categorias_pontos.id (ON DELETE SET NULL)
- `responsavel_id` → participantes.id (ON DELETE SET NULL)

---

### 13. pontuacoes
**Descrição**: Registro de pontuações para as tribos. Pode ter origem em missões, provas ou dinâmicas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| rally_id | INTEGER NOT NULL | FK → rallies.id |
| tribo_id | INTEGER NOT NULL | FK → tribos.id |
| categoria_id | INTEGER | FK → categorias_pontos.id |
| prova_id | INTEGER | FK → provas.id (se for prova) |
| missao_id | INTEGER | FK → missoes.id (se for missão) |
| dinamica_id | INTEGER | FK → dinamicas.id (se for dinâmica) |
| tipo_origem | TEXT NOT NULL | Tipo: missao, prova, quiz, dinamica, manual |
| descricao | TEXT NOT NULL | Descrição da pontuação |
| pontos | INTEGER NOT NULL | Quantidade de pontos (positivo ou negativo) |
| tipo_pontuacao | TEXT NOT NULL | Tipo: fixa, quantidade, meta, manual |
| quantidade | INTEGER | Quantidade (se aplicável, ex: 4 convidados) |
| criado_por | INTEGER NOT NULL | FK → usuarios.id (quem registrou) |
| aprovado_por | INTEGER | FK → usuarios.id (quem aprovou, se necessário) |
| data_registro | DATETIME DEFAULT CURRENT_TIMESTAMP | Data/hora do registro |
| data_aprovacao | DATETIME | Data/hora da aprovação |
| observacoes | TEXT | Observações |

**Índices**:
- `idx_pontuacoes_rally` (rally_id)
- `idx_pontuacoes_tribo` (tribo_id)
- `idx_pontuacoes_categoria` (categoria_id)
- `idx_pontuacoes_tipo` (tipo_origem)
- `idx_pontuacoes_data` (data_registro)

**Relacionamentos**:
- `rally_id` → rallies.id (ON DELETE RESTRICT)
- `tribo_id` → tribos.id (ON DELETE RESTRICT)
- `categoria_id` → categorias_pontos.id (ON DELETE SET NULL)
- `prova_id` → provas.id (ON DELETE SET NULL)
- `missao_id` → missoes.id (ON DELETE SET NULL)
- `dinamica_id` → dinamicas.id (ON DELETE SET NULL)
- `criado_por` → usuarios.id (ON DELETE SET NULL)
- `aprovado_por` → usuarios.id (ON DELETE SET NULL)

**Restrições**:
- Apenas um dos campos (prova_id, missao_id, dinamica_id) deve ser preenchido por registro
- Validado via CHECK constraint ou aplicação

---

### 14. historico_pontuacoes
**Descrição**: Histórico de alterações de pontuação (auditoria).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Identificador único |
| pontuacao_id | INTEGER NOT NULL | FK → pontuacoes.id |
| tribo_id | INTEGER NOT NULL | FK → tribos.id |
| pontos_anterior | INTEGER | Pontuação anterior (se edição) |
| pontos_novo | INTEGER NOT NULL | Nova pontuação |
| tipo_alteracao | TEXT NOT NULL | Tipo: criacao, edicao, exclusao |
| motivo | TEXT | Motivo da alteração |
| alterado_por | INTEGER NOT NULL | FK → usuarios.id (quem alterou) |
| data_alteracao | DATETIME DEFAULT CURRENT_TIMESTAMP | Data/hora da alteração |

**Índices**:
- `idx_historico_pontuacao` (pontuacao_id)
- `idx_historico_tribo` (tribo_id)
- `idx_historico_data` (data_alteracao)

**Relacionamentos**:
- `pontuacao_id` → pontuacoes.id (ON DELETE CASCADE)
- `tribo_id` → tribos.id (ON DELETE RESTRICT)
- `alterado_por` → usuarios.id (ON DELETE SET NULL)

---

## Relacionamentos Principais

### 1. Rally → Tribos
- Um rally tem 12 tribos
- Uma tribo pertence a um rally
- ON DELETE RESTRICT (não pode apagar rally com tribos)

### 2. Rally → Participantes
- Um rally tem múltiplos participantes
- Um participante pode participar de múltiplos rallies (através de membros_tribo)

### 3. Tribo → Membros
- Uma tribo tem múltiplos membros
- Um membro pertence a uma tribo (por rally)
- Cada tribo tem 1 líder e 1 auxiliar
- rally_id obtido via tribo

### 4. Tribo → Pontuações
- Uma tribo tem múltiplas pontuações
- Uma pontuação pertence a uma tribo

### 5. Rally → Missões
- Um rally tem múltiplas missões
- Uma missão pertence a um rally
- ON DELETE RESTRICT

### 6. Rally → Provas
- Um rally tem múltiplas provas
- Uma prova pertence a um rally
- ON DELETE RESTRICT

### 7. Rally → Dinâmicas
- Um rally tem múltiplas dinâmicas
- Uma dinâmica pertence a um rally
- ON DELETE RESTRICT

### 8. Prova → Questões
- Uma prova tem múltiplas questões
- Uma questão pertence a uma prova
- ON DELETE CASCADE (apagar prova apaga questões)

### 9. Questão → Alternativas
- Uma questão tem múltiplas alternativas
- Uma alternativa pertence a uma questão
- ON DELETE CASCADE

### 10. Prova → Respostas
- Uma prova tem múltiplas respostas
- Uma resposta pertence a uma prova e a uma tribo
- ON DELETE CASCADE

### 11. Pontuação → Histórico
- Uma pontuação tem múltiplos registros de histórico
- Um registro de histórico pertence a uma pontuação
- ON DELETE CASCADE

### 12. Categorias → Rally
- Categorias podem ser globais (rally_id = NULL) ou específicas
- Categorias específicas são apagadas com o rally (CASCADE)
- Categorias globais são preservadas

---

## Regras de Negócio

### 1. Tribos
- Cada rally deve ter exatamente 12 tribos
- Cada tribo deve ter exatamente 1 líder e 1 auxiliar
- Um participante só pode estar em uma tribo por rally (validado via trigger ou aplicação)

### 2. Pontuação
- Pontuações nunca são excluídas, apenas editadas
- Toda alteração de pontuação gera um registro no histórico
- Pontuações podem ser positivas ou negativas
- Apenas uma origem (prova_id, missao_id, dinamica_id) por registro

### 3. Provas
- Provas podem ter correção automática ou manual
- Respostas automáticas são corrigidas imediatamente
- Respostas manuais ficam pendentes de aprovação

### 4. Rallies
- Dados de rallies encerrados nunca são excluídos (são arquivados)
- Apenas um rally pode estar ativo por vez (regra de negócio)
- Exclusão apenas se não houver dados dependentes

### 5. Permissões
- Apenas administradores podem editar pontuações
- Líderes podem visualizar dados de sua tribo
- Participantes podem visualizar e responder provas

### 6. Categorias
- Categorias globais (rally_id = NULL) disponíveis em todos os rallies
- Admin pode criar categorias específicas por rally
- Categorias específicas são apagadas com o rally

---

## Views Úteis

### 1. v_ranking_atual
View que calcula o ranking atual das tribos para um rally.

```sql
CREATE VIEW v_ranking_atual AS
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
```

### 2. v_pontuacoes_por_categoria
View que soma pontuações por categoria para cada tribo.

```sql
CREATE VIEW v_pontuacoes_por_categoria AS
SELECT
    t.id as tribo_id,
    t.nome as tribo_nome,
    cp.nome as categoria_nome,
    COALESCE(SUM(p.pontos), 0) as pontuacao_total
FROM tribos t
LEFT JOIN pontuacoes p ON t.id = p.tribo_id
LEFT JOIN categorias_pontos cp ON p.categoria_id = cp.id
GROUP BY t.id, t.nome, cp.nome;
```

### 3. v_historico_semanal
View que mostra a evolução das pontuações por semana.

```sql
CREATE VIEW v_historico_semanal AS
SELECT
    t.id as tribo_id,
    t.nome as tribo_nome,
    strftime('%Y-%W', p.data_registro) as semana,
    COALESCE(SUM(p.pontos), 0) as pontuacao_semana
FROM tribos t
LEFT JOIN pontuacoes p ON t.id = p.tribo_id
GROUP BY t.id, t.nome, strftime('%Y-%W', p.data_registro)
ORDER BY semana DESC, pontuacao_semana DESC;
```

### 4. v_membros_por_tribo
View que mostra os membros de cada tribo com seus papéis.

```sql
CREATE VIEW v_membros_por_tribo AS
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
```

---

## Migrations

O sistema utilizará um sistema de migrations para controle de versão do schema:

1. `001_initial_schema.sql` - Criação inicial das tabelas
2. `002_add_indexes.sql` - Criação dos índices
3. `003_create_views.sql` - Criação das views
4. `004_seed_data.sql` - Dados iniciais (categorias globais, etc)
5. `005_add_triggers.sql` - Triggers para validações

Cada migration será armazenada em `backend/database/migrations/`.

---

## Triggers para Integridade

### 1. Check para garantir uma origem por pontuação
```sql
CREATE TRIGGER check_pontuacao_origem
BEFORE INSERT ON pontuacoes
WHEN (prova_id IS NOT NULL AND missao_id IS NOT NULL) OR
      (prova_id IS NOT NULL AND dinamica_id IS NOT NULL) OR
      (missao_id IS NOT NULL AND dinamica_id IS NOT NULL)
BEGIN
    SELECT RAISE(ABORT, 'Apenas uma origem (prova_id, missao_id ou dinamica_id) deve ser informada');
END;
```

### 2. Check para garantir um participante por tribo por rally
```sql
CREATE TRIGGER check_participante_unico_tribo
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
```

---

## Preparação para PostgreSQL

### Diferenças a considerar:
1. **AUTOINCREMENT** → **SERIAL** ou **IDENTITY**
2. **INTEGER como BOOLEAN** → **BOOLEAN** (SQLite usa INTEGER 0/1)
3. **DATE/DATETIME** → **TIMESTAMP** ou **DATE**
4. **TEXT** → **VARCHAR** ou **TEXT**
5. **Foreign Keys** → Mantêm iguais
6. **Views** → Sintaxe similar, mas verificar funções específicas
7. **strftime** → **DATE_TRUNC** ou funções similares
8. **RAISE(ABORT, ...)** → **RAISE EXCEPTION**

### Abstração:
Criar uma classe `DatabaseAdapter` que abstrai as diferenças entre SQLite e PostgreSQL, permitindo migração transparente.

---

## Versão do SQLite

As window functions (`ROW_NUMBER() OVER`) são suportadas a partir do SQLite 3.25.0 (lançado em 2018). A maioria das instalações modernas já está acima desta versão.

Para verificar a versão:
```bash
sqlite3 --version
```

Se a versão for inferior a 3.25.0, as views devem ser reescritas sem window functions, usando subqueries ou cálculos na aplicação.
