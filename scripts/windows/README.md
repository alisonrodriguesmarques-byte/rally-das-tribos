# Propostas de scripts Windows — Fase 2d

Os scripts são propostas. Nada foi executado nesta fase. Nunca abrem bancos SQLite. `C:\rally-audit` herda modificação para Usuários autenticados, portanto contas comuns podem substituir estes arquivos.

## Onde revisar, copiar e executar

Não execute scripts elevados diretamente de `C:\rally-audit`. Primeiro revise `01`, `02` e `99`; depois o responsável copia esses três arquivos para uma pasta protegida, por exemplo `C:\RallyCofre\scripts`, e compara o SHA-256 de cada cópia com o original. Esse hash é apenas dos arquivos `.ps1`, nunca de bancos. O diretório do cofre herda a ACL restrita a Administradores e SYSTEM; confirme essa permissão na máquina.

Exemplo de cópia e conferência, executado pelo responsável em PowerShell elevado:

```powershell
New-Item -ItemType Directory -Path 'C:\RallyCofre\scripts' -Force
$ScriptsRevisados = @('01-criar-identidade.ps1', '02-aplicar-acls.ps1', '99-reverter.ps1')
foreach ($NomeScript in $ScriptsRevisados) {
    $Original = Join-Path 'C:\rally-audit\rally-das-tribos\scripts\windows' $NomeScript
    $Copia = Join-Path 'C:\RallyCofre\scripts' $NomeScript
    Copy-Item -LiteralPath $Original -Destination $Copia
    $HashOriginal = (Get-FileHash -LiteralPath $Original -Algorithm SHA256).Hash
    $HashCopia = (Get-FileHash -LiteralPath $Copia -Algorithm SHA256).Hash
    if ($HashOriginal -ne $HashCopia) { throw "Hash diferente para $NomeScript; não execute." }
}
```

O script `03` precisa ser legível/executável e não gravável por RallyDev. Local candidato: `C:\rally\app\scripts\windows\03-testar-acls.ps1`; confirmar a ACL efetiva antes de usar. Copie-o para lá depois da revisão. A execução de 03 é como RallyDev sem elevação.

## Ordem e comandos de execução

Sequência: **01 → primeiro logon de RallyDev → 02 simulação → cópia de 03 para `app` → 02 aplicação → 02 verificação → 03**. O primeiro logon carrega o perfil, necessário para os diretórios `dev` e `test`; a cópia de 03 deve estar em `app` antes da ACL ser aplicada para que a árvore seja verificada junto.

Use `-ExecutionPolicy Bypass` somente no processo `powershell.exe`; não altere a política da máquina. Execute `01`, `02` e `99` a partir da cópia protegida:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RallyCofre\scripts\01-criar-identidade.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RallyCofre\scripts\01-criar-identidade.ps1" -Aplicar
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RallyCofre\scripts\02-aplicar-acls.ps1"
New-Item -ItemType Directory -Path 'C:\rally\app\scripts\windows' -Force
Copy-Item -LiteralPath 'C:\rally-audit\rally-das-tribos\scripts\windows\03-testar-acls.ps1' -Destination 'C:\rally\app\scripts\windows\03-testar-acls.ps1'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RallyCofre\scripts\02-aplicar-acls.ps1" -Aplicar -ConfirmarOperador
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RallyCofre\scripts\02-aplicar-acls.ps1" -Verificar
runas /user:RallyDev "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\rally\app\scripts\windows\03-testar-acls.ps1 -Aplicar"
```

`-Verificar` é leitura de metadados ACL, imprime SDDL e compara proprietário, herança, SIDs e direitos na árvore; não altera nada e exige elevação. Rode também após copiar 03 para incluir esse arquivo na verificação. Simulação e `-Verificar` podem prosseguir sem RallyDev e informam as verificações específicas omitidas; `-Aplicar` exige a conta. `-Aplicar` também exige `-ConfirmarOperador`: confira o nome e o SID do operador que serão impressos, pois esse SID recebe Modificar em `app`. `-ReaplicarProtegidos` é excepcional; se necessária, substitua o comando de aplicação acima por `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RallyCofre\scripts\02-aplicar-acls.ps1" -Aplicar -ConfirmarOperador -ReaplicarProtegidos`, depois revise o backup individual antes de prosseguir. Para reverter alvos comuns, use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RallyCofre\scripts\99-reverter.ps1" -Identificador ID_DO_BACKUP -Aplicar`. Para cofre/backend, acrescente `-ConfirmarReversao` somente após revisar o backup e decidir restaurá-lo.

Para rodar 03, digite a senha somente no prompt do `runas`; nunca a inclua no comando. O script pausa com `Read-Host` antes de sair e então devolve o código de saída dos testes:

```powershell
runas /user:RallyDev "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\rally\app\scripts\windows\03-testar-acls.ps1 -Aplicar"
```

## Pré-requisitos e riscos

- RallyDev deve existir. Faça o primeiro logon interativo antes de preparar `dev`/`test`.
- O script 02 cria `C:\rally\decoys\fixture.txt` e `fixture-delete-probe.txt` com conteúdo sintético, se ausentes, antes de aplicar a ACL de decoys. T5 tenta excluir somente a isca auxiliar; a `fixture.txt` original nunca é excluída.
- O script 02 não altera `C:\rally`. No modo de aplicação normal, lê e preserva a ACL do diretório raiz de cofre/backend; só os altera com `-ReaplicarProtegidos`. `-Verificar` inspeciona recursivamente todos os alvos.
- Nenhum alvo usa `/reset`: a ACL padrão herdada pode reabrir modificação a Usuários autenticados. A aplicação concede primeiro as regras, remove a herança sem `/t`, remove grupos amplos e define o proprietário recursivamente; só os passos 1, 2 e 4 têm validação prévia relatada para essa forma exata. `/remove:g` com SIDs e a verificação automática são **A VERIFICAR**.
- `decoys` e `canary` são criados antes do backup e herdam a ACL aberta existente; o backup desses dois alvos pode, portanto, registrar estado aberto. A reversão desse estado é esperada e não deve ser usada para desproteger cofre/backend.
- Backups protegidos ficam em `C:\RallyCofre\acl-backups`. Para cofre e backend, `/save` não usa `/t`, evitando incluir a própria pasta de backup; isso salva somente ACL da raiz, não DACLs recursivas, e continua **A VERIFICAR**. `icacls /save` provavelmente não salva proprietário; se confirmado, a reversão do dono será manual. Revise o backup individual antes de prosseguir.
- A conta RallyDev deve ler/editar nenhum dos scripts privilegiados. Não rode Codex elevado nem cole comandos dele em terminal elevado.
