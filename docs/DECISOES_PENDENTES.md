# Decisões pendentes do responsável

Recomendações não autorizam executar scripts, alterar ACL, abrir SQLite ou mudar código de runtime.

| Tema | Estado/opções | Recomendação |
|---|---|---|
| Origem de `C:\rally\backend` e destino | Protótipo antigo relatado; origem ainda não confirmada. Manter fechado, arquivar ou remover após inventário manual do responsável | Confirmar origem e decidir o que fazer sem leitura pelo Codex |
| Dois bancos originais (OneDrive e Temp) | Ainda alcançáveis pela conta do responsável; `IsReadOnly` não confirmado | Mover manualmente para o cofre; confirmar `IsReadOnly` após o movimento |
| Política para `C:\rally` | Pai herdava permissões amplas; scripts não o alteram nesta fase | Decidir política do pai sem abrir acesso ao backend/cofre |
| Política para `C:\rally-audit` | Também herdava permissões amplas conforme relato | Definir controle de acesso e auditoria; fora do escopo de aplicação atual |
| Permanência de `C:\rally-audit` permissiva | Contas comuns podem alterar scripts que seriam executados elevados dali | Não executar scripts privilegiados da árvore; decidir se a ACL do workspace será alterada em fase autorizada |
| Cópia legível do script 03 | RallyDev precisa ler/executar 03 sem poder alterá-lo; `C:\rally\app\scripts\windows` é candidato | Confirmar uma pasta com ACL efetiva RX para RallyDev antes de usar |
| Diretórios `dev` e `test` | Proposta em `%LOCALAPPDATA%\RallyDasTribos\dev` e `test` no perfil RallyDev; ainda não criados | Confirmar como localização definitiva e garantir que não sincronizem pelo OneDrive |
| Backup ACL manual anterior | `%USERPROFILE%\rally-acl-backup` (`cofre.acl`, `backend.acl`) relatado | Definir retenção e uso; não sobrescrever |
| Reaplicação de ACL em cofre/backend | Já fechados manualmente segundo evidência | Só autorizar execução futura de `-ReaplicarProtegidos` com motivo e backup revisado |
| Backup recursivo dos alvos protegidos | `C:\RallyCofre\acl-backups` fica dentro do alvo cofre; o 02 usa `/save` sem `/t` para cofre/backend para não incluir a pasta em andamento, salvando apenas a ACL da raiz | Decidir se os backups completos devem ir para outro local protegido; validar ACL, escopo de `/save` e reversão na máquina. `/save` provavelmente não guarda proprietário (**A VERIFICAR**) |
| ACL do pai `C:\rally` | Continua herdando `Usuários autenticados: modificar`; o 02 não altera o pai | Decidir a política do pai em fase autorizada, preservando o isolamento de cofre/backend |
| Gate G1–G8 e SQLite | Não implementados nesta fase | Aprovar fase separada após evidências T1–T12 |
| Codex elevado | Elevação elimina a barreira de ACL contra o próprio processo | Nunca rodar Codex nem colar comandos em terminal elevado |

Decisões de negócio e arquitetura da Fase 2 continuam sujeitas às aprovações já registradas em `docs/TAREFA-FASE2.md` e não são reabertas aqui.
