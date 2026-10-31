# Candidato para homologação — Arena Turquesa

As telas implementadas usam o padrão Arena Turquesa, com navegação e formulários para computador e celular. A preparação inclui verificação automatizada, backup consistente, restauração em instância separada e HTTPS local. Os arquivos de configuração e testes não publicam o sistema.

A evidência da execução e do ensaio do banco retido está em [Validação local](VALIDACAO_PUBLICACAO.md).

O ambiente continua **sintético e local**. O domínio e a hospedagem não foram definidos nesta tarefa. O servidor recusa produção, bancos originais, listeners externos e proxies não configurados. Essas restrições não devem ser removidas por uma variável ou um proxy para expor esta versão à internet.

## Reproduzir a verificação

Use Linux, Node.js 24, npm e OpenSSL. Na raiz do checkout:

```bash
npm ci --no-audit --no-fund
npx playwright install --with-deps chromium
npm run test:release
```

Playwright é uma dependência de desenvolvimento com versão fixada no lockfile. Se houver Chromium instalado pelo ambiente, `CHROMIUM_PATH` pode selecionar seu executável; os testes também reconhecem `/usr/bin/chromium`. Não desative a verificação TLS para instalar ferramentas ou executar testes.

`test:release` executa, em sequência:

1. Auditoria das dependências de execução, recusando vulnerabilidades conhecidas altas/críticas.
2. Persistência, primeiro administrador, backup/restauração, HTTPS e oito suítes funcionais.
3. Fluxos no navegador de login/contas/Rallys, equipes, ranking e missões/provas.
4. Responsividade nas telas implementadas em 320, 390, 768 e 1440 pixels, campos ampliados, erros de rede e respostas atrasadas.

As suítes criam suas próprias credenciais e bancos sintéticos temporários. O comando remove as configurações de banco e TLS do operador apenas do ambiente dos processos de teste; mantém proxy e confiança nas CAs. Não seleciona o banco retido da aplicação.

O resultado e os logs ficam em `artifacts/release-<identificador>/report.json`. Um resultado `passed` confirma somente o escopo registrado. Falha interrompe as próximas suítes, gera relatório e retorna código diferente de zero. O comando não publica e não considera uma execução incompleta como aprovada. Esses arquivos não são versionados nem servidos pelo aplicativo.

`npm test` verifica a parte de servidor, persistência e recuperação sem precisar de navegador. `npm run test:browser` executa as cinco suítes de navegador. A auditoria de dependências requer acesso ao registro npm; os testes funcionais usam apenas serviços locais e fixtures próprias.

O workflow [verify.yml](../.github/workflows/verify.yml) reproduz `test:release` em pull requests, atualizações de `main` e execução manual no GitHub. Ele guarda os relatórios como artefatos por 14 dias e não contém etapa de implantação. A configuração foi criada neste checkout; a execução no GitHub depende de enviar as alterações ao repositório.

## Recuperação e HTTPS

Antes de atualizar uma instância retida, configure as variáveis do banco existente e execute:

```bash
npm run db:backup -- --dest /diretorio/novo-do-backup
npm run db:restore -- --backup /diretorio/do-backup --dest /nova-instancia-de-ensaio
```

Não recrie o banco para atualizá-lo. Backup verifica snapshot, schema, migrações, integridade e SHA-256. Restauração nunca sobrescreve o banco ativo, gera uma nova identidade e revoga sessões na cópia. Confira os resultados e a integridade na instância de ensaio antes de qualquer troca de configuração. O procedimento de troca/retorno e seus limites estão em [Backup](BACKUP.md).

Configure certificado e chave fora do checkout com `RALLY_TLS_CERT_PATH` e `RALLY_TLS_KEY_PATH`. A aplicação valida o par e a validade, usa TLS 1.2 ou superior e cookies Secure no transporte TLS. O ensaio automatizado confia explicitamente em uma CA temporária, sem desativar a verificação do certificado. Veja [HTTPS](HTTPS.md) para configuração, modelo de serviço local e limites de proxy/renovação.

Backups e chaves contêm material sensível e não devem ficar no repositório, nos artefatos de CI ou em diretórios públicos. A cópia local verificada não substitui cópia externa, criptografia do armazenamento e recuperação ensaiada no host escolhido.

## Dados necessários para uma publicação pública

Para preparar a implantação no destino, faltam domínio, provedor/host e armazenamento persistente. Com essas definições, será possível implementar e validar a configuração de produção para dados reais, a origem canônica e a exposição de rede; emitir e renovar certificado público; configurar recuperação no destino e repetir os testes.

Esta entrega não instala o serviço no host público, não emite certificado público e não migra dados originais. O administrador pode revisar o candidato local e seus relatórios antes dessa próxima etapa. As decisões de dados ainda pendentes estão em [Política de dados](POLITICA_DE_DADOS.md).
