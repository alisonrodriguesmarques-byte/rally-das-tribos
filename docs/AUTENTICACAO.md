# Login, sessões e permissões — etapa 2

Esta entrega funciona no ambiente Linux com bancos sintéticos da etapa 1. Não habilita produção ou uso dos bancos originais. A interface inclui login, restauração de sessão, logout, painel administrativo de consulta e gestão de contas.

## Primeiro administrador

Não existe conta ou senha padrão. Depois de configurar as variáveis de banco sintético e executar `npm run init-db`, crie o primeiro administrador no terminal local:

```bash
# O segredo é definido pelo operador e não deve ser digitado em um comando
# literal que fique no histórico. Use um valor forte com 32 a 1024 caracteres.
read -r -s -p 'Segredo de inicialização: ' RALLY_BOOTSTRAP_SECRET
echo
export RALLY_BOOTSTRAP_SECRET
npm run bootstrap-admin
unset RALLY_BOOTSTRAP_SECRET
```

O comando pede o mesmo segredo, nome, email e senha. Segredo e senha ficam ocultos durante a digitação; a senha exige 12 a 128 caracteres, sem remover espaços ou acentos. O segredo é uma variável local temporária do CLI, não uma credencial usada pelo servidor nem um placeholder de segredo do proxy. Não envie seus valores no chat, em argumentos, no código ou em arquivos versionados.

Para automação há `node scripts/bootstrap-admin.js --json`, que recebe `{secret, nome_completo, email, password}` exclusivamente por stdin seguro. Nunca passe esse JSON como argumento ou literal no histórico do shell. Os testes geram valores aleatórios e os enviam diretamente ao processo.

Criação do administrador, aprovação, consumo da inicialização e auditoria compartilham uma transação. A operação recusa qualquer administrador já existente, inclusive pendente/inativo, e qualquer tentativa de converter uma conta pelo email. Uma sentinela permanente impede reutilização. Não há endpoint HTTP de bootstrap, modo force, redefinição de conta ou credencial embutida.

O servidor pode iniciar antes do bootstrap, mas ninguém terá acesso administrativo até o comando ser concluído. Em banco sintético retido da etapa anterior, `npm run init-db` aplica a nova migração 009 antes do bootstrap; não recrie nem apague o banco para atualizar.

## Fluxo de contas

1. O administrador entra e abre **Contas e acessos**.
2. Cria uma conta de cabeça da tribo, auxiliar ou participante. Todas começam pendentes.
3. Analisa a conta e aprova ou rejeita o acesso, registrando um motivo.
4. Somente conta ativa e aprovada pode autenticar.
5. A desativação ou mudança de aprovação revoga as sessões existentes. Reativar não restaura sessões revogadas: exige novo login.

Não há cadastro público, promoção de novos administradores, exclusão de contas, recuperação de senha ou alteração de senha nesta entrega. O administrador inicial não pode ser desativado por essas operações de gestão. Rejeições e alterações ficam em auditoria lógica append-only, com ator, alvo, instante e motivo. Não coloque senhas nem dados pessoais desnecessários no motivo.

## Matriz efetiva desta etapa

| Operação | Sem sessão | Administrador ativo/aprovado | Cabeça, auxiliar e participante ativos/aprovados |
|---|---|---|---|
| Abrir tela de login e health local | Permitido | Permitido | Permitido |
| Consultar própria sessão e sair | 401 | Permitido | Permitido |
| Listar/alterar Rallys e tribos | 401 | Permitido | 403 |
| Consultar membros ou ranking administrativo | 401 | Permitido | 403 |
| Criar/listar/aprovar/desativar contas | 401 | Permitido, com restrições acima | 403 |
| Consultar atividades atribuídas à própria tribo | 401 | Todas da edição | Vínculo ativo necessário |
| Enviar entrega de missão | 401 | Usa conta de integrante | Somente cabeça/auxiliar da própria tribo |
| Responder prova | 401 | Usa conta de integrante | Conforme política da prova e vínculo ativo |
| Associar conta, criar/publicar atividades e revisar entregas | 401 | Permitido | 403 |

As regras autorizadas para atividades estão em [Missões e provas](ATIVIDADES.md). O servidor consulta a associação explícita da conta à pessoa e seu vínculo ativo com a tribo/edição; o perfil geral da conta não substitui esse vínculo. As demais operações de gestão continuam administrativas. Não há acesso público ao ranking.

## Sessões e proteção

- Senhas: scrypt assíncrono (`N=32768`, `r=8`, `p=3`), salt aleatório por senha e comparação em tempo constante. Hashes antigos incompatíveis não são convertidos ou aceitos automaticamente.
- Sessão: token aleatório de 256 bits no cookie `rally_session`, com `HttpOnly`, `SameSite=Strict` e `Path=/`. Somente SHA-256 do token é guardado no banco. O cookie não é acessível pelo JavaScript.
- Expiração: oito horas absolutas e trinta minutos sem uso. O servidor consulta estado, aprovação e papel atuais; não confia em papel enviado pelo navegador. Estado de sessão e revogação persistem no SQLite entre reinicializações.
- Reautenticar com uma sessão anterior válida gera outro token e revoga o anterior. Logout revoga somente a sessão correspondente; desativação/revisão de conta revoga todas as sessões daquele usuário.
- CSRF: token separado retornado pelo login/consulta da sessão e enviado em `X-CSRF-Token` nas mutações autenticadas, inclusive logout. Ele fica apenas em memória no cliente, sem localStorage/sessionStorage. Login exige JSON; Host, Origin e requisições cross-site também são verificados.
- Limites: corpo de requisição de 16 KiB, exceto 128 KiB para configurações e envios de atividades; até dez tentativas por combinação IP/email em quinze minutos (sucesso reinicia esse contador), além de cem tentativas por IP no período. O limitador é local ao processo e limitado em memória, não um mecanismo distribuído de produção.
- Respostas de API não são armazenadas em cache. Mensagens de login não distinguem usuário inexistente, senha incorreta e conta indisponível. Erros de JSON não refletem ou registram o corpo recebido.
- A auditoria registra eventos, não senhas, segredo de bootstrap, cookie ou token de sessão. Triggers impedem UPDATE/DELETE da auditoria e da sentinela pelo fluxo normal; isso não é proteção criptográfica contra alguém com controle do arquivo/conta do sistema.

O cookie usa `Secure` quando o socket é TLS e mantém HTTP de loopback para desenvolvimento. [HTTPS local](HTTPS.md) está implementado e testado. O runtime continua recusando `NODE_ENV=production` e listeners externos. Domínio/certificado público, política de proxy, recuperação de conta, retenção/expurgo de sessões/auditoria e demais controles operacionais exigem a entrega de produção. Não há limpeza automática de auditoria/sessões enquanto a política de retenção não estiver aprovada.

## Contrato HTTP

Todas as respostas de sucesso usam `{success: true, data: ...}` e os erros usam `{success: false, error: ...}`. Dados públicos de conta nunca incluem `senha_hash` ou credenciais de sessão.

| Método e rota | Corpo / resultado |
|---|---|
| POST `/api/auth/login` | `{email, password}` → `{user, csrfToken}` e cookie |
| GET `/api/auth/session` | `{user, csrfToken}` ou 401 |
| POST `/api/auth/logout` | CSRF obrigatório → `data: null`, cookie removido |
| GET `/api/admin/users` | Lista administrativa sem hashes |
| POST `/api/admin/users` | `{nome_completo, email, password, tipo_usuario}` → conta pendente |
| PATCH `/api/admin/users/:id/approval` | `{aprovacao: 'aprovado' ou 'rejeitado', motivo}` |
| PATCH `/api/admin/users/:id/status` | `{status: 'ativo' ou 'inativo', motivo}` |

## Verificação reproduzível

```bash
npm test
# Opcional, com Playwright e Chromium instalados no ambiente:
npm run test:ui
```

A suíte principal cobre persistência, bootstrap concorrente/único, rollback em falha de auditoria, hash de senha, sessões entre instâncias do serviço e as cinco suítes funcionais: repositórios, API, revisão, autenticação e tribos. Cada execução usa bancos novos, sem copiar ou abrir bancos protegidos, sem credenciais fixas nem bypass de autorização em `NODE_ENV=test`.

O teste opcional de navegador usa apenas fixtures próprias e verifica login, sessão após reload, aprovação, perfis, logout e layout de computador/celular. Playwright é uma dependência de desenvolvimento fixada no lockfile; Chromium deve ser instalado no ambiente ou pelo Playwright. `CHROMIUM_PATH` pode selecionar o executável disponível.
