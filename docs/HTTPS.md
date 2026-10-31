# HTTPS e preparação de publicação

O servidor pode usar **HTTPS diretamente no Node.js**, com certificado e chave configurados por caminhos externos ao checkout. HTTP de loopback continua disponível para desenvolvimento e testes existentes quando ambas as variáveis TLS estão ausentes. Não existe fallback para HTTP se a configuração TLS estiver incompleta ou inválida.

Esta entrega prepara e valida o transporte em **homologação sintética local**. Não publica o sistema: domínio, hospedagem, certificado público, renovação e modo de operação com dados reais precisam ser definidos e validados antes de uma implantação pública. As proteções atuais continuam recusando `NODE_ENV=production`, bancos originais e listeners externos. Um certificado HTTPS não remove essas limitações.

## Configurar TLS

Depois de configurar o banco sintético e aplicar as migrações, use arquivos de certificado e chave fornecidos pelo operador em diretório privado fora do repositório:

```bash
export RALLY_TLS_CERT_PATH=/caminho/privado/tls/server.crt
export RALLY_TLS_KEY_PATH=/caminho/privado/tls/server.key
export HOST=127.0.0.1
export PORT=3443
npm start
```

O certificado PEM pode incluir a cadeia intermediária. O nome ou IP usado na URL deve constar no SAN do certificado. A chave deve ser arquivo regular, pertencente ao usuário do processo, com permissão **0600 ou 0400**. Links simbólicos, hardlinks e material dentro do checkout são recusados. Certificado e chave são lidos no início; o par e a validade do certificado são conferidos antes de abrir o banco. Para trocar/renovar o certificado, instale os novos arquivos privados e reinicie o serviço.

Uma CA privada de desenvolvimento precisa ser confiada explicitamente pelo cliente. Não desative a verificação TLS e não use `curl -k`, `rejectUnauthorized: false` ou `NODE_TLS_REJECT_UNAUTHORIZED=0`. Para uma CA privada já instalada pelo operador:

```bash
curl --cacert /caminho/privado/tls/ca.crt https://127.0.0.1:3443/api/health
```

O teste automatizado abaixo gera CA, chave e certificado SAN efêmeros com OpenSSL, usando diretórios temporários 0700. Nenhum desses arquivos é certificado de publicação. Não há chaves privadas versionadas nem emissão pública automática.

## Controles do transporte

- TLS 1.2 ou superior; HTTP puro na porta HTTPS é recusado pelo protocolo.
- Cookie de sessão com `HttpOnly`, `SameSite=Strict` e **Secure quando o socket é TLS**. A expiração e remoção do cookie usam os mesmos atributos. HTTP de desenvolvimento não marca Secure.
- Origem comparada com o esquema real do socket e o Host local; origem HTTP em conexão HTTPS é recusada. Host externo e requisição cross-site continuam bloqueados.
- O aplicativo não confia em proxy: `Forwarded` e `X-Forwarded-*` são recusados. Um cliente não pode simular HTTPS enviando cabeçalhos. Nenhuma configuração de `trust proxy` foi liberada.
- Respostas HTTPS enviam HSTS de um dia, sem incluir subdomínios; CSP, proteção de conteúdo e ausência de cache das APIs permanecem.

Não foi acrescentado um redirector HTTP para HTTPS: a instância abre um único transporte. Um redirecionamento público e eventual proxy reverso dependem da arquitetura de hospedagem definida pelo operador e de testes específicos. Não coloque um proxy público à frente do servidor atual para contornar os bloqueios locais.

## Serviço de homologação

[deploy/rally-local.service.example](../deploy/rally-local.service.example) e [deploy/rally.env.example](../deploy/rally.env.example) são modelos **para revisão**, não instalados nesta tarefa. O serviço usa usuário dedicado `rally`, processo sem privilégios, raiz de arquivos somente leitura, diretório de estado privado e listener `127.0.0.1:3443`. Ajuste os caminhos do checkout e do executável Node.js 24 conforme o host. O banco sintético precisa ser provisionado previamente como o usuário do serviço; iniciar o serviço não cria banco nem executa migrações.

O arquivo de ambiente e a chave devem ficar fora do checkout, com permissões restritas. O serviço lê TLS em `/etc/rally/tls` e só grava em `/var/lib/rally`. Segredos de bootstrap não devem ser deixados no ambiente persistente do serviço. Para validar o modelo antes de instalar, use `systemd-analyze verify` no host de destino; instalação, conta de serviço, certificados e permissões não foram aplicados por esta tarefa.

## Validação reproduzível

```bash
npm run test:https
```

Requer Node.js 24 e OpenSSL. O teste cria seu próprio banco sintético, administrador aleatório, CA privada e certificados descartáveis; inicia e encerra somente os próprios processos. Verifica configuração parcial, chave insegura, links, par divergente, cadeia e nome do certificado com validação habilitada, ausência de confiança na CA desconhecida, bloqueio de HTTP puro, origem/Host/proxy, sessão, CSRF, cookie Secure e logout. Também confirma a compatibilidade com HTTP local existente.

## Antes de publicar em um domínio

Defina a hospedagem e o domínio, o armazenamento persistente e a estratégia de recuperação. Em uma entrega de produção, será necessário implementar e testar o modo de dados reais, a exposição de rede, a origem canônica e a confiança explícita no proxy escolhido, se houver. Depois, emitir certificado válido para o domínio, automatizar e testar renovação, configurar HTTPS e redirecionamento, executar restauração de ensaio e a suíte completa no host. Somente então a publicação pode ser avaliada. Os modelos desta etapa não concedem essas configurações automaticamente.
