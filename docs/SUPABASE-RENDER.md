# Render + Supabase PostgreSQL

O Express continua no Render; o PostgreSQL fica no Supabase. Não é necessário Persistent Disk no Render. A aplicação mantém seu login e permissões atuais; não usa Supabase Auth nem chave anon no navegador. Planos gratuitos podem ter pausas, limites e mudanças de condições.

## 1. Criar o banco

1. Crie um projeto no Supabase e guarde a senha do banco em um gerenciador de senhas.
2. Em Connect, selecione **Session pooler**, porta **5432**, e copie a conexão PostgreSQL. Use a conexão completa oferecida pelo painel: usuário geralmente `postgres.PROJECT_REF`, host de pooler e banco `postgres`.
3. Substitua a senha na URL. Caracteres especiais devem ser codificados para URL. Não envie essa conexão em mensagens nem a coloque no GitHub.
4. Use Session pooler para aplicação, migrações e pg_dump. Não use Transaction pooler (6543) neste procedimento.

A aplicação cria o schema privado `rally`, tabelas e administrador na inicialização. Não adicione `rally` aos schemas expostos na Data API do Supabase e não conceda acesso a anon/authenticated. O backend acessa o banco pela conexão protegida; o frontend continua chamando apenas `/api`.

## 2. Antes do primeiro deploy: dados existentes

Se já possui cadastros, pontos ou relatórios, **faça backup antes de qualquer reinicialização ou nova publicação**. Dados em `/tmp` do Render podem já ter desaparecido; o código não consegue recuperar dados que foram apagados.

Se quiser começar vazio, vá para a etapa 3. Para importar SQLite existente, mantenha o app parado durante a cópia e importação. Não publique o novo app antes de importar, pois ele criará um administrador e o destino deixará de estar vazio.

No computador, extraia o projeto, execute `npm run setup` e configure `backend/.env` com `DB_CLIENT=pg`, `DATABASE_URL` e `DB_SCHEMA=rally`. Use uma cópia de um SQLite da versão atual (com a tabela relatorios_almas). Se o banco antigo estiver em uso, pare o aplicativo antes de copiar; preserve os arquivos WAL/SHM junto da cópia ou use a função backup do SQLite.

Execute na raiz:

```sh
node --env-file=backend/.env scripts/importar-sqlite.cjs CAMINHO_DA_COPIA.sqlite
```

O script cria o esquema, exige tabelas de aplicação vazias, importa em transação, converte booleanos, preserva IDs e senhas, ajusta sequências e confere contagens. Não apaga ou mistura dados existentes. Se ele recusar um destino ocupado, não limpe dados automaticamente: revise primeiro o que precisa preservar. Depois da importação, configure o Render e publique. Não remova o banco antigo até conferir os resultados e gerar backup PostgreSQL.

## 3. Configurar o Render

Web Service Node, branch main, Root Directory vazio:

- Build: `npm --prefix backend ci --omit=dev`
- Start: `npm start`

Em Environment:

| Nome | Valor |
|---|---|
| NODE_VERSION | 24 |
| NODE_ENV | production |
| DB_CLIENT | pg |
| DATABASE_URL | conexão Session pooler copiada do Supabase |
| DB_SCHEMA | rally |
| ADMIN_EMAIL | seu e-mail de administrador |
| ADMIN_PASSWORD | senha forte, pelo menos 8 caracteres, usada em banco novo |
| JWT_SECRET | segredo aleatório, por exemplo 32 bytes gerados localmente |

Remova DB_FILE e qualquer DB_SSL=false. Não configure PORT: o Render a fornece. Não precisa de disco `/var/data`. Uma DATABASE_URL presente também seleciona pg automaticamente quando DB_CLIENT não foi definido. Se escolher explicitamente DB_CLIENT=pg e a URL faltar, o servidor falha; não troca silenciosamente para SQLite.

A conexão exige TLS com certificado validado. Se o provedor exigir uma CA adicional, obtenha o certificado oficial e configure DATABASE_CA_CERT com o PEM (linhas reais ou `\n`). Não desative a validação TLS. Na URL, parâmetros sslmode são tratados pelo aplicativo para manter a verificação do certificado.

Faça Deploy. O log deve indicar que o servidor iniciou, sem aviso de SQLite temporário. Entre com o administrador configurado (ou a conta importada). Crie um registro de teste, reinicie o serviço e confira que ele continua lá.

## 4. Backup automático criptografado

O workflow `.github/workflows/backup.yml` está preparado para executar diariamente às 03:00 UTC (00:00 de Brasília) e manualmente. **Ele só funcionará após configurar os segredos abaixo.** Execuções agendadas do GitHub podem atrasar; repositórios públicos inativos podem ter agendamentos desativados.

No GitHub, abra Settings → Secrets and variables → Actions → New repository secret:

| Secret | Valor |
|---|---|
| DATABASE_BACKUP_URL | conexão Session pooler, com `?sslmode=verify-full` (ou `&sslmode=verify-full` se já houver parâmetros) |
| BACKUP_ENCRYPTION_KEY | segredo aleatório de pelo menos 32 caracteres (recomendado 64), diferente das senhas de login e JWT_SECRET |
| DATABASE_CA_CERT | CA oficial em PEM, se a conexão exigir |

Para gerar uma chave forte no terminal local: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Gere valores diferentes para JWT_SECRET e BACKUP_ENCRYPTION_KEY.

Não use a chave anon ou service_role: DATABASE_BACKUP_URL é uma URL PostgreSQL. Guarde BACKUP_ENCRYPTION_KEY fora do GitHub: sem ela não é possível recuperar os backups.

Depois abra Actions → Backup criptografado PostgreSQL → Run workflow. Confira a execução verde e baixe o artifact. O backup inclui estrutura, dados, hashes de senha, histórico e migrações do schema rally. Apenas o arquivo criptografado AES-256 é enviado; a cópia em texto claro é temporária e removida no encerramento.

Os artifacts ficam por 14 dias. Baixe periodicamente uma cópia para um local privado fora do GitHub (por exemplo, seu computador ou armazenamento de sua organização). Verifique as falhas em Actions e mantenha os avisos por e-mail habilitados. A retenção curta não é arquivo permanente, e os limites gratuitos do GitHub se aplicam.

## 5. Restaurar em um banco de teste primeiro

Instale GnuPG e as ferramentas PostgreSQL 18 ou superiores. Guarde as variáveis de conexão localmente, nunca em arquivos versionados.

1. Baixe o artifact e extraia o `.dump.gpg`.
2. Descriptografe (o GnuPG pede BACKUP_ENCRYPTION_KEY):

```sh
gpg --output rally.dump --decrypt ARQUIVO.dump.gpg
pg_restore --list rally.dump
```

3. Em um PostgreSQL **vazio**, configure PGDATABASE com a URL do banco de recuperação, PGSSLMODE=verify-full e PGSSLROOTCERT com o arquivo CA quando necessário. Execute:

```sh
pg_restore --dbname="$PGDATABASE" --exit-on-error --no-owner --no-acl rally.dump
```

4. Aponte uma instância de teste do app para esse banco. Confira login, pessoas, tribos, pontuações, histórico e relatórios. Só depois planeje a troca do banco de produção, com backup e aplicativo parado. Não execute `--clean` sobre produção sem um plano de recuperação.
5. Remova a cópia descriptografada do computador quando terminar, conforme sua política de proteção de dados.

## Verificação do código

`npm test` cobre SQLite e configuração TLS; `TEST_DATABASE_URL=... npm run test:postgres` executa os fluxos da API em schemas descartáveis de PostgreSQL local. CI em `.github/workflows/test.yml` executa ambos. O ambiente real Supabase/Render exige as variáveis e verificação final acima; essas credenciais não fazem parte do projeto.

## Alternativa: criar as tabelas pelo SQL Editor

Para um banco novo, o pacote [sql/LEIA-ME.md](sql/LEIA-ME.md) contém o SQL completo de instalação, criação do administrador e os campos do Render. A inicialização automática do app também continua funcionando; escolha apenas um procedimento para instalar. Para importar SQLite existente, siga a seção de importação acima antes de criar usuários no destino.
