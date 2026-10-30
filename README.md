# Rally das Tribos

Sistema web completo para gerenciamento de competições entre jovens da igreja, focado em gerenciar rallies, tribos, missões, provas e pontuações.

## 📋 Visão Geral

O sistema substitui o controle manual de competições (rallies) que duram entre 2 e 3 meses, permitindo:
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
- Node.js (v14 ou superior)
- npm (geralmente instalado com Node.js)

### Passos

1. Clone o repositório (ou navegue até o diretório):
```bash
cd rally-das-tribos
```

2. Instale as dependências:
```bash
npm install
```

3. Inicialize o banco de dados:
```bash
npm run init-db
```

4. Inicie o servidor:
```bash
npm start
```

5. Acesse no navegador:
```
http://localhost:3000
```

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
4. ⏳ Setup do backend (Express + SQLite)
5. ⏳ Setup do frontend básico
6. ⏳ Sistema de autenticação
7. ⏳ Módulo de rallies
8. ⏳ Módulo de tribos
9. ⏳ Módulo de participantes
10. ⏳ Módulo de missões
11. ⏳ Módulo de provas
12. ⏳ Módulo de pontuação
13. ⏳ Ranking
14. ⏳ Dashboard
15. ⏳ Responsividade mobile
16. ⏳ Permissões e segurança

## 📝 Documentação

- [Arquitetura do Sistema](ARQUITETURA.md)
- [Modelagem do Banco de Dados](MODELAGEM_BANCO.md)

## 🤝 Contribuindo

Este é um projeto em desenvolvimento. Sugeridos são bem-vindos!

## 📄 Licença

MIT
