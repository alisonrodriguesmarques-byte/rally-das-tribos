# Rally das Tribos
 
Plataforma para organizar o rally de jovens da igreja: 12 tribos, cabeças, auxiliares e participantes, missões, dinâmicas, provas/quizzes com correção automática, lançamento de pontos com histórico e ranking em tempo real.
 
## Como rodar
 
Requisitos: Node.js 24 LTS.
 
```bash
cd backend
npm ci
# Copie .env.example para .env e preencha ADMIN_PASSWORD e JWT_SECRET.
npm start          # http://localhost:3000
```
 
Na primeira execução, o banco SQLite é criado em `backend/data/rally.sqlite` com as 12 tribos, as categorias e um administrador:
 
- e-mail: `admin@rally.local`
- senha: a que você definiu em `ADMIN_PASSWORD` no arquivo local `backend/.env`
 
## Configuração (variáveis de ambiente)
 
| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP |
| `JWT_SECRET` | sem padrão | Obrigatório para iniciar o servidor |
| `DB_CLIENT` | `better-sqlite3` | Use `pg` para PostgreSQL |
| `DB_FILE` | `backend/data/rally.sqlite` | Arquivo do SQLite |
| `DATABASE_URL` | — | Conexão PostgreSQL (quando `DB_CLIENT=pg`) |
| `ADMIN_EMAIL` | `admin@rally.local` | E-mail do administrador inicial |
| `ADMIN_PASSWORD` | sem padrão | Senha com pelo menos 8 caracteres, obrigatória na criação do administrador |
 
## Testes
 
```bash
cd backend
npm test
```
 
## Estrutura
 
```
backend/
  src/
    config/        configuração
    database/      conexão Knex, migrations e seeds
    repositories/  acesso ao banco
    services/      regras de negócio (pontuação, ranking, correção…)
    controllers/   entrada/saída HTTP
    routes/        rotas da API (/api/…)
    middlewares/   autenticação, permissões e erros
  tests/
frontend/public/   site (HTML, CSS e JavaScript sem framework)
```

## Recuperação desta versão

Código extraído do histórico fornecido pelo usuário, com reaplicação das correções finais do Devin. Os arquivos originais de arquitetura e SQL estão em `docs/`; o banco em uso segue as migrations de `backend/src/database/migrations/`, que refletem a implementação posterior à proposta.

O arquivo `recovery-manifest.json` identifica a linha do histórico de onde cada arquivo foi extraído. As versões exatas das dependências antigas não estavam no histórico; as versões resolvidas nesta recuperação estão fixadas em `backend/package-lock.json`. Para reinstalar, use `npm ci` dentro de `backend/`.

### Demonstração

O script `scripts/demo.py` recria os dados fictícios: 12 tribos, 16 jovens cadastrados (8 participantes e 8 líderes/auxiliares), um rally, pontuações por quatro semanas, uma missão, uma dinâmica e dois quizzes. O banco de execução não é versionado no Git.

- Administrador: `admin@rally.local`, com a senha definida localmente.
- Cabeça de Rúben: `ana@rally.local`, com a senha informada ao executar o script de demonstração.

Os dados usam as datas do histórico de 2026. Contadores e gráficos dependentes da data atual podem diferir das capturas antigas.

Para recriar a demonstração em um banco novo, inicie o servidor com `cd backend && npm start`. Em outro terminal, na raiz do repositório, execute `python3 scripts/demo.py` (Python 3, sem bibliotecas extras). O script pede a senha do administrador e uma senha para o cabeça, sem exibi-las no terminal. Também aceita `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `DEMO_PASSWORD` por variáveis de ambiente. Ele usa `http://localhost:3000`; defina `RALLY_URL` para outra porta. Ele não duplica o rally se já existir.

### Validação

Os sete testes originais passaram em Node 24. A verificação automatizada em Chromium percorreu 20 rotas administrativas e seis da área do cabeça em viewport de celular, verificou ausência de erros e transbordamento horizontal, bloqueio de lançamento de pontos para o cabeça e envio de prova com exibição imediata do resultado. Também foram verificados lançamento de pontos e correção manual pela interface.

A recuperação foi testada com SQLite. A migração para PostgreSQL e a publicação em hospedagem não foram realizadas.

### Correções preservando o visual

- Caminho dos arquivos do frontend e distribuição local do Chart.js.
- Substituição de handlers duplicados nas telas que se redesenham.
- Atualização da tela após finalizar uma tentativa sem mudar o endereço.
- Ícones de navegação e pódio em SVG, sem depender de fontes de emojis.
- Encerramento da conexão ao final dos testes e exigência de Node 24.

### Configuração local de acesso

As senhas e o segredo de sessão não têm valores fixos no código. Copie `backend/.env.example` para `backend/.env` e preencha os valores antes de iniciar. O arquivo `.env` é ignorado pelo Git. Para gerar um segredo de sessão, use localmente `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

Para publicação no GitHub, as credenciais fixas de demonstração foram substituídas por configuração local. Os testes adicionais verificam que o servidor rejeita a ausência de `JWT_SECRET` e que a primeira execução exige `ADMIN_PASSWORD`. Total: nove testes passando.
