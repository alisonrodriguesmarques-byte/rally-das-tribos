# Evidência da preparação local

Verificação concluída em **31/10/2026, 17:41 UTC**, em Linux, Node.js 24.19.0 e npm 11.9.0, após `npm ci --no-audit --no-fund`.

`npm run test:release` terminou com código zero. Passaram auditoria de execução, persistência, bootstrap, backup/restauração, HTTPS, oito suítes funcionais e cinco suítes de navegador. A responsividade foi verificada em 320, 390, 768 e 1440 pixels, incluindo falha de rede e resposta atrasada. A auditoria reportou zero vulnerabilidades conhecidas nesta execução.

Relatório local: `artifacts/release-9702c12b-813a-4997-8dfe-325d45dc4dc3/report.json`. Os logs ficam ao lado. Esses artefatos não são versionados; cada nova execução produz seu próprio diretório e resultado.

## Ensaio do banco retido

Foi criado e restaurado um backup da instância sintética existente, sem alterar a configuração da aplicação nem os bytes do banco original:

- Pacote privado: `/workspace/.rally-backups/preparacao-20261031T173834383Z-429ebe0f`.
- Instância restaurada: `/workspace/.rally-restore-drill-a281386e-4791-483c-82a8-691145b0db9d`.
- SHA-256 do snapshot: `e1072d0c6a54542740964700474e884c920321eb1a6071577ed0ea9af9d82b8e`.
- Integridade/schema/migrações conferidos, contagens iguais em 14 tabelas verificadas, nova identidade e revogação das sessões na cópia restaurada.

Os testes HTTPS usaram CA/certificados temporários com validação habilitada. Não foi emitido certificado público, instalado serviço ou publicado domínio. O workflow de CI foi preparado, mas sua execução remota depende do envio ao repositório. Domínio/hospedagem e configuração de produção para dados reais continuam pendentes conforme [Preparação para publicação](PUBLICACAO.md).
