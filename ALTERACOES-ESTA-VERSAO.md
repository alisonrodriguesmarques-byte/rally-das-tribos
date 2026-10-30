# Alterações desta versão

## Transições de status dos rallies

- `planejamento -> ativo`: continua disponível somente pela ação explícita `PATCH /api/rallies/:id/start` e pelas validações já existentes.
- `ativo -> encerrado`: agora só é permitido para rallies ativos, via `PATCH /api/rallies/:id/encerrar`.
- `encerrado -> arquivado`: agora só é permitido para rallies encerrados, via `PATCH /api/rallies/:id/arquivar`.
- `planejamento -> cancelado`: ação explícita adicionada em `PATCH /api/rallies/:id/cancelar`.
- Rallies arquivados ou cancelados não podem ser reativados por essas operações.
- A atualização geral continua sem permissão para modificar `status`.
- As transições são protegidas no repositório com transação e `UPDATE ... WHERE status = ?`, além da validação no controller.

## Testes

- `node --check` passou nos controllers, repositório, rotas e teste de API alterados.
- As migrations 006 e 007 foram aplicadas a uma cópia descartável com Python SQLite; `integrity_check` retornou `ok` e `foreign_key_check` não encontrou violações.
- Cenários SQL de transição válida/inválida passaram em transação revertida.
- Não foi possível executar os testes Node de integração neste ambiente porque o ZIP original contém um binário nativo de `sqlite3` para Windows, incompatível com Linux. A tentativa de reconstruí-lo exigia baixar cabeçalhos do Node, indisponíveis neste ambiente. Execute `npm run test:repos` e `npm run test:api` no Windows com a configuração de banco descartável descrita em `backend/database/test-support.js` antes de usar em produção.

## Banco de dados e dependências

Este pacote de código **não inclui** `node_modules`, `.git` ou `data/rally-das-tribos.db`, para não substituir seu repositório local nem seu banco de dados. Extraia os arquivos por cima da pasta do projeto existente, mantendo o banco local.
