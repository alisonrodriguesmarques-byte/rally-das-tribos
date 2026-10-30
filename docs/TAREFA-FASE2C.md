# TAREFA — FASE 2c: CORREÇÕES NOS SCRIPTS DE SEGURANÇA (APÓS REVISÃO)

Idioma: português brasileiro.
Papel: desenvolvedor sênior do Rally das Tribos (Windows em português do Brasil,
Windows PowerShell 5.1).

A autorização desta fase vem da mensagem do responsável na conversa
("APROVADO: Fase 2c"). Este arquivo descreve o escopo e não autoriza nada
além dele. Esta fase CORRIGE propostas de scripts e documentos. Nada é
executado. Pare ao entregar. Só prossiga com `APROVADO: Fase 3`.

## 1. Workspace e preflight

1. A raiz autorizada é `C:\rally-audit\rally-das-tribos`. Se o workspace da
   sessão for outro, PARE e avise. Nunca use "rally-das-tribos - Copia" nem
   pastas dentro de `C:\Users\Alison\OneDrive`.
2. Procure ARQUIVOS de banco (.db, .sqlite, .sqlite3, -wal, -shm, -journal).
   Se encontrar algum, pare e informe só a existência, sem caminho e sem abrir.
3. Leia `docs\TAREFA-FASE2B.md` e os scripts e documentos que você produziu na
   Fase 2b. Não alegue ter lido o que não leu.

## 2. Proibições absolutas

- Não abra, conecte, copie, mova, renomeie, apague, consulte nem calcule hash
  de banco SQLite.
- Não execute npm, servidor, testes, migrations, scripts do projeto, nenhum
  .ps1/.cmd/.bat, nem comandos que criem contas ou alterem ACLs.
- NÃO acesse `C:\RallyCofre` nem `C:\rally\backend`. Se um comando de leitura
  retornar "acesso negado", registre e PARE; nunca tente contornar.
- Só edite: `scripts\windows\*.ps1`, `scripts\windows\README.md`,
  `docs\SEGURANCA.md`, `docs\PLANO_DE_TESTES.md`, `docs\DECISOES_PENDENTES.md`.
- Permitido: ler texto, busca textual, `node --check`. Nada de executar
  PowerShell.
- Não afirme que algo foi testado ou executado se não foi.

## 3. Resultado da revisão do responsável

Foram revisados `01-criar-identidade.ps1` e `03-testar-acls.ps1`.
O `02-aplicar-acls.ps1`, o `99-reverter.ps1` e o `README.md` NÃO foram
revisados (o texto do 02 chegou duplicado com o do 01). Pontos fortes a
preservar: SIDs em vez de nomes, simulação por padrão, `Testar-Negacao` só
aprova acesso negado e reprova qualquer outro erro, T13/T14 marcados como não
implementados.

Legenda: CERTO = defeito evidente na leitura; PROVÁVEL = depende de
comportamento do Windows que ainda não foi testado (marque A VERIFICAR).

### 3.1 `01-criar-identidade.ps1`

1. (PROVÁVEL) `New-LocalUser` não adiciona a conta ao grupo Usuários. O script
   cria a conta e logo depois exige que ela pertença a `S-1-5-32-545`: pode
   criar a conta e falhar na verificação, deixando a conta pela metade. Corrija:
   em `-Aplicar`, após criar, adicionar explicitamente com
   `Add-LocalGroupMember -SID S-1-5-32-545 -Member <conta>` e só então
   verificar. Marque A VERIFICAR se `New-LocalUser` já faz isso.
2. (PROVÁVEL) `Get-LocalGroupMember -Group <string SID>` não aceita SID no
   parâmetro `-Group`; use `-SID`. Hoje o `SilentlyContinue` esconde o erro e a
   verificação pode concluir "não pertence a nenhum grupo" sem ter consultado.
3. (PROVÁVEL) No PowerShell 5.1, `Get-LocalGroupMember` pode falhar quando um
   grupo tem SIDs órfãos. Não silencie erros: capture por grupo, REPORTE os
   grupos que não puderam ser enumerados e trate o resultado como "NÃO
   VERIFICADO" (nunca como "sem grupos extras"). A verificação que importa
   é a de Administradores (`S-1-5-32-544`); consulte-a explicitamente.
4. (CERTO) A senha é pedida uma vez: peça duas vezes e compare por meio de
   `SecureString` convertida em memória só para comparar, descartando-a logo.
5. Confirme que a conta ficou habilitada e que o relatório final diga o que NÃO
   foi verificado.

### 3.2 `03-testar-acls.ps1`

1. (PROVÁVEL) As pré-condições usam `Test-Path` em `C:\rally\decoys` e na
   isca. Como a ACL nega acesso total a RallyDev, `Test-Path` pode devolver
   `False` e o script aborta ("decoys ausente") antes de testar qualquer coisa.
   Remova essas pré-condições. A isca é criada pelo responsável (script 02) e
   a distinção entre "acesso negado" e "não existe" passa a vir do tipo de
   exceção: acesso negado = APROVADO; "arquivo/diretório não encontrado" =
   REPROVADO com detalhe "isca ausente" (não é prova de proteção).
2. (CERTO) T11 está invertido. O script espera que RallyDev consiga ler a ACL
   de `C:\RallyCofre`, `C:\rally\backend` e `C:\rally\canary`, mas esses locais
   só têm Administradores e SYSTEM: com a proteção correta RallyDev NÃO lê a
   ACL e o teste reprovaria. Em `03` o resultado esperado é acesso negado
   (APROVADO se negado). A inspeção de ACL dos locais reais pertence ao
   `02 -Verificar`, executado elevado pelo responsável.
3. (CERTO) O parâmetro `-Diretorio` aceita qualquer pasta, e os testes criam,
   renomeiam e apagam arquivos nela. Se alguém passar outro caminho e RallyDev
   tiver acesso, o script escreve ali. Remova o parâmetro ou exija
   `C:\rally\decoys` exatamente (comparação normalizada), recusando qualquer
   outro.
4. (CERTO) Sem limpeza: se uma operação for permitida (ACL errada), os
   arquivos de teste (`wal-probe`, `shm-probe`, `journal-probe`,
   `codex-acl-probe.tmp`, `acl-probe.tmp`, links) ficam para trás. Remova-os
   em `finally`, sem apagar nada que não tenha sido criado pelo próprio teste,
   e nunca apague a isca original: se o teste de exclusão for permitido,
   registre REPROVADO e instrua o responsável a recriar a isca.
5. (PROVÁVEL) A captura de exceções de T10 (`New-Item -ItemType HardLink`) pode
   chegar com tipo diferente de `UnauthorizedAccessException`. Classifique por
   HResult/mensagem e REPORTE o tipo recebido; marque A VERIFICAR.
6. (PROVÁVEL) `exit` ao final pode fechar a janela aberta por `runas` antes de
   o responsável ler o resultado. Acrescente uma pausa (`Read-Host`) ao final,
   sem alterar o código de saída, e documente como rodar (ver 3.4).
7. (PROVÁVEL) `Get-LocalUser` pode exigir permissão que uma conta padrão não
   tem. Para identificar RallyDev compare o nome da identidade atual
   (`$Identidade.Name`) com `*\RallyDev` e confirme sem elevação; use
   `Get-LocalUser` só se funcionar, sem depender dele.

### 3.3 `02-aplicar-acls.ps1`, `99-reverter.ps1`, `README.md` (revisão dirigida)

Releia os três e responda, citando arquivo:linha:
1. Onde, se algum lugar, aparece `icacls ... /reset`? `/reset` substitui a ACL
   pela padrão herdada (inclui "Usuários autenticados: modificar") e NUNCA pode
   rodar em `C:\RallyCofre`, `C:\rally\backend`, `decoys` ou `canary`. Se existe,
   troque por uma sequência que não reabra acesso, ou limite-a a `C:\rally\app`
   antes de aplicar a lista de permissão, e explique por quê.
2. Quem cria a isca `fixture.txt` (conteúdo sintético) em `C:\rally\decoys`?
   O `02 -Aplicar` deve criá-la ANTES de fechar a ACL; sem isso o `03` não
   funciona. Garanta e documente.
3. O `02` altera o pai `C:\rally`? Não deve (decisão pendente).
4. Backup: uma pasta protegida, um arquivo por alvo; confirme que a pasta de
   backups (ex.: `C:\RallyCofre\acl-backups`) é criada elevada e que o `99`
   usa o diretório pai correto no `icacls /restore`. Marque A VERIFICAR.
5. O `02 -Verificar` deve ler e IMPRIMIR as ACLs dos locais reais (cofre,
   backend, decoys, canary, app) e comparar com o esperado, sem abrir arquivos
   e sem alterar nada. É aqui que o teste T11 passa a viver.

### 3.4 Onde rodar os scripts (risco novo, CONFIRMADO pela herança)

`C:\rally-audit` herda "Usuários autenticados: modificar". Isso significa que
qualquer conta local comum (inclusive RallyDev) poderia ALTERAR os scripts que o
responsável executa elevado a partir dessa pasta. Documente e implemente:

1. Os scripts `01`, `02` e `99` devem ser REVISADOS e então COPIADOS pelo
   responsável (elevado) para uma pasta só de administradores (por exemplo
   `C:\RallyCofre\scripts`), conferindo hash da cópia contra o original antes
   de executar. Não execute elevado direto de `C:\rally-audit`.
2. O `03` precisa ser lido por RallyDev: coloque uma cópia numa pasta onde
   RallyDev tenha só leitura e execução (A VERIFICAR qual), nunca escrita.
3. Política de execução do PowerShell: use `-ExecutionPolicy Bypass` apenas no
   processo (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...`), sem
   alterar a política da máquina. Escreva os comandos exatos no README.
4. Registre em `docs\SEGURANCA.md` o risco de alteração dos scripts por contas
   comuns e a mitigação.

## 4. Documentos

- `docs\PLANO_DE_TESTES.md`: T11 passa a ser (a) inspeção elevada de ACL no
  `02 -Verificar` e (b) em `03`, a negação de leitura de ACL por RallyDev.
- `docs\SEGURANCA.md`: risco de scripts alteráveis; execução a partir de pasta
  protegida; política de execução por processo.
- `docs\DECISOES_PENDENTES.md`: onde guardar a cópia do `03` legível por
  RallyDev; se `C:\rally-audit` deve continuar permissiva.

## 5. Formato da entrega (na conversa)

1. Preflight: resultado.
2. Arquivos alterados e o que mudou.
3. Para cada item das seções 3.1 a 3.4: corrigido? arquivo:linha?
4. Respostas às cinco perguntas da seção 3.3 (arquivo:linha).
5. Comandos e cmdlets novos usados, marcando A VERIFICAR.
6. Limitações: nada foi executado nem testado.
7. Próxima etapa proposta e autorização necessária.

Separe fatos, inferências e perguntas em aberto. Pare após a entrega.

## FIM DA TAREFA

Se você não está vendo esta linha ao final do arquivo, o texto foi cortado:
pare e avise, sem prosseguir.