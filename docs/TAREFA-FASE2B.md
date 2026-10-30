# TAREFA — FASE 2b: REVISÃO DOS SCRIPTS E DOCUMENTOS DE SEGURANÇA

Idioma: português brasileiro.
Papel: desenvolvedor sênior e arquiteto do Rally das Tribos (Node.js, Express,
SQLite via `sqlite3`, Windows em português do Brasil).

A autorização desta fase vem da mensagem do responsável na conversa
("APROVADO: Fase 2b"). Este arquivo descreve o escopo e não autoriza nada além
dele. Esta fase CORRIGE documentos e PROPOSTAS de scripts. Nada é executado.
Pare ao entregar. Só prossiga com `APROVADO: Fase 3` (ou outra fase por nome).

## 1. Workspace e preflight

1. A raiz autorizada é `C:\rally-audit\rally-das-tribos`. Se o workspace da
   sessão for outro, PARE e avise. Nunca use "rally-das-tribos - Copia" nem
   pastas dentro de `C:\Users\Alison\OneDrive`.
2. Procure ARQUIVOS de banco (.db, .sqlite, .sqlite3, sufixos -wal, -shm,
   -journal). Se encontrar algum, pare e informe só a existência, sem caminho
   completo e sem abrir. `data\.gitkeep` é esperado.
3. Leia, nesta ordem: `docs\TAREFA-FASE2.md` (contexto e decisões A–F, D1–D7),
   `docs\referencia\rally-das-tribos-auditoria-e-plano-de-seguranca.html` e os
   documentos e scripts que você mesmo criou na Fase 2 (`docs\*.md`,
   `scripts\windows\*`). Se algum faltar, informe; não alegue tê-lo lido.
4. Não alegue acesso a arquivos, máquinas ou repositórios indisponíveis.

## 2. Proibições absolutas

- Não abra, conecte, copie, mova, renomeie, apague, consulte nem calcule hash
  de banco SQLite. Operações sobre bancos protegidos são só do responsável.
- Não execute: npm, servidor, testes, migrations, scripts do projeto, nenhum
  .ps1/.cmd/.bat, nem comandos que criem contas ou alterem ACLs
  (icacls, Set-Acl, takeown, net user, New-LocalUser etc.).
- NÃO tente acessar `C:\RallyCofre` nem `C:\rally\backend`. Foram fechados de
  propósito: se algum comando de leitura retornar "acesso negado", registre e
  PARE; nunca tente contornar (sem takeown, icacls, elevação, outro caminho).
- Só edite: `scripts\windows\*.ps1`, `scripts\windows\README.md`,
  `docs\SEGURANCA.md`, `docs\PLANO_DE_TESTES.md`, `docs\DECISOES_PENDENTES.md`.
  Não modifique backend\, frontend\, migrations, package.json nem os outros
  documentos. Se um arquivo da lista não existir, crie-o novo.
- Permitido: ler texto, busca textual, `node --check` (só sintaxe).
- Não afirme que algo foi testado ou executado se não foi.

## 3. Evidências coletadas na máquina real (tratar como FATO, não hipótese)

O responsável executou e relatou, em PowerShell elevado ("Administrador") e em
terminal comum, no Windows em português:

1. `icacls C:\` mostra herança padrão perigosa: "Usuários autenticados" com
   modificação `(OI)(CI)(IO)(M)` e "Usuários" com leitura `(RX)`. As pastas
   `C:\rally`, `C:\RallyCofre` e `C:\rally-audit` herdavam isso (marcado `(I)`).
   O achado 9 da Fase 2 passa de "a verificar" para CONFIRMADO.
2. Foram aplicados MANUALMENTE, elevado, em `C:\RallyCofre` e `C:\rally\backend`:
   - `icacls <pasta> /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F"`
   - `icacls <pasta> /inheritance:r`
   - `icacls <pasta> /setowner "*S-1-5-32-544" /t /c` (949 itens em backend,
     5 no cofre, sem falhas); dono final: `BUILTIN\Administradores`.
   Resultado: só Administradores e SISTEMA. Terminal SEM elevação recebe
   "Acesso negado". Backups das ACLs antigas: `%USERPROFILE%\rally-acl-backup`
   (`cofre.acl`, `backend.acl`). O responsável relatou que os testes de
   reabertura (tentar conceder acesso sem elevação) foram negados. Esses
   comandos e a sintaxe com SIDs FORAM validados na máquina; qualquer outro
   comando icacls continua "A VERIFICAR".
3. Idioma do Windows: português ("Administradores", "SISTEMA", "Usuários").
   NÃO use nomes de contas ou grupos nos scripts: use SIDs
   (Administradores `S-1-5-32-544`, SYSTEM `S-1-5-18`, Usuários `S-1-5-32-545`,
   Usuários autenticados `S-1-5-11`) e resolva a conta atual por
   `[Security.Principal.WindowsIdentity]::GetCurrent().User`.
4. Conta atual `Alison` é membro de Administradores. Em terminal sem elevação o
   grupo fica desativado no token; por isso, para processos sem elevação
   (inclusive o Codex), o cofre e `C:\rally\backend` estão fechados.
5. `C:\rally\backend` parece um protótipo antigo (tem `rally.db`, `src\` e
   `node_modules` com bcryptjs e jsonwebtoken); origem A CONFIRMAR pelo
   responsável. Não leia nem proponha ler.
6. Bancos originais (OneDrive e Temp): o `attrib +R` foi instruído, a
   confirmação (`IsReadOnly = True`) ainda é pendente; trate como pendente.
   Esses dois locais NÃO estão fechados por ACL e continuam alcançáveis pela
   conta do responsável (e portanto por uma ferramenta que rode nela).
7. Limite que deve constar na documentação: a barreira vale contra processos
   sem elevação. Se o responsável abrir um terminal elevado e aprovar nele
   comandos do Codex (ou rodar o Codex elevado), a proteção deixa de existir.
   Registre a regra: NUNCA rodar o Codex nem colar comandos dele em terminal
   elevado.

## 4. Falhas do `02-aplicar-acls.ps1` anterior (corrigir todas)

1. Recusava qualquer caminho relacionado aos locais protegidos, então nunca
   protegia o cofre nem a pasta do `rally.db`. (Agora esses dois já foram
   fechados manualmente: o script não deve reaplicá-los por padrão.)
2. Só negava escrita e nunca leitura. Usava lista de negação, que é frágil.
   Em locais protegidos use LISTA DE PERMISSÃO: conceder Administradores e
   SYSTEM, depois remover herança (`/inheritance:r`), depois definir o dono
   (`/setowner "*S-1-5-32-544"`). Ordem: conceder, remover herança, dono.
3. Alvos padrão (`C:\rally\canary`, `C:\rally\decoys`) não existiam e o script
   exigia que preexistissem. Crie-os (vazios) antes de proteger.
4. Nunca concedia leitura a RallyDev em `C:\rally\app`.
5. Não verificava se a conta RallyDev existia antes de aplicar.
6. Sintaxe `(W,DC,WDAC,WO)` misturava direitos simples e específicos: não usar.
7. A negação não tinha `(OI)(CI)`: não valia para arquivos criados depois.
8. `icacls /save` com vários alvos e um único arquivo de backup, em `%TEMP%`.
9. Código ilegível (instruções comprimidas em uma linha).

## 5. O que entregar

### 5.1 `scripts\windows\` (propostas; NÃO executar)

Todos: formato legível (uma instrução por linha, comentários em português),
SIDs em vez de nomes, `Set-StrictMode`, `$ErrorActionPreference='Stop'`,
modo simulação por padrão (imprimir o comando icacls EXATO que seria
executado), execução real só com `-Aplicar`, verificação de elevação por
`IsInRole` com o SID de Administradores, log sem segredos, idempotência.
Cabeçalho: o que faz, o que NÃO faz, o que está "A VERIFICAR".

- `01-criar-identidade.ps1`: cria a conta local padrão `RallyDev` (sem grupos
  além de Usuários, senha lida por `Read-Host -AsSecureString`, nunca gravada
  nem exibida, sem direitos de administrador, sem login automático). Se a conta
  existir, apenas verifica e não altera. Documente: o perfil só existe após o
  primeiro uso com perfil carregado (A VERIFICAR).
- `02-aplicar-acls.ps1`: parâmetros `-Aplicar` e `-Verificar`.
  Locais e política (lista de permissão, herança removida, dono Administradores):
  - `C:\RallyCofre` e `C:\rally\backend`: JÁ APLICADOS manualmente. Padrão do
    script: só verificar (ler a ACL do diretório) e nunca alterar, salvo
    parâmetro explícito `-ReaplicarProtegidos`.
  - `C:\rally\decoys` e `C:\rally\canary`: criar se faltarem; só Administradores
    e SYSTEM (RallyDev sem acesso nenhum). A sentinela serve para o futuro gate G4.
  - `C:\rally\app` (código): Administradores e SYSTEM controle total; conta atual
    (SID resolvido em tempo de execução) modificar; `RallyDev` somente leitura e
    execução `(OI)(CI)RX`; sem herança; sem escrita para RallyDev.
  - Diretórios de desenvolvimento e teste no perfil de RallyDev
    (`%LOCALAPPDATA%\RallyDasTribos\dev` e `\test`): só se o perfil existir;
    RallyDev modificar; Administradores e SYSTEM controle total.
  - O pai `C:\rally` herda "Usuários autenticados: modificar". NÃO altere o pai
    sem decisão; garanta que cada filho seja protegido na ordem
    conceder → remover herança → dono, e documente a decisão pendente sobre o pai.
  - Verificações antes de aplicar: elevação, existência de `RallyDev`
    (`Get-LocalUser`), existência/criação dos alvos, e recusa de qualquer caminho
    que contenha ou seja pai de um banco `.db` conhecido (exceto a operação de
    fechar permissões, que não abre arquivos).
  - Antes de alterar cada alvo: `icacls <alvo> /save <arquivo> /t /c`, UM
    arquivo por alvo, em pasta protegida (por exemplo `C:\RallyCofre\acl-backups`),
    nunca em `%TEMP%`. Verifique o código de saída e o arquivo gerado.
  - Em caso de falha no meio, parar e instruir a reversão.
- `03-testar-acls.ps1`: deve ser executado COMO `RallyDev`, SEM elevação, em
  janela iniciada pelo responsável com `runas /user:RallyDev` (digitando a
  senha; nunca em argumentos). Testes sobre iscas sintéticas; imprimir
  APROVADO/REPROVADO por teste e código de saída. Os testes positivos no
  diretório de desenvolvimento só rodam se ele existir. Não requer elevação e
  nunca abre bancos.
- `99-reverter.ps1`: restaura a partir dos backups por alvo. Documente que
  `icacls /restore` recebe o diretório PAI do alvo salvo (A VERIFICAR) e
  que a reversão exige PowerShell elevado.
- `README.md`: ordem 01 → 02 (simulação) → 02 (-Aplicar) → 03; pré-requisitos;
  riscos (por exemplo, erro de ACL pode trancar o próprio responsável: manter
  backup e testar primeiro nas iscas); proibição de rodar o Codex elevado.

### 5.2 Documentos

- `docs\SEGURANCA.md`: acrescente a seção "Evidências coletadas" com os fatos da
  seção 3; atualize a tabela de locais (cofre e backend: JÁ FECHADOS; originais
  ainda alcançáveis; decoys, canary, app, dev, test); corrija o achado 9 para
  CONFIRMADO; registre o limite da elevação (item 7); descreva D4 como
  implementação PARCIAL (só cofre e backend; os dois originais NÃO isolados).
- `docs\PLANO_DE_TESTES.md`: T2–T6 e T12 refletem o que os scripts realmente
  fazem (acesso negado total nas iscas, cofre e sentinela); T1, T8, T9 e T10
  dependem de `RallyDev` existir. T13 e T14 pertencem à fase do gate no código
  (G1–G8): marque como NÃO implementados nesta fase.
- `docs\DECISOES_PENDENTES.md`: acrescente (a) origem de `C:\rally\backend` e o
  que fazer com ele; (b) mover os dois originais para o cofre (recomendado,
  manual) e confirmar `IsReadOnly`; (c) política para `C:\rally` (pai) e
  `C:\rally-audit`; (d) onde ficam definitivamente os diretórios dev e test.

## 6. Formato da entrega (na conversa)

1. Preflight: resultado.
2. Arquivos alterados e criados (lista), e o que mudou em cada um.
3. Para cada falha da seção 4: corrigida? onde (arquivo:linha)?
4. Comandos icacls usados, marcando VALIDADO (os da seção 3) ou A VERIFICAR.
5. Pontos A VERIFICAR na máquina real.
6. Decisões que dependem do responsável.
7. Limitações: nada foi executado nem testado.
8. Próxima etapa proposta e autorização necessária.

Separe fatos, inferências e perguntas em aberto. Pare após a entrega.

## FIM DA TAREFA

Se você não está vendo esta linha ao final do arquivo, o texto foi cortado:
pare e avise, sem prosseguir.