# Publicar o Rally na Vercel + Supabase

O banco permanece no Supabase. Esta adaptação mantém as telas, login por cookie, permissões, relatórios e dados existentes. A Vercel recebe o frontend estático em `dist` e atende `/api/*` pela função Express `api/index.js`. Não executa `app.listen`, migrações nem seeds a cada requisição. SQLite é recusado nessa entrada.

## 1. Preparar o banco uma vez

Se já executou os SQLs 01 e 02 no Supabase e criou o administrador, não os execute outra vez.

Se o banco estiver vazio, use os SQLs em `docs/sql` ou prepare pelo computador: `npm run setup`, configure `backend/.env` com `DB_CLIENT=pg`, `DATABASE_URL`, `DB_SCHEMA=rally`, `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`, e execute `npm run db:prepare`. Esse comando aplica somente migrações pendentes e seeds idempotentes. Nunca publique esse .env.

Se precisa importar o SQLite, siga primeiro a importação em SUPABASE-RENDER.md, antes de criar usuários no destino vazio. O procedimento de importação também serve para a Vercel.

## 2. Criar o projeto na Vercel

1. Add New → Project → importe o repositório GitHub `alisonrodriguesmarques-byte/rally-das-tribos`.
2. Framework Preset: **Other**. Root Directory: raiz do repositório (não backend ou frontend).
3. Selecione Node.js **24.x**. As regras ficam em `vercel.json`:
   - Install Command: `npm --prefix backend ci --omit=dev`
   - Build Command: `node scripts/build-vercel.cjs`
   - Output Directory: `dist`
   - Não existe Start Command: a Vercel chama a função diretamente.
4. Em Environment Variables, configure para **Production**:

| Nome | Valor |
|---|---|
| NODE_ENV | production |
| DB_CLIENT | pg |
| DATABASE_URL | conexão PostgreSQL **Session pooler, porta 5432**, do Supabase |
| DB_SCHEMA | rally |
| JWT_SECRET | segredo aleatório longo, estável entre deploys |
| DATABASE_CA_CERT | CA oficial em PEM, apenas se exigida pelo provedor |

A senha da DATABASE_URL é a senha do banco; não é anon key nem a senha do administrador do site. Codifique caracteres especiais da senha na URL. TLS é verificado; não configure DB_SSL=false.

Não use DB_FILE, disco persistente ou PORT na Vercel. ADMIN_EMAIL/ADMIN_PASSWORD são necessários para criar o primeiro usuário via preparação local, não são usados para redefinir uma conta existente pela função. Entre com a conta já criada no SQL 02.

Não compartilhe a conexão com o navegador nem coloque prefixos públicos como NEXT_PUBLIC_ nas variáveis. Para Preview, use um banco/schema e segredos separados se quiser testar mudanças sem atingir produção. Não compartilhe credenciais de produção com previews de código não confiável.

5. Clique Deploy. Abra a URL HTTPS da Vercel e confira login, cadastro, ranking de admin e relatório de cabeça/auxiliar.
6. Crie um registro de teste, faça novo deploy e confira que o registro permanece no Supabase.

## Atualizações e migrações

As alterações na branch main acionam os deploys após a integração GitHub estar conectada. Não é preciso reenviar ZIP nem SQL a cada atualização. Alterações futuras nas tabelas devem ter migrações e ser preparadas uma vez, por `npm run db:prepare`, antes de publicar o código que depende delas. O build gera apenas arquivos estáticos; não altera o banco em deploys de produção ou preview.

O Knex usa no máximo uma conexão por instância da função na Vercel. Mais instâncias podem abrir conexões adicionais; por isso o Session pooler é importante e os limites do Supabase precisam ser acompanhados.

## Backups e custos

A rotina criptografada de GitHub Actions permanece igual, sem depender do Render ou Vercel. Configure os secrets conforme SUPABASE-RENDER.md e confirme uma execução de backup bem-sucedida. Os arquivos duram 14 dias no artifact; mantenha cópia privada e chave de recuperação fora do GitHub.

Planos gratuitos têm limites de funções, tempo de execução, uso e banco; não garantem disponibilidade contínua. A configuração da função pede até 30 segundos. O projeto não armazena dados no disco da função. Não encerre o serviço antigo antes de conferir a nova URL e os dados.

## Testes realizados nesta adaptação

Build do frontend e Chart.js, configuração validada pelo schema da Vercel, testes locais e função Express com PostgreSQL (login, sessão, catálogo, 404, pool e inicialização sem migrações/seeds). O deploy na sua conta Vercel ainda exige importar o projeto e informar as variáveis; essa publicação real não é executada apenas por atualizar o GitHub.
