# Plano de testes de permissões

Esta matriz descreve o que `scripts/windows/03-testar-acls.ps1` propõe verificar. Nenhum teste foi executado nesta fase. Use somente arquivos sintéticos, nunca bancos reais. Os resultados esperados dependem da ACL efetiva do Windows.

## T1–T14

| ID | Verificação | Resultado/limite |
|---|---|---|
| T1 | SID da identidade atual e grupo Administradores do token | APROVADO se usuário for RallyDev e token não tiver Administradores; requisito para os demais |
| T2 | Ler `fixture.txt` em decoys | Acesso negado esperado |
| T3 | Acrescentar texto sintético à fixture | Acesso negado esperado |
| T4 | Renomear fixture | Acesso negado esperado |
| T5 | Excluir `fixture-delete-probe.txt`, isca sintética auxiliar | Acesso negado esperado; `fixture.txt` original nunca é excluída. Se a exclusão for permitida, REPROVADO e o responsável deve recriar a isca auxiliar |
| T6 | Criar arquivos sintéticos com nomes de WAL, SHM e journal em decoys | Acesso negado esperado |
| T7 | Criar arquivo sintético na pasta de código | Acesso negado esperado |
| T8 | Criar arquivo em `dev` | Permitido; só executado se o diretório existir |
| T9 | Criar, renomear e excluir auxiliares em `dev`/`test` | Permitido; positivos dependem de RallyDev e dos diretórios existentes |
| T10 | Criar hardlink da fixture protegida a partir de `dev` | A criação deve falhar; depende de RallyDev e de `dev` existir |
| T11a | `02 -Verificar`, elevado: imprimir ACLs recursivas de cofre, backend, decoys, canary e app; afirmar dono Administradores, herança desativada, SIDs e direitos exatos por alvo, e ausência de Usuários autenticados, Usuários e Todos em locais protegidos | APROVADO/REPROVADO automaticamente por alvo; T11 passa somente se todos os alvos existentes forem APROVADOS; leitura de metadados, sem abrir arquivos |
| T11b | `03`, como RallyDev: tentar ler ACL de cofre, backend e canary | Acesso negado é APROVADO; se ACL puder ser lida, REPROVADO |
| T12 | Criar arquivo sintético no cofre e canary | Acesso negado esperado |
| T13 | Gate G4 sem bloqueio da sentinela | **Não implementado nesta fase**; pertence à fase do gate G1–G8 |
| T14 | Gate com conta pessoal | **Não implementado nesta fase**; pertence à fase do gate G1–G8 |

T1, T8, T9 e T10 dependem de RallyDev existir; T8–T10 também dependem de seus diretórios. O script 02 cria `fixture.txt` e `fixture-delete-probe.txt` com conteúdo sintético antes de fechar decoys, se ausentes. `02 -Verificar` exige elevação e só consulta ACLs; sem RallyDev, informa que as verificações específicas foram omitidas. `03` tenta ler ACL sob RallyDev e espera acesso negado. `03-testar-acls.ps1` simula por padrão; com `-Aplicar`, imprime APROVADO/REPROVADO por teste e código de saída; falha global resulta em código 1.

T2–T6 e T12 testam negação total nas iscas, cofre e sentinela, conforme a política allow-list. T5 usa a isca auxiliar para não remover `fixture.txt`. Os scripts nunca abrem bancos. Os testes positivos em desenvolvimento só rodam quando o caminho existir.

## Fora desta fase

T13 e T14 dependem da implementação e testes do gate G1–G8 no código. Testes funcionais de negócio e API também não são executados nesta fase. Continuam como plano futuro: autenticação/autorização, duas tribos por Rally novo e legado, estados/aprovação de pontuação, auditoria sem cascata, validação de migrations, CORS e erros sem vazamento, entradas SQL, privacidade de menores e ranking.
