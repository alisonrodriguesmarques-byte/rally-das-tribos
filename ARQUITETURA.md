# Rally das Tribos - Arquitetura do Sistema

## Visão Geral

Sistema web completo para gerenciamento de competições entre jovens da igreja, com foco em:
- Gestão de rallies (competições de 2-3 meses)
- Gerenciamento das 12 tribos de Israel
- Sistema de missões semanais
- Sistema de provas e quizzes
- Pontuação automática e manual
- Ranking em tempo real
- Histórico completo de pontuações

## Arquitetura do Sistema

### Frontend
- **HTML5**: Estrutura das páginas
- **CSS3**: Estilização responsiva
- **JavaScript (Vanilla)**: Lógica do frontend
- **Fetch API**: Comunicação com o backend

### Backend
- **Node.js**: Runtime JavaScript
- **Express**: Framework web
- **SQLite3**: Banco de dados (com preparação para migração para PostgreSQL)
- **REST API**: Comunicação frontend-backend

### Estrutura de Diretórios

```
rally-das-tribos/
├── backend/
│   ├── controllers/      # Lógica de negócio
│   ├── routes/          # Rotas da API
│   ├── repositories/    # Acesso ao banco de dados
│   ├── database/        # Scripts de inicialização e migrations
│   ├── middleware/      # Autenticação e validação
│   ├── utils/           # Funções utilitárias compartilhadas
│   └── server.js        # Ponto de entrada do servidor
├── frontend/
│   ├── css/            # Arquivos de estilo
│   ├── js/             # Scripts do frontend
│   └── index.html      # Página principal
├── public/             # Arquivos estáticos (imagens, etc)
└── package.json        # Dependências do projeto
```

## Camadas da Aplicação

### 1. Camada de Apresentação (Frontend)
- Páginas HTML responsivas
- Componentes reutilizáveis
- Formulários de cadastro
- Dashboard visual
- Ranking em tempo real

### 2. Camada de API (Routes)
- Endpoints REST
- Validação de entrada
- Autenticação
- Tratamento de erros

### 3. Camada de Controladores (Controllers)
- Lógica de negócio
- Validação de regras
- Orquestração de operações
- Cálculo de pontuações

### 4. Camada de Repositórios (Repositories)
- Acesso ao banco de dados
- Queries SQL
- Abstração do banco de dados
- Preparação para migração (PostgreSQL)

### 5. Camada de Dados (Database)
- SQLite3
- Relacionamentos entre tabelas
- Integridade referencial
- Histórico de alterações

## Princípios de Design

### Separação de Responsabilidades
- Cada camada tem uma função específica
- Frontend focado em UI/UX
- Backend focado em lógica e dados
- API serve como contrato entre ambos

### Escalabilidade
- Preparado para migração para PostgreSQL
- Arquitetura modular permite adicionar novos módulos
- API REST permite futuramente criar app mobile

### Manutenibilidade
- Código organizado por funcionalidade
- Comentários em português
- Nomes descritivos de variáveis e funções
- Padrões consistentes

### Segurança
- Autenticação de usuários
- Controle de permissões
- Validação de entradas
- Prevenção de SQL injection (parâmetros)

## Fluxo de Dados

```
[Frontend] → [API Routes] → [Controllers] → [Repositories] → [Database]
     ↑                                                ↓
     └───────────────── [JSON Response] ←────────────┘
```

## Tecnologias e Dependências

### Backend (package.json)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2"
  }
}
```

### Frontend
- Sem frameworks (vanilla JS)
- CSS moderno (Flexbox, Grid)
- Responsivo (mobile-first)

## Módulos do Sistema

### 1. Módulo de Autenticação
- Login/Logout
- Controle de sessão
- Níveis de permissão

### 2. Módulo de Rallies
- Criação de rallies
- Gestão de período
- Status (ativo/encerrado)

### 3. Módulo de Tribos
- Cadastro das 12 tribos
- Gestão de líderes e auxiliares
- Vinculação de participantes

### 4. Módulo de Participantes
- Cadastro de jovens
- Associação com tribos
- Histórico de participação

### 5. Módulo de Missões
- Criação de missões semanais
- Tipos de pontuação
- Acompanhamento de entrega

### 6. Módulo de Provas
- Criação de diferentes tipos de provas
- Correção automática
- Correção manual

### 7. Módulo de Quizzes
- Criador de quizzes
- Questões com alternativas
- Correção automática

### 8. Módulo de Pontuação
- Registro de pontos
- Tipos de pontuação
- Cálculo automático
- Edição manual

### 9. Módulo de Ranking
- Cálculo em tempo real
- Histórico por semana
- Gráficos de evolução

### 10. Módulo de Dashboard
- Visão geral administrativa
- Estatísticas
- Gráficos

## Preparação para Migração PostgreSQL

O sistema será desenvolvido com SQLite3 para simplicidade inicial, mas a arquitetura estará preparada para migração:

### Repositório Abstrato
```javascript
// Repository pattern
class BaseRepository {
  constructor(db) {
    this.db = db;
  }
  
  async query(sql, params) {
    // Implementação específica do banco
  }
}
```

### Queries Parametrizadas
- Uso de parâmetros para evitar SQL injection
- Queries compatíveis com ambos os bancos
- Evitar recursos específicos do SQLite

### Migration Scripts
- Scripts separados para criação de tabelas
- Controle de versão do schema
- Facilita migração futura

## Plano de Desenvolvimento

### Fase 1: Fundação
1. ✅ Estrutura de diretórios
2. ✅ Arquitetura documentada
3. ⏳ Modelagem do banco de dados
4. ⏳ Setup do backend (Express + SQLite)
5. ⏳ Setup do frontend básico

### Fase 2: Core
1. ⏳ Sistema de autenticação
2. ⏳ Módulo de rallies
3. ⏳ Módulo de tribos
4. ⏳ Módulo de participantes

### Fase 3: Funcionalidades
1. ⏳ Módulo de missões
2. ⏳ Módulo de provas
3. ⏳ Módulo de quizzes
4. ⏳ Módulo de pontuação

### Fase 4: Visualização
1. ⏳ Ranking
2. ⏳ Dashboard
3. ⏳ Histórico
4. ⏳ Gráficos

### Fase 5: Refinamento
1. ⏳ Responsividade mobile
2. ⏳ Permissões e segurança
3. ⏳ Exportação de dados
4. ⏳ Testes
