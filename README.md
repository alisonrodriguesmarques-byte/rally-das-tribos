# Rally das Tribos

Projeto de sistema web para gerenciamento de competições entre jovens da igreja, focado em rallies, tribos, missões, provas e pontuações. O desenvolvimento está em andamento; o fluxo atual funciona exclusivamente com dados sintéticos em Linux.

## 📋 Visão Geral

O objetivo é substituir o controle manual de competições (rallies) que duram entre 2 e 3 meses. O escopo planejado inclui:
- Cadastro das 12 tribos de Israel
- Gestão de líderes, auxiliares e participantes
- Criação de missões semanais
- Sistema de provas e quizzes com correção automática
- Registro de pontuações (automática e manual)
- Ranking em tempo real
- Histórico completo de pontuações

## 🏗️ Arquitetura

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Design responsivo (mobile-first)
- Comunicação via Fetch API

### Backend
- Node.js + Express
- SQLite3 (preparado para migração para PostgreSQL)
- API REST

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
│   └── server.js        # Ponto de entrada
├── frontend/
│   ├── css/            # Estilos
│   ├── js/             # Scripts
│   └── index.html      # Página principal
├── public/             # Arquivos estáticos
├── ARQUITETURA.md      # Documentação de arquitetura
├── MODELAGEM_BANCO.md  # Modelagem do banco de dados
└── package.json        # Dependências
```

## 🚀 Instalação

### Pré-requisitos
- Node.js 24 (versão validada: 24.19.0)
- npm (geralmente instalado com Node.js)

O fluxo atual usa **somente bancos sintéticos em Linux**. Consulte [Desenvolvimento na nuvem](docs/DESENVOLVIMENTO_NUVEM.md) para proteções, limites e testes. Os bancos originais e de referência não fazem parte deste procedimento.

### Passos

1. Clone o repositório (ou navegue até o diretório):
```bash
cd rally-das-tribos
```

2. Instale as dependências:
```bash
npm ci --no-audit --no-fund
```

3. Crie explicitamente um banco sintético em diretório novo fora do checkout e inicialize o schema:
```bash
export NODE_ENV=development
export RALLY_SYNTHETIC_DIR=/workspace/.rally-synthetic-dev
export RALLY_DEV_DB_PATH="$RALLY_SYNTHETIC_DIR/rally-dev.db"
npm run db:dev:create
npm run init-db
```

Se o banco sintético já existir, configure as mesmas variáveis e pule `db:dev:create`; o comando nunca sobrescreve arquivos. As migrações podem ser verificadas novamente com `init-db`.

Se uma restauração do ambiente mudar o inode do arquivo, use o [procedimento de retomada](docs/DESENVOLVIMENTO_NUVEM.md#retomar-um-banco-após-restauração-do-ambiente): `npm run db:synthetic:restore` verifica a identidade interna em modo somente leitura e recupera o marker, sem recriar o banco.

4. Crie o primeiro administrador pelo [procedimento seguro de inicialização](docs/AUTENTICACAO.md#primeiro-administrador), sem senha padrão. Depois inicie o servidor:
```bash
npm start
```

5. O servidor de desenvolvimento escuta somente em loopback. Para validar automaticamente a persistência e os fluxos existentes:
```
npm test
```

Login, sessões e autorização administrativa estão implementados. Consulte [Autenticação](docs/AUTENTICACAO.md) para aprovação de contas e permissões efetivas. Novos Rallys selecionam duas tribos; edições anteriores preservam suas tribos e resultados para consulta. A escolha fica fixa após iniciar, mas os integrantes podem mudar com histórico na tela de [Equipes](docs/EQUIPES.md). Veja [Rallys e tribos](docs/RALLIES_E_TRIBOS.md). Não use esta versão em produção.

## 📊 Modelagem do Banco de Dados

O sistema utiliza um banco de dados relacional com as seguintes entidades principais:

- **rallies**: Competições de 2-3 meses
- **usuarios**: Usuários do sistema com permissões
- **tribos**: As 12 tribos de Israel
- **participantes**: Cadastro dos jovens
- **membros_tribo**: Relacionamento participantes-tribos
- **missoes**: Missões semanais
- **categorias_pontos**: Categorias de pontuação
- **provas**: Diferentes tipos de provas
- **quiz_questoes**: Questões de quizzes
- **quiz_alternativas**: Alternativas das questões
- **quiz_respostas**: Respostas dos participantes
- **dinamicas**: Dinâmicas presenciais
- **pontuacoes**: Registro de pontuações
- **historico_pontuacoes**: Auditoria de alterações

Para detalhes completos, consulte `MODELAGEM_BANCO.md`.

## 🔐 Permissões

### Administrador
- Acesso completo ao sistema
- Criar/editar rallies, tribos, missões, provas
- Registrar e editar pontuações
- Visualizar tudo

### Cabeça da Tribo
- Visualizar sua tribo
- Ver participantes, missões e resultados
- Ajudar na organização

### Auxiliar
- Visualizar informações da própria tribo
- Auxiliar nas atividades

### Participante
- Realizar provas e quizzes
- Visualizar ranking e missões
- Ver seus resultados

## 📱 Funcionalidades Principais

### 1. Gestão de Rallies
- Criar novos rallies
- Definir período da competição
- Separar dados por rally

### 2. Gestão de Tribos
- Visualizar as 12 tribos em cards
- Gerenciar líderes e auxiliares
- Adicionar/remover participantes
- Transferir participantes entre tribos

### 3. Missões Semanais
- Criar missões com diferentes tipos de pontuação
- Definir datas limite
- Tipos: fixa, por quantidade, meta, manual
- Acompanhamento de entrega

### 4. Sistema de Provas
- Quiz (múltipla escolha)
- Verdadeiro ou Falso
- Complete o Versículo
- Pergunta Aberta
- Associação
- Ordem Correta
- Dinâmicas presenciais

### 5. Pontuação
- Registro automático (quizzes, provas)
- Registro manual (dinâmicas, missões)
- Diferentes tipos de pontuação
- Histórico completo de alterações

### 6. Ranking
- Atualização em tempo real
- Visualização das 12 tribos
- Histórico por semana
- Gráficos de evolução

### 7. Dashboard
- Visão geral administrativa
- Estatísticas do rally
- Gráficos de desempenho

## 🎯 Próximos Passos

O desenvolvimento será feito em etapas:

1. ✅ Estrutura de diretórios
2. ✅ Arquitetura documentada
3. ✅ Modelagem do banco de dados
4. ✅ Base do backend (Express + SQLite sintético em Linux)
5. ✅ Interface Arena Turquesa nas telas implementadas
6. ✅ Login, sessões e autorização administrativa em ambiente sintético
7. ✅ Criação e ciclo de vida de Rallys, com consulta histórica
8. ✅ Seleção de duas tribos oficiais por nova edição
9. ✅ Gestão de pessoas e equipes com histórico
10. ✅ Missões com entrega, aprovação e pontos fixos
11. ✅ Provas objetivas: quiz, verdadeiro/falso e complete o versículo
12. ✅ Pontuação integrada de missões e provas objetivas
13. ✅ Ranking por edição e lançamentos administrativos imediatos
14. ⏳ Dashboard
15. ✅ Responsividade mobile e testes das telas implementadas
16. ⏳ Permissões e segurança

## 📝 Documentação

- [Arquitetura do Sistema](ARQUITETURA.md)
- [Modelagem do Banco de Dados](MODELAGEM_BANCO.md)

## 🤝 Contribuindo

Este é um projeto em desenvolvimento. Sugeridos são bem-vindos!

## 📄 Licença

MIT

A etapa de [pontuação e ranking](docs/PONTUACOES.md) permite lançar e corrigir pontos com histórico preservado, sem aprovação adicional.

Em [Missões e provas](docs/ATIVIDADES.md), o administrador publica atividades para as tribos da edição. Cabeça e auxiliar enviam entregas; a aprovação gera pontos. Cada prova define seus respondentes e corrige as respostas objetivas automaticamente. Para liberar o acesso, associe explicitamente as contas aprovadas às pessoas das equipes pela tela de Missões. Teste de navegador: `npm run test:activities:ui`.

A [preparação para publicação](docs/PUBLICACAO.md) reúne a interface Arena Turquesa, testes completos (`npm run test:release`), [backup/restauração](docs/BACKUP.md) e [HTTPS local](docs/HTTPS.md). O ambiente continua sintético/local; domínio, hospedagem e configuração de produção com dados reais são a próxima definição.
