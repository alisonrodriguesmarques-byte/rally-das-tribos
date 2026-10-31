# Pontuação imediata e ranking — etapa 5

Os lançamentos do administrador entram diretamente no ranking, sem aprovação adicional. Em **Pontos e ranking**, escolha uma edição, a tribo e informe pontos inteiros positivos e justificativa. São aceitos de 1 a 1.000.000 pontos por lançamento administrativo. O formulário recebe apenas origem manual; [missões e provas](ATIVIDADES.md) usam integrações próprias e somam seus resultados no mesmo ranking.

Somente administradores ativos e aprovados podem consultar ou lançar pontos. Novos lançamentos e correções exigem edição nova **ativa**, tribo dessa edição, sessão e CSRF. Planejamento, edições finalizadas e legadas permanecem somente para consulta nessa tela. O ranking é separado por edição, inclui tribos sem pontos e trata empates com a mesma posição.

## Correção sem apagar o passado

Abra **Corrigir lançamento**, informe o valor correto e o motivo. O original fica intacto. O sistema registra o valor inverso para compensá-lo e um novo lançamento com o valor correto, ligados ao anterior. Exemplo: corrigir 100 para 40 gera `100 - 100 + 40 = 40`. Informar zero faz somente o estorno.

A compensação, eventual substituição, histórico e registro da operação compartilham uma transação. Falha de auditoria reverte tudo. Cada lançamento só pode ser compensado uma vez; correções posteriores usam o lançamento substituto. Não há edição ou exclusão de pontuações pelo fluxo. Histórico mostra valor, responsável, data, justificativa e referências da correção. Alterações dos integrantes não transferem pontuações já registradas entre tribos.

## Tentativas repetidas

Cada operação envia uma `request_key` aleatória. Repetir a mesma chave e dados retorna o resultado existente, sem somar novamente. Reutilizar a chave com dados diferentes retorna 409. A tela mantém a chave da tentativa enquanto os dados não mudam e o envio não é confirmado.

Lançamentos independentes podem ter o mesmo valor/descrição: isso não prova duplicidade. A chave protege a repetição da mesma operação. Missões e provas têm controle adicional de unicidade por resultado de origem. Não há lançamento em lote nesta entrega.

## API e atualização

- GET `/api/pontuacoes/:rallyId`: edição, ranking e histórico.
- POST `/api/pontuacoes/:rallyId`: `{tribo_id, pontos, justificativa, request_key}`.
- POST `/api/pontuacoes/:rallyId/:id/corrigir`: `{pontos, justificativa, request_key}`; pontos pode ser zero.

Mutações exigem `X-CSRF-Token`. Não é possível escolher aprovador, autor ou simular origem de quiz pelo corpo da requisição. O servidor determina o administrador responsável.

Com as variáveis do banco sintético configuradas, `npm run init-db` aplica a migração 012. Ela acrescenta referências de correção e controle de repetição, sem alterar os valores antigos. As migrações anteriores permanecem intactas. O fluxo segue restrito ao desenvolvimento sintético em Linux.

## Testes

`npm test` inclui oito suítes funcionais, além de persistência e bootstrap. A suíte de pontos verifica acesso/CSRF, efeito imediato, tentativas concorrentes com a mesma chave, conflitos, validações, rollback após falha de auditoria, correção, estorno, imutabilidade e resultados encerrados. A suíte de atividades verifica premiações de missões/provas sem duplicidade.

`npm run test:scores:ui` é opcional com Playwright/Chromium e verifica lançamento, correção, layout no celular e limpeza após logout em navegador real, usando apenas fixtures descartáveis.
