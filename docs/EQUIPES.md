# Gestão de equipes — etapa 4

A navegação **Equipes** permite escolher uma edição e consultar suas tribos, integrantes e períodos anteriores. As operações são restritas ao administrador aprovado, com sessão e CSRF. O ambiente continua exclusivamente sintético em Linux.

## Pessoas e vínculos

Busque a pessoa antes de cadastrar. O cadastro global contém somente nome e apelido opcional; a mesma pessoa pode ser reutilizada por ID em várias edições. Homônimos não são fundidos automaticamente. Não há criação automática de conta de acesso, coleta de contato, foto ou nascimento.

Para vincular, escolha pessoa, tribo, papel, data de entrada e motivo. Cada tribo admite no máximo um cabeça e um auxiliar ativos; as vagas podem ficar abertas. Os demais integrantes usam o papel participante. A composição pode mudar em planejamento ou durante Rally ativo.

Saída encerra o período atual. Transferência e mudança de papel encerram o vínculo anterior e criam outro na mesma transação. Nunca apagam ou reativam o período encerrado. A substituição de liderança exige liberar a função anterior; outra pessoa não é removida automaticamente. Não é permitido manter dois vínculos ativos na mesma edição, sobrepor períodos ou usar um vínculo/tribo de outra edição. A data de saída pode coincidir com a entrada seguinte. As ações são aplicadas imediatamente; não há agendamento automático por data.

Edições legadas ou finalizadas são somente consulta. Correções do nome/apelido global exigem motivo e são recusadas quando alterariam a apresentação de pessoas vinculadas a essas edições. Os eventos administrativos registram ator, IDs, motivo e datas em auditoria append-only, sem copiar nomes, senhas ou tokens.

## API

- GET/POST `/api/participantes`: busca e cadastro mínimo; busca aceita `q` e `limit` até 100.
- PUT `/api/participantes/:id`: correção com motivo.
- GET `/api/equipes/:rallyId`: edição, equipes com vínculos ativos e histórico completo.
- POST `/api/equipes/:rallyId/membros`: entrada com `tribo_id`, `participante_id`, `papel`, `data_entrada`, `motivo`.
- POST `/api/equipes/:rallyId/membros/:id/saida`: `data_saida`, `motivo`.
- POST `/api/equipes/:rallyId/membros/:id/transferencia`: `tribo_destino_id`, `papel`, `data`, `motivo`.
- POST `/api/equipes/:rallyId/membros/:id/papel`: `papel`, `data`, `motivo`.

IDs nos corpos JSON são números inteiros positivos. Datas usam AAAA-MM-DD e devem existir no calendário. Campos não previstos são recusados.

## Atualização e validação

Com as variáveis do banco sintético configuradas, execute `npm run init-db` para aplicar a migração 011, sem recriar bancos nem alterar as migrações anteriores.

Execute `npm test` para persistência, bootstrap e seis suítes funcionais, incluindo equipes. O teste opcional `npm run test:teams:ui` requer Playwright/Chromium e valida o fluxo real em computador/celular, com fixtures próprias e limpeza dos processos/diretórios criados.
