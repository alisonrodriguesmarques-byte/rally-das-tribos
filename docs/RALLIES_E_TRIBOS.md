# Rallys, duas tribos e histórico — etapa 3

Novos Rallys usam exatamente duas tribos distintas, escolhidas entre as doze identidades do catálogo oficial. A seleção das equipes é independente das pessoas que integram cada uma.

## Fluxo na interface

Com uma conta administrativa aprovada, abra **Rallys**, informe nome, descrição e datas e selecione duas tribos. O sistema recusa seleção vazia, repetida, desconhecida ou com quantidade diferente de duas.

Durante o planejamento, a seleção pode ser revisada. Uma tribo que já tenha qualquer vínculo de integrante, resultado ou histórico não pode ser removida pela troca de seleção. A operação mantém os IDs das participações que continuam e grava a troca inteira em uma transação, sem deixar uma edição com seleção parcial.

Ao iniciar, as duas identidades participantes ficam fixas. A edição pode depois ser encerrada e arquivada; uma edição em planejamento pode ser cancelada. A interface apresenta apenas as ações permitidas para cada estado. Edições finalizadas ficam para consulta.

## As pessoas podem mudar durante o Rally

| Elemento | Regra durante uma edição ativa |
|---|---|
| Duas tribos escolhidas | Não podem ser substituídas por outras identidades do catálogo. |
| Entrada de integrante | Permitida, criando um vínculo com a equipe. |
| Saída de integrante | Permitida, encerrando o vínculo e registrando sua saída. |
| Transferência entre equipes | Encerra o vínculo anterior e cria outro na equipe de destino, na mesma transação. |
| Substituição de cabeça/auxiliar ou mudança de papel | Deve preservar o período anterior e criar o novo vínculo correspondente. |
| Vínculo encerrado | Continua no histórico; não é apagado, reativado ou transferido em seu próprio registro. Um retorno abre outro período. |

A base permite movimentações de integrantes nos estados **planejamento** e **ativo**, sem permitir participação ativa simultânea em duas tribos da mesma edição. Não há bloqueio de pessoas apenas porque a edição foi iniciada. As mudanças de pessoas em edições encerradas, arquivadas, canceladas ou legadas não são permitidas por este fluxo.

**A interface/API de cadastro e movimentação de integrantes será entregue no módulo de equipes.** Os testes desta etapa verificam as regras de persistência usando somente participantes sintéticos; não há um botão de transferência fictício nem liberação de permissão por perfil ainda não definida.

## Preservação das edições anteriores

A migração 010 classifica os Rallys que já existiam como `legado=1`. Eles ficam disponíveis para consulta com a quantidade original de tribos, inclusive doze. Não são convertidos para duas tribos nem incorporados a uma nova competição.

São preservados os IDs, nomes, cores, status, datas de criação/atualização, membros, pontuações e seus históricos. O mapeamento para o catálogo ocorre somente quando há correspondência exata de nome. Nomes históricos desconhecidos permanecem como estão, com `catalogo_id` nulo; não são normalizados ou apagados.

Legados não recebem novas alterações de seleção, integrantes, atividades ou pontuações por este fluxo. O marcador de legado não pode ser enviado pelo cliente para criar uma exceção às regras novas, nem alterado em uma edição existente. Não há importação ou abertura de bancos originais/de referência neste procedimento.

## Contrato técnico

- `tribos_catalogo.id` identifica a tribo oficial global; são doze registros fixos.
- `tribos.id` continua identificando a participação de uma tribo em uma edição. Esse ID é referenciado por integrantes e resultados e não se confunde com o ID do catálogo.
- `tribos.catalogo_id` relaciona a participação à identidade global. A mesma tribo oficial pode participar de várias edições, com vínculos e pontos separados.
- `rallies.legado` distingue as edições anteriores. Novos Rallys usam `0`; somente a migração marca os já existentes como `1`.

| Método e rota | Uso |
|---|---|
| GET `/api/tribos/catalogo` | Retorna `{success: true, data: [{id, nome, cor}]}`. |
| POST `/api/rallies` | Exige `{nome, descricao, data_inicio, data_fim, tribos_ids: [id1, id2]}`. |
| PUT `/api/rallies/:id/tribos` | Recebe `{tribos_ids: [id1, id2]}` para revisão no planejamento. |
| GET `/api/rallies` e `/api/rallies/:id` | Incluem `legado` e `tribos: [{id, catalogo_id, nome, cor}]`. |
| PATCH `/api/rallies/:id/start` | Confirma a seleção e inicia a edição. |

As ações de encerrar, arquivar e cancelar mantêm os endpoints existentes. Todas as rotas de gestão exigem administrador e as mutações exigem CSRF. A criação/exclusão isolada de uma tribo ou alteração direta de sua identidade retorna 409; a escolha é feita no contexto do Rally. Descrição/cor da participação podem ser ajustadas enquanto a edição nova estiver em planejamento ou ativa, sem trocar a identidade oficial.

## Atualização e testes

Com as variáveis de banco sintético da documentação de desenvolvimento configuradas:

```bash
npm run init-db
npm test
# Opcional, com Playwright/Chromium disponíveis:
npm run test:ui
```

O inicializador aplica a migração 010 e verifica as dez migrações ao todo. Não recrie o banco nem apague o ledger para atualizar. Os arquivos SQL 001 a 009 permanecem inalterados.

A suíte funcional inclui cinco grupos: repositórios, API, revisão, autenticação e tribos. A suíte de tribos constrói uma fixture própria no schema 009, insere doze tribos e dados históricos, aplica a migração 010 e compara os registros antigos. Também testa seleção inválida sem resíduos, troca atômica, concorrência entre início/troca, CSRF, proteção de IDs e movimentações de integrantes em edição ativa com preservação do vínculo anterior.

O teste de navegador verifica criação, revisão da seleção, início, encerramento/arquivamento e consulta de uma edição histórica com doze tribos em computador e celular. O fluxo continua restrito ao ambiente Linux com dados sintéticos; não representa liberação para produção.
