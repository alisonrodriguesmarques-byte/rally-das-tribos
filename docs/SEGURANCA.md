# Segurança e isolamento operacional

**Status:** proposta de configuração; a aplicação manual de ACL relatada abaixo não foi executada nem verificada nesta sessão. SQLite continua bloqueado até autorização específica e evidências do gate.

## Evidências coletadas

Os itens abaixo são fatos relatados pelo responsável, coletados na máquina real em PowerShell elevado e comum:

- `icacls C:\` mostrou herança de `Usuários autenticados` com modificação `(OI)(CI)(IO)(M)` e de `Usuários` com leitura `(RX)`. `C:\rally`, `C:\RallyCofre` e `C:\rally-audit` herdavam essas permissões. O achado 9 está **CONFIRMADO**.
- O responsável aplicou manualmente em `C:\RallyCofre` e `C:\rally\backend`, nesta ordem: `/grant:r` para Administradores e SYSTEM com `(OI)(CI)F`, `/inheritance:r` e `/setowner` para Administradores recursivamente. Foram relatados 5 itens no cofre e 949 no backend, sem falhas. Dono final relatado: BUILTIN\Administradores; somente Administradores e SYSTEM ficaram autorizados. Terminal sem elevação recebeu acesso negado. O responsável tentou reabrir acesso sem elevação e foi negado.
- Backups das ACLs antigas foram relatados em `%USERPROFILE%\rally-acl-backup` (`cofre.acl`, `backend.acl`). Os comandos com SIDs desta aplicação manual são **VALIDADOS pelo responsável**; qualquer outra sintaxe/comando `icacls` continua **A VERIFICAR**.
- Windows está em português. Scripts usam SIDs: Administradores `S-1-5-32-544`, SYSTEM `S-1-5-18`, Usuários `S-1-5-32-545`, Usuários autenticados `S-1-5-11`; a conta atual é resolvida pelo SID do token.
- Alison pertence a Administradores, mas o grupo fica desativado no token sem elevação. Assim, para processos sem elevação, incluindo Codex, cofre e backend estão fechados.
- `C:\rally\backend` parece protótipo antigo com `rally.db`, `src\` e `node_modules` que incluem bcryptjs e jsonwebtoken. A origem e a decisão de destino ainda dependem do responsável. Nenhum acesso a esse local foi feito nesta fase.
- Os originais em OneDrive e Temp continuam alcançáveis pela conta do responsável. `attrib +R` foi instruído, mas `IsReadOnly = True` ainda está pendente; atributo somente leitura não equivale a isolamento por ACL.
- A proteção descrita vale contra processos sem elevação. Se o responsável executar Codex elevado ou aprovar comandos do Codex em terminal elevado, a barreira deixa de existir. **Nunca execute o Codex elevado nem cole comandos dele em terminal elevado.**
- A herança de `C:\rally-audit` concede modificação a Usuários autenticados; contas comuns, incluindo RallyDev, podem substituir os scripts e documentos nessa árvore. Nunca execute scripts privilegiados diretamente dali. O responsável deve revisar e copiar `01`, `02` e `99` para `C:\RallyCofre\scripts`, conferir SHA-256 dos arquivos de script contra os originais e executar somente as cópias protegidas. Esse hash não é de banco.

## Locais e política pretendida

| Local | Estado ou política | Observação |
|---|---|---|
| `C:\RallyCofre` | **JÁ FECHADO**, conforme relato | ACL aplicada manualmente; scripts só verificam por padrão |
| `C:\rally\backend` | **JÁ FECHADO**, conforme relato | Contém protótipo e banco desconhecido; origem/destino pendentes |
| `C:\Users\Alison\OneDrive\Desktop\rally-das-tribos\data\rally-das-tribos.db` | Ainda alcançável pela conta do responsável | Recomenda-se mover manualmente para o cofre; confirmar `IsReadOnly` |
| `C:\Users\Alison\AppData\Local\Temp\rally-das-tribos-audit\rally-das-tribos-test.db` | Ainda alcançável pela conta do responsável | Recomenda-se mover manualmente para o cofre; confirmar `IsReadOnly` |
| `C:\rally\decoys` | Administradores e SYSTEM apenas | Iscas sintéticas; RallyDev sem acesso |
| `C:\rally\canary` | Administradores e SYSTEM apenas | Sentinela para futuro G4; RallyDev sem acesso |
| `C:\rally\app` | Administradores/SYSTEM controle total; conta atual modificar; RallyDev somente `(OI)(CI)RX` | Sem escrita para RallyDev |
| `%LOCALAPPDATA%\RallyDasTribos\dev` e `test` no perfil RallyDev | RallyDev modificar; Administradores/SYSTEM controle total | Só criar ACL se o perfil existir |
| `C:\rally` e `C:\rally-audit` | Política não decidida | Não alterar o pai `C:\rally` nesta fase |

## Proposta de scripts ACL

`02-aplicar-acls.ps1` simula sem consultar ACLs por padrão; simulação e `-Verificar` aceitam RallyDev ausente e informam verificações específicas omitidas, enquanto `-Aplicar` exige a conta. `-SomenteAlvo` limita simulação, verificação ou aplicação a um único alvo entre `decoys`, `canary`, `app`, `dev` e `test`; `dev` e `test` exigem o perfil RallyDev. Em `Testar-ArvoreAcl`, somente a raiz exige herança protegida e imprime SDDL; filhos validam o conjunto de SIDs/direitos esperados e a ausência de SIDs proibidos, com `Synchronize` normalizado, e mostram falhas e totais. `-Verificar`, elevado, compara recursivamente as ACLs sem abrir arquivos. Só `-Aplicar -ReaplicarProtegidos` permite reaplicar ACL em cofre/backend. Antes de fechar decoys, 02 cria `fixture.txt` e `fixture-delete-probe.txt` sintéticas se ausentes. A aplicação imprime nome e SID do operador e exige `-ConfirmarOperador` antes de conceder Modificar em app. Não usa `/reset`: em todos os alvos concede as regras, remove herança sem `/t`, remove grupos amplos e define dono Administradores recursivamente; depois verifica cada árvore e interrompe se reprovar. A reversão de backups de decoys/canary devolve o estado aberto anterior à aplicação. Os passos 1, 2 e 4 usam formas relatadas como validadas na máquina; `/remove:g` com SIDs e as demais verificações são **A VERIFICAR**. O pai `C:\rally` não é modificado.

Backups individuais ficam em `C:\RallyCofre\acl-backups`. Para cofre e backend, `/save` é sem `/t` para não incluir a pasta de backup dentro da varredura; isso limita o backup à ACL da raiz e está **A VERIFICAR**. A reversão com `/restore` provavelmente não recupera proprietário porque `/save` possivelmente guarda apenas DACL; confirme na máquina e, se confirmado, restaure o proprietário manualmente. Os diretórios decoys/canary são criados antes dos backups e podem registrar a ACL aberta herdada; essa reversão é esperada e não deve servir para desproteger cofre/backend. O `99` permanece em simulação por padrão; restauração aplicada de cofre/backend exige `-ConfirmarReversao`.

`03-testar-acls.ps1` tenta ler ACL de cofre/backend/canary como RallyDev; acesso negado é o resultado esperado. A inspeção positiva e comparação das ACLs reais pertence a `02 -Verificar` elevado. Para o teste de exclusão, 02 prepara `fixture-delete-probe.txt`; 03 nunca exclui `fixture.txt` original e informa que a isca auxiliar deve ser recriada se a exclusão for permitida. A localização candidata para cópia de 03 é `C:\rally\app\scripts\windows`, com RallyDev somente RX; caminho e ACL efetiva ainda são **A VERIFICAR**.

Use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...` para cada cópia revisada; `-ExecutionPolicy Bypass` vale somente para aquele processo. Não altere a política de execução da máquina.

O script consulta a existência de RallyDev antes de aplicar, só cria os diretórios dev/test se encontrar o perfil, não abre bancos e usa allow-list. A ordem exata de backup e os comandos ainda precisam de revisão na máquina real. `99-reverter.ps1` usa `/restore` com o diretório pai do alvo salvo; esse comportamento está **A VERIFICAR**. Reversão requer PowerShell elevado.

## Decisão D4: isolamento do Codex

D4 está **PARCIALMENTE IMPLEMENTADA**: cofre e backend foram fechados manualmente; os dois originais não foram isolados e continuam acessíveis pela conta do responsável. A conta RallyDev não isola Codex executado sob Alison. A recomendação é mover manualmente os originais para o cofre e avaliar identidade sem acesso ao cofre para Codex, sem afirmar que essa configuração está disponível ou ativa.

## Gates e limites

G1–G8 permanecem proposta para fase de código: identidade, token sem privilégios, caminho dev pré-existente, sentinela, modo, migrations permitidas, abertura SQLite e logs sem segredos. Nenhum gate foi implementado nesta fase. Não liberar SQLite antes de RallyDev, ACLs e T1–T12 aprovados, G1–G8 revisados, banco sintético explícito e autorização da fase seguinte.

Os testes usam somente iscas sintéticas. T13 e T14 pertencem à futura fase do gate de código e não são implementados pelos scripts desta fase. A ACL protege o processo RallyDev sem elevação; administradores e processos sob a conta pessoal não são contidos. Iscas não provam identidade física do arquivo SQLite.
