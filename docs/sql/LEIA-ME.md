# Instalar pelo SQL Editor do Supabase

Este pacote é compatível com o backend atual do Rally das Tribos. Cria as 25 tabelas da aplicação, as duas tabelas de controle do Knex, chaves, índices, sequências, as 13 tribos (incluindo Levi, Manassés e Efraim) e 10 categorias históricas. Tabelas legadas de provas/dinâmicas são mantidas para compatibilidade; isso não reativa esses módulos.

## Projeto novo, sem dados

1. No Supabase, entre no seu projeto → **SQL Editor → New query**.
2. Abra `01_instalar_rally.sql` em um editor de texto, copie **todo** o conteúdo e cole na nova consulta. Execute **Run** com o papel `postgres`. Deve aparecer “Instalação concluída” e 13 tribos.
3. Abra outra consulta. Copie `02_criar_administrador.sql` inteiro e altere somente os valores de `email_admin`, `senha_admin` e `nome_admin` no começo do bloco DECLARE. A senha deve ter ao menos 12 caracteres e no máximo 72 bytes (bcrypt). Mantenha as aspas simples; se usar uma aspa simples dentro do texto, escreva duas (`''`). Execute **Run**.
4. Configure o Render conforme `03_configuracao_render.txt`. Esses campos são do painel do Render, não do SQL Editor. Faça um deploy.
5. Abra o site e entre com o e-mail e senha definidos no SQL 02. O administrador cadastra pessoas e concede acesso; cabeça e auxiliar são associados às tribos pelo aplicativo. As permissões continuam no backend.

## Se já houver dados

**Não execute a instalação para tentar atualizar um banco já em uso.** O arquivo 01 recusa a reinstalação; ele não apaga nem substitui dados. O 02 também não altera administradores existentes. Se o aplicativo já criou as tabelas, você não precisa executar o 01. Se já existe administrador, use o login existente.

Para trazer dados do SQLite, siga `../SUPABASE-RENDER.md`, importando no destino vazio antes do primeiro deploy. Não crie o administrador pelo 02 antes de importar: o importador exige destino vazio e preserva os usuários do banco antigo.

## Usuários e acesso ao banco

O login deste projeto é próprio, com tabela `rally.usuarios`, bcrypt e cookie de sessão. Ele **não** cria usuários em Authentication → Users do Supabase, nem precisa de chave anon no navegador. A senha do usuário do site é diferente da senha PostgreSQL usada em DATABASE_URL.

O schema privado `rally` não deve ser adicionado aos schemas expostos na Data API. O SQL revoga acesso de PUBLIC, anon e authenticated ao schema, às tabelas e às sequências. A API Express continua sendo o caminho de acesso. Use a conexão Session pooler de servidor (porta 5432) no Render, com as credenciais apropriadas; não conceda acesso às tabelas para anon.

No Table Editor, selecione o schema **rally** para visualizar as tabelas como administrador do projeto. A tabela de usuários já guarda somente o hash da senha. Não compartilhe a consulta 02 depois de preenchê-la; sua senha aparece no texto e pode ficar no histórico do SQL Editor. Gere a senha de modo privado e respeite as políticas da sua organização.

## Backups

A instalação SQL não ativa os backups sozinha. Configure os secrets do GitHub e execute a primeira cópia conforme `../SUPABASE-RENDER.md`. Guarde a chave de criptografia fora do GitHub.

## Validação

Os arquivos foram executados em PostgreSQL local. Foram verificados: tabelas e catálogos, bloqueio de acesso de anon/authenticated, recusa de reinstalação e troca de administrador, hash bcrypt compatível com o login real da API e reconhecimento das migrações pelo Knex sem reaplicar o esquema. A execução no seu projeto Supabase depende de você colar os arquivos e configurar a conexão.
