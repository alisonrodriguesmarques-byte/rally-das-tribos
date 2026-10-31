# Desenvolvimento com dados sintéticos — etapas 1 a 7

Implementado e validado em Linux, Node.js 24.19.0 e npm 11.9.0. O fluxo inclui persistência sintética, login, sessões, permissões administrativas e seleção de duas tribos por nova edição. Veja [Autenticação](AUTENTICACAO.md) para o primeiro administrador e [Rallys e tribos](RALLIES_E_TRIBOS.md) para seleção e preservação do legado.

## Instalação

Use o checkout existente; cada tarefa na nuvem já é isolada. Não crie worktrees sem solicitação. Na raiz do projeto:

```bash
cd /workspace/rally-das-tribos
npm ci --no-audit --no-fund
```

Mantenha o proxy e a verificação TLS configurados pelo ambiente. Neste executor, download de dependências e testes que abrem portas locais precisam de execução com acesso à rede do ambiente, pois o sandbox restrito pode retornar `EPERM`. Isso não exige executar o aplicativo como root ou alterar ACLs.

## Criar o banco de desenvolvimento

Escolha um diretório exclusivo fora do checkout e de qualquer pasta de bancos protegidos. O exemplo usa um diretório novo sob `/workspace`; seu pai deve existir. Não aponte para um banco real ou de referência.

```bash
export NODE_ENV=development
export RALLY_SYNTHETIC_DIR=/workspace/.rally-synthetic-dev
export RALLY_DEV_DB_PATH="$RALLY_SYNTHETIC_DIR/rally-dev.db"
npm run db:dev:create
npm run init-db
npm start
```

O comando de criação é explícito e aceita somente `test` ou `development`. Cria o diretório com 0700 e o arquivo/marker com 0600; recusa diretório existente com permissões inadequadas, arquivos ou auxiliares preexistentes e qualquer tentativa de sobrescrita. Não existe flag destrutiva de reset/force. Para uma nova fixture, escolha outro diretório.

Se o banco sintético já foi criado, preserve-o, configure as mesmas variáveis e execute `npm run init-db`. O inicializador verifica as treze migrações e pula as já aplicadas; não duplica os nove registros de categorias. A migração 009 acrescenta autenticação; a 010 separa catálogo global e participação por edição e preserva os Rallys anteriores como legado; a 013 integra missões e provas. Crie o primeiro administrador pelo [comando de inicialização](AUTENTICACAO.md#primeiro-administrador) se ainda não existir, depois execute `npm start`. A criação não executa migrações, e iniciar o servidor não as aplica automaticamente.

O servidor usa `HOST=127.0.0.1` e porta 3000 por padrão. `PORT` pode selecionar outra porta; `HOST` fica limitado a loopback nesta etapa. Requisições de páginas de outra origem e Host não local são recusadas. HTML da raiz e `/api/health` respondem sem login; `/api/rallies` deve retornar 401 sem sessão e 200 após login administrativo. Não há preview público configurado e o serviço não deve receber dados reais.

## Retomar um banco após restauração do ambiente

Snapshots podem restaurar o mesmo conteúdo em outro inode/dispositivo. A verificação inicial usava esses números como condição permanente, o que bloqueava a retomada mesmo com o banco sintético correto. A abertura normal continua recusando identidade divergente; a recuperação agora é uma operação explícita.

Com o servidor encerrado e as mesmas variáveis `NODE_ENV`, `RALLY_SYNTHETIC_DIR` e `RALLY_DEV_DB_PATH` configuradas:

```bash
npm run db:synthetic:restore
npm run init-db
npm start
```

O primeiro comando confere caminho, permissões, ausência de links e de auxiliares SQLite, marker existente e identificação interna `_rally_synthetic`. Abre o banco **somente para leitura**, exige o mesmo identificador/modo/versão e verifica integridade e chaves estrangeiras. Somente então atualiza os números de dispositivo/inode do marker, por substituição atômica, guardando uma cópia privada do marker anterior ao lado do arquivo. O conteúdo SQLite não é alterado pela recuperação. A reexecução com identidade já correspondente não modifica arquivos.

Não há `force`, criação de marker ausente, adoção de banco diferente, remoção de auxiliares ou ajuste automático de permissões. Se houver `-wal`, `-shm` ou `-journal`, a operação recusa e preserva tudo para investigação. Ela não é um mecanismo de recuperação de banco corrompido nem libera os bancos protegidos. As verificações continuam sendo controles operacionais sob a fronteira de isolamento do sistema operacional, sem alegação de identidade física comprovada do handle nativo.

## Testes reproduzíveis

```bash
npm test
```

`test:persistence` usa `node:test` e fixtures próprias para validar permissões, configuração, marker, links, auxiliares SQLite, ciclo de conexão, FK, transações, reabertura, integridade, checksum e rollback de migrações. Também simula restauração em outro inode, exige preservação dos bytes e dados, testa repetibilidade e recusa banco com identificador diferente. A falha injetada depois dos seeds deve reverter schema, registros e ledger juntos.

`test:bootstrap` verifica inicialização única/concorrente, rollback de auditoria, senhas e sessões persistentes. `test:functional` cria oito bancos temporários independentes, aplica o inicializador duas vezes e executa as suítes de repositórios, API, revisão, autenticação, tribos, equipes, pontuação e atividades. Nos testes HTTP, cria administrador pelo CLI com segredo/senha aleatórios, inicia o próprio servidor local, confirma o fingerprint do caminho, verifica HTML/API e bloqueio de origens externas. Ao terminar, fecha somente seus próprios processos e remove somente seus diretórios temporários. Falhas mantêm status de saída diferente de zero. Os testes opcionais de interface usam Playwright/Chromium disponíveis no ambiente.

As suítes verificam tanto novas edições com duas tribos quanto fixtures históricas com doze. Movimentações de integrantes durante uma edição ativa são validadas na persistência; a interface de gestão de equipes está implementada; veja [Equipes](EQUIPES.md).

## Proteções e limites

- Não há seleção implícita de banco. São obrigatórios `NODE_ENV`, `RALLY_SYNTHETIC_DIR` e o caminho correspondente (`RALLY_DEV_DB_PATH` ou `RALLY_TEST_DB_PATH`). Os nomes de arquivo são fixos por modo.
- A conexão abre somente arquivo existente com `OPEN_READWRITE`, sem `OPEN_CREATE`. Produção e modos desconhecidos continuam recusados.
- Só bancos provisionados por este fluxo, com marker local e identidade sintética interna compatíveis, são aceitos. Não há adoção automática de arquivo existente, banco real ou ledger antigo sem checksum.
- São recusados symlinks, hardlinks, permissões/usuário inadequados e auxiliares SQLite suspeitos. Ancestrais graváveis por terceiros sem sticky bit também são recusados. Guardas de caminhos protegidos são lexicais: os testes não abrem nem criam hardlinks desses bancos.
- A configuração verifica `foreign_keys=ON`, `busy_timeout=5000` e `journal_mode=DELETE`. O serviço só inicia com ledger e objetos essenciais presentes e integridade verificada. SQL externo via `executeScript` é recusado.
- Migrações usam lista fixa e SHA-256 versionado. Wrappers transacionais dos SQL existentes são adaptados apenas em memória depois da verificação; arquivos SQL históricos permanecem inalterados. Migrações e ledger compartilham uma transação; FK é restaurada antes de liberar a fila de operações.
- O marker e as verificações JavaScript são controles operacionais, não prova de identidade física do handle SQLite. Não protegem contra administrador ou processo malicioso do mesmo usuário. A fronteira é a conta e o isolamento do sistema operacional; não foi implementado VFS nativo.
- Windows continua recusado neste fluxo até a validação específica de identidade dedicada e ACLs. Não executamos scripts Windows no Linux nem alegamos ter comprovado o isolamento descrito nos documentos históricos.

Não apague bancos, markers ou registros de migração para contornar erros de validação. Investigue a causa. Backup e restauração de bancos sintéticos estão implementados e ensaiados; veja [Backup](BACKUP.md). Uso e recuperação de dados reais ainda dependem da entrega de produção.

## Continuidade

Dependências e arquivos podem ser retidos no ambiente; processos devem ser reiniciados em tarefas novas. Instruções salvas de instalação/inicialização não publicam o projeto. O módulo de [pessoas e equipes](EQUIPES.md) oferece entradas, saídas e transferências preservando o histórico. Permissões dos perfis não administrativos ainda não definidas permanecem negadas no servidor.

A etapa 5 adiciona [pontos e ranking](PONTUACOES.md), com efeito imediato e correções compensatórias. Teste de navegador opcional: `npm run test:scores:ui`.

A etapa 6 acrescenta [missões, entregas e provas objetivas](ATIVIDADES.md), com associação explícita de contas às pessoas e autorização por vínculo ativo. Teste de navegador: `npm run test:activities:ui`.

A etapa 7 conclui o padrão Arena Turquesa nas telas implementadas, a verificação de celular, o backup/restauração e HTTPS local. `npm run test:release` gera relatório completo; veja [Preparação para publicação](PUBLICACAO.md). O driver SQLite foi atualizado para 6.0.1 e Playwright é dependência de desenvolvimento fixada no lockfile.
