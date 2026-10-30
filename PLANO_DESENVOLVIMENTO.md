# Plano de Desenvolvimento - Rally das Tribos

## Status Atual: Fase 1 - Fundação (Em Andamento)

### ✅ Concluído
- [x] Estrutura de diretórios criada
- [x] Arquitetura do sistema documentada (ARQUITETURA.md)
- [x] Modelagem do banco de dados documentada (MODELAGEM_BANCO.md)
- [x] package.json criado
- [x] README.md criado

### ⏳ Em Andamento
- [ ] Setup do backend (Express + SQLite)
- [ ] Setup do frontend básico

---

## Fase 1: Fundação

### 1.1 Setup do Backend
- [ ] Criar `backend/server.js` - Servidor Express
- [ ] Criar `backend/database/init.js` - Inicialização do banco
- [ ] Criar `backend/database/migrations/001_initial_schema.sql`
- [ ] Criar `backend/database/migrations/002_add_indexes.sql`
- [ ] Criar `backend/database/migrations/003_create_views.sql`
- [ ] Criar `backend/database/migrations/004_seed_data.sql`
- [ ] Criar `backend/database/connection.js` - Conexão com SQLite
- [ ] Testar conexão com banco de dados
- [ ] Criar estrutura base de controllers, routes, repositories

### 1.2 Setup do Frontend
- [ ] Criar `frontend/index.html` - Página principal
- [ ] Criar `frontend/css/style.css` - Estilos base
- [ ] Criar `frontend/js/app.js` - JavaScript base
- [ ] Criar estrutura de componentes (header, footer, cards)
- [ ] Implementar responsividade básica
- [ ] Testar comunicação frontend-backend

---

## Fase 2: Core

### 2.1 Sistema de Autenticação
- [ ] Criar `backend/middleware/auth.js` - Middleware de autenticação
- [ ] Criar `backend/controllers/authController.js`
- [ ] Criar `backend/routes/authRoutes.js`
- [ ] Criar `backend/repositories/userRepository.js`
- [ ] Implementar login/logout
- [ ] Implementar controle de sessão
- [ ] Implementar níveis de permissão
- [ ] Criar tela de login no frontend
- [ ] Testar autenticação

### 2.2 Módulo de Rallies
- [ ] Criar `backend/controllers/rallyController.js`
- [ ] Criar `backend/routes/rallyRoutes.js`
- [ ] Criar `backend/repositories/rallyRepository.js`
- [ ] Implementar CRUD de rallies
- [ ] Implementar status (ativo/encerrado)
- [ ] Criar tela de gestão de rallies
- [ ] Criar seletor de rally no frontend
- [ ] Testar criação e gestão de rallies

### 2.3 Módulo de Tribos
- [ ] Criar `backend/controllers/triboController.js`
- [ ] Criar `backend/routes/triboRoutes.js`
- [ ] Criar `backend/repositories/triboRepository.js`
- [ ] Implementar CRUD de tribos
- [ ] Implementar cards das 12 tribos
- [ ] Criar tela de gestão de tribos
- [ ] Implementar visualização de detalhes da tribo
- [ ] Testar gestão de tribos

### 2.4 Módulo de Participantes
- [ ] Criar `backend/controllers/participanteController.js`
- [ ] Criar `backend/routes/participanteRoutes.js`
- [ ] Criar `backend/repositories/participanteRepository.js`
- [ ] Implementar CRUD de participantes
- [ ] Implementar vinculação com tribos
- [ ] Implementar busca de participantes
- [ ] Criar tela de cadastro de participantes
- [ ] Criar tela de listagem de participantes
- [ ] Testar gestão de participantes

---

## Fase 3: Funcionalidades

### 3.1 Módulo de Missões
- [ ] Criar `backend/controllers/missaoController.js`
- [ ] Criar `backend/routes/missaoRoutes.js`
- [ ] Criar `backend/repositories/missaoRepository.js`
- [ ] Implementar CRUD de missões
- [ ] Implementar tipos de pontuação (fixa, quantidade, meta, manual)
- [ ] Implementar status (aberta, encerrada, cancelada)
- [ ] Criar tela de criação de missões
- [ ] Criar tela de listagem de missões
- [ ] Testar gestão de missões

### 3.2 Módulo de Provas
- [ ] Criar `backend/controllers/provaController.js`
- [ ] Criar `backend/routes/provaRoutes.js`
- [ ] Criar `backend/repositories/provaRepository.js`
- [ ] Implementar CRUD de provas
- [ ] Implementar tipos de provas (quiz, verdadeiro_falso, complete_versiculo, etc)
- [ ] Implementar status (rascunho, aberta, encerrada)
- [ ] Criar tela de criação de provas
- [ ] Criar tela de listagem de provas
- [ ] Testar gestão de provas

### 3.3 Módulo de Quizzes
- [ ] Criar `backend/controllers/quizController.js`
- [ ] Criar `backend/routes/quizRoutes.js`
- [ ] Criar `backend/repositories/quizRepository.js`
- [ ] Implementar CRUD de questões
- [ ] Implementar CRUD de alternativas
- [ ] Implementar correção automática
- [ ] Criar criador de quizzes no frontend
- [ ] Criar interface de resposta de quizzes
- [ ] Testar criação e resposta de quizzes

### 3.4 Módulo de Pontuação
- [ ] Criar `backend/controllers/pontuacaoController.js`
- [ ] Criar `backend/routes/pontuacaoRoutes.js`
- [ ] Criar `backend/repositories/pontuacaoRepository.js`
- [ ] Implementar registro de pontuação
- [ ] Implementar tipos de pontuação
- [ ] Implementar cálculo automático
- [ ] Implementar edição manual
- [ ] Implementar histórico de alterações
- [ ] Criar tela de registro de pontuação
- [ ] Criar tela de edição de pontuação
- [ ] Testar sistema de pontuação

---

## Fase 4: Visualização

### 4.1 Ranking
- [ ] Criar `backend/controllers/rankingController.js`
- [ ] Criar `backend/routes/rankingRoutes.js`
- [ ] Implementar cálculo de ranking em tempo real
- [ ] Implementar views do banco de dados
- [ ] Criar tela de ranking
- [ ] Implementar atualização automática
- [ ] Testar ranking

### 4.2 Dashboard
- [ ] Criar `backend/controllers/dashboardController.js`
- [ ] Criar `backend/routes/dashboardRoutes.js`
- [ ] Implementar estatísticas do rally
- [ ] Implementar dados para gráficos
- [ ] Criar tela de dashboard
- [ ] Implementar cards informativos
- [ ] Testar dashboard

### 4.3 Histórico
- [ ] Implementar histórico de pontuação por tribo
- [ ] Implementar histórico por semana
- [ ] Implementar histórico por participante
- [ ] Criar tela de histórico
- [ ] Implementar filtros de data
- [ ] Testar histórico

### 4.4 Gráficos
- [ ] Integrar biblioteca de gráficos (Chart.js ou similar)
- [ ] Implementar gráfico de evolução das tribos
- [ ] Implementar gráfico de pontos por semana
- [ ] Implementar gráfico de pontos por categoria
- [ ] Implementar gráfico de desempenho nas provas
- [ ] Testar gráficos

---

## Fase 5: Refinamento

### 5.1 Responsividade Mobile
- [ ] Revisar todas as telas para mobile
- [ ] Ajustar tamanhos de botões
- [ ] Otimizar layout para telas pequenas
- [ ] Testar em diferentes dispositivos
- [ ] Ajustar touch targets

### 5.2 Permissões e Segurança
- [ ] Implementar verificação de permissões em todas as rotas
- [ ] Impedir edição de pontuação por não-admins
- [ ] Implementar validação de inputs
- [ ] Implementar sanitização de dados
- [ ] Testar segurança

### 5.3 Exportação de Dados
- [ ] Implementar exportação de ranking (CSV/PDF)
- [ ] Implementar exportação de histórico
- [ ] Implementar exportação de resultados
- [ ] Testar exportação

### 5.4 Testes
- [ ] Criar testes unitários para controllers
- [ ] Criar testes unitários para repositories
- [ ] Criar testes de integração para API
- [ ] Criar testes e2e para fluxos principais
- [ ] Documentar cobertura de testes

---

## Fase 6: Deploy

### 6.1 Preparação
- [ ] Revisar código
- [ ] Remover logs de debug
- [ ] Otimizar assets
- [ ] Configurar variáveis de ambiente
- [ ] Documentar processo de deploy

### 6.2 Deploy
- [ ] Escolher plataforma de hosting
- [ ] Configurar ambiente de produção
- [ ] Deploy do backend
- [ ] Deploy do frontend
- [ ] Testar em produção

---

## Prioridade de Desenvolvimento

### Alta Prioridade (Core)
1. Setup do backend
2. Setup do frontend
3. Sistema de autenticação
4. Módulo de rallies
5. Módulo de tribos
6. Módulo de participantes
7. Módulo de pontuação
8. Ranking

### Média Prioridade (Funcionalidades)
1. Módulo de missões
2. Módulo de provas
3. Módulo de quizzes
4. Dashboard
5. Histórico

### Baixa Prioridade (Refinamento)
1. Gráficos
2. Exportação de dados
3. Responsividade avançada
4. Testes automatizados

---

## Notas

- Cada fase deve ser testada completamente antes de avançar
- Documentação deve ser atualizada conforme desenvolvimento
- Código deve seguir os padrões estabelecidos em ARQUITETURA.md
- Priorizar funcionalidades essenciais para o uso no encontro jovem
- Manter foco em usabilidade mobile
