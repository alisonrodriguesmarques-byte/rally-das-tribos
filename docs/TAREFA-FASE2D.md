# TAREFA — FASE 2d: CORREÇÕES NO 02-aplicar-acls.ps1 E NO 99-reverter.ps1

Idioma: português brasileiro.
Contexto: Windows em português do Brasil, Windows PowerShell 5.1.

A autorização desta fase vem da mensagem do responsável na conversa
("APROVADO: Fase 2d"). Este arquivo descreve o escopo e não autoriza nada
além dele. Esta fase CORRIGE propostas de scripts e documentos. Nada é
executado. Pare ao entregar. Só prossiga com `APROVADO: Fase 3`.

## 1. Workspace e preflight

1. A raiz autorizada é `C:\rally-audit\rally-das-tribos`. Se o workspace da
   sessão for outro, PARE e avise. Nunca use "rally-das-tribos - Copia" nem
   pastas dentro de `C:\Users\Alison\OneDrive`.
2. Procure ARQUIVOS de banco (.db, .sqlite, .sqlite3, -wal, -shm, -journal).
   Se encontrar algum, pare e informe só a existência, sem caminho e sem abrir.
3. Leia `docs\TAREFA-FASE2C.md` e verifique o que dela já foi aplicado. Se a
   Fase 2c ainda não foi concluída, pare e avise (esta fase assume a 2c feita).
4. Não alegue ter lido o que não leu.

## 2. Proibições absolutas

- Não abra, conecte, copie, mova, renomeie, apague, consulte nem calcule hash
  de banco SQLite.
- Não execute npm, servidor, testes, migrations, scripts do projeto, nenhum
  .ps1/.cmd/.bat, nem comandos que criem contas ou alterem ACLs.
- NÃO acesse `C:\RallyCofre` nem `C:\rally\backend`. Se um comando de leitura
  retornar "acesso negado", registre e PARE; nunca tente contornar.
- Só edite: `scripts\windows\02-aplicar-acls.ps1`,
  `scripts\windows\99-reverter.ps1`, `scripts\windows\README.md`,
  `docs\SEGURANCA.md`, `docs\PLANO_DE_TESTES.md`, `docs\DECISOES_PENDENTES.md`.
- Permitido: ler texto, busca textual, `node --check`. Nada de executar
  PowerShell.
- Não afirme que algo foi testado ou executado se não foi.

## 3. Defeitos encontrados na revisão do responsável

Legenda: CERTO = defeito evidente na leitura; PROVÁVEL = depende de
comportamento do Windows ainda não testado (marque A VERIFICAR).

### 3.1 `02-aplicar-acls.ps1`

1. (CERTO) Erro de sintaxe no bloco de aplicação:
   `if (Test-CaminhoConhecidoDeBanco $Alvo -and $Alvo -notin $Protegidos)`.
   Chamada de função precisa de parênteses antes de `-and`; do jeito atual o
   PowerShell trata `-and` como parâmetro e o script aborta no primeiro alvo,
   depois dos backups. Corrija para
   `if ((Test-CaminhoConhecidoDeBanco $Alvo) -and ($Alvo -notin $Protegidos))`
   e revise TODO o arquivo por construções equivalentes.
2. (CERTO) `icacls ... /reset /t /c` é usado em todo alvo. `/reset` troca a ACL
   pela padrão herdada, que inclui "Usuários autenticados: modificar" (herança
   do `C:\`, CONFIRMADA). Com `-ReaplicarProtegidos`, o cofre e o backend
   ficariam abertos entre o `/reset` e a remoção da herança, e permaneceriam
   abertos se qualquer passo seguinte falhasse. PROIBIDO usar `/reset` em
   qualquer alvo. Troque pela sequência abaixo (seção 4).
3. (PROVÁVEL) `/t` nos passos de concessão e de `/inheritance:r` não é o que foi
   validado na máquina: lá, `grant:r` e `inheritance:r` foram aplicados SEM `/t`
   (só `/setowner` usou `/t`) e os arquivos herdaram da pasta. Com `/t`,
   `/inheritance:r` age em cada filho e a ACL de cada arquivo passa a depender
   de concessões explícitas repetidas. Reproduza exatamente a sequência
   validada (seção 4).
4. (CERTO) Nenhum código cria `fixture.txt` (conteúdo sintético) em
   `C:\rally\decoys`. O `03-testar-acls.ps1` precisa dela. Crie em `-Aplicar`,
   ANTES de fechar a ACL, com texto simples e sem extensão de banco.
5. (CERTO) Todos os modos, inclusive simulação e `-Verificar`, lançam erro se a
   conta RallyDev não existir, então não dá para simular nem verificar o cofre
   antes de criar a conta. Torne a conta opcional nesses modos: sem a conta,
   use um marcador "<SID de RallyDev>" na simulação e REGISTRE "RallyDev
   ausente: verificações específicas não realizadas". `-Aplicar` continua
   exigindo a conta.
6. (CERTO) `-Verificar` imprime a saída do `icacls` mas não compara com o
   esperado, e depois cai no bloco de simulação e imprime comandos de alteração
   (enganoso). Corrija: `-Verificar` é somente leitura, NÃO imprime simulação
   de alteração e retorna ao final.
7. (CERTO) O T11 depende de asserções automáticas. Em `-Verificar` (elevado),
   para cada alvo existente, ler a ACL e AFIRMAR:
   - cofre, backend, decoys, canary: só Administradores (`S-1-5-32-544`) e
     SYSTEM (`S-1-5-18`), sem herança, dono Administradores;
   - app: Administradores e SYSTEM controle total, operador modificar,
     RallyDev (se existir) só leitura e execução, sem herança;
   - nenhum dos SIDs `S-1-5-11`, `S-1-5-32-545`, `S-1-1-0` em locais protegidos.
   Imprima APROVADO/REPROVADO por alvo, sem alterar nada. Use
   `Get-Acl`/SIDs, não nomes (Windows em português). A VERIFICAR a forma de
   ler o proprietário e a herança.
8. (PROVÁVEL) O backup do cofre grava o `.acl` DENTRO do próprio cofre com
   `/t`, então a varredura inclui a pasta de backups em andamento. Para alvos
   protegidos (que só são reaplicados com `-ReaplicarProtegidos`), documente e
   trate: por exemplo, salvar o backup dessas pastas em outro local protegido
   ou sem `/t`; marque A VERIFICAR.
9. (CERTO) O operador usado na concessão do `app` é o SID do processo elevado.
   Imprima esse SID e o nome da conta antes de aplicar e exija confirmação
   explícita (`-ConfirmarOperador`) para evitar conceder acesso a outra conta de
   administrador.

### 3.2 `99-reverter.ps1`

1. (PROVÁVEL) `icacls /save` guarda DACLs, mas provavelmente NÃO guarda o
   proprietário: a reversão pode não desfazer o `/setowner` (dono continua
   Administradores). Documente e marque A VERIFICAR; se confirmado na máquina,
   a reversão do dono é passo manual.
2. (CERTO) Os alvos `decoys` e `canary` são criados pelo `02` antes do backup,
   com ACL herdada aberta; o backup guarda esse estado aberto e a reversão
   devolveria essa abertura. Documente no README; isso é esperado e não deve
   ser usado para "desproteger" cofre ou backend.
3. Garanta que o `99` continue em simulação por padrão, exija elevação com
   `-Aplicar` e recuse arquivos `.acl` que não correspondam a alvo reconhecido
   (já faz). Acrescente confirmação explícita extra (`-ConfirmarReversao`) para
   restaurar o cofre ou o backend.

## 4. Sequência obrigatória para fechar um local

Para cada alvo fechado (cofre/backend só com `-ReaplicarProtegidos`, decoys,
canary), usar EXATAMENTE a forma já validada na máquina e nesta ordem:

1. `icacls <alvo> /grant:r "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F"`
2. `icacls <alvo> /inheritance:r`
3. `icacls <alvo> /remove:g "*S-1-5-11" "*S-1-5-32-545" "*S-1-1-0"` e, se a conta
   existir, o SID de RallyDev (A VERIFICAR a sintaxe `/remove:g` com SID)
4. `icacls <alvo> /setowner "*S-1-5-32-544" /t /c`
5. Verificação automática (item 3.1.7) e parada em caso de REPROVADO.

Para `C:\rally\app`: passo 1 com Administradores e SYSTEM `(OI)(CI)F`, o SID do
operador `(OI)(CI)M` e RallyDev `(OI)(CI)RX`; depois passos 2 a 5.
Para dev/test no perfil de RallyDev: RallyDev `(OI)(CI)M` e Administradores e
SYSTEM `(OI)(CI)F`; depois passos 2 a 5.

Marque como VALIDADOS na máquina só os comandos dos passos 1, 2 e 4 com a sintaxe
acima; tudo o mais é A VERIFICAR. Não use `/t` nos passos 1 e 2.

## 5. Documentos

- `docs\PLANO_DE_TESTES.md`: T11 vira a verificação automática do `02 -Verificar`.
- `docs\SEGURANCA.md`: remoção do `/reset`; justificativa da sequência; limite do
  backup/restore (dono); risco de conceder ao operador errado.
- `docs\DECISOES_PENDENTES.md`: onde guardar backups dos alvos protegidos
  (item 3.1.8); política para o pai `C:\rally`, que continua herdando
  "Usuários autenticados: modificar" (o `02` não o altera).

## 6. Formato da entrega (na conversa)

1. Preflight: resultado.
2. Arquivos alterados e o que mudou.
3. Para cada item de 3.1 e 3.2: corrigido? arquivo:linha?
4. Lista final dos comandos icacls usados, marcando VALIDADO ou A VERIFICAR.
5. Pontos A VERIFICAR na máquina real.
6. Limitações: nada foi executado nem testado.
7. Próxima etapa proposta e autorização necessária.

Separe fatos, inferências e perguntas em aberto. Pare após a entrega.

## FIM DA TAREFA

Se você não está vendo esta linha ao final do arquivo, o texto foi cortado:
pare e avise, sem prosseguir.