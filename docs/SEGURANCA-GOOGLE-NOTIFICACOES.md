# Segurança, Google, cadastros, arquivo e notificações

Esta atualização usa migrações **aditivas** 003 e 004. Não recria o banco, não troca IDs nem apaga pontuações, usuários, relatórios e auditoria. Em produção, confira o último backup verde e mantenha a chave de recuperação antes de publicar. Não execute novamente os SQLs 01/02 de instalação.

## Segurança implementada

- Cookies HttpOnly, SameSite=Lax e Secure em produção; JWT HS256 com emissor/audiência, duração de 12 horas e versão de sessão consultada no banco. Mudanças de senha, acesso, exclusão e saída revogam as sessões conforme a operação. A atualização exige novo login de quem estava conectado com tokens antigos.
- Novas senhas com pelo menos 12 caracteres e no máximo 72 bytes, bcrypt custo 12. Hashes/senhas antigos continuam funcionando para não bloquear contas de produção.
- Proteção de origem nas operações de escrita, API JSON, CSP sem JavaScript inline/externo, proteção contra frames, respostas privadas sem cache, limites de requisições e tentativas de login, consultas parametrizadas e validações de entrada.
- Sem retorno de hashes ou segredos na API; erros internos usam código e identificador de requisição em vez de registrar SQL com dados privados. CSV neutraliza textos que planilhas poderiam executar como fórmulas.
- Último administrador e autoexclusão protegidos; ranking e pontuação continuam apenas para admin.

Nenhuma aplicação pode prometer segurança absoluta. Limites por IP ficam na memória de cada instância e reiniciam com o processo; para várias réplicas ou proteção adicional, considere limite centralizado/WAF no provedor. O administrador deve usar senha única, gerenciador de senhas, e ativar MFA nas contas Google, Supabase, Render e GitHub. Mantenha banco privado, TLS validado, backups criptografados, dependências atualizadas e acesso mínimo aos painéis.

## Configurações do Render

As variáveis de banco, JWT_SECRET, DATABASE_CA_CERT e demais já funcionais continuam. Use um JWT_SECRET aleatório de pelo menos 32 bytes; se precisar trocá-lo, isso exige novo login de todos, mas não apaga dados.

Adicione `APP_URL` com a origem HTTPS real do site, por exemplo `https://seu-servico.onrender.com`, sem caminho, query ou fragmento. Não é a URL do Supabase. Configure o domínio definitivo também se utilizar domínio próprio.

## Login Google com aprovação

O botão só aparece quando Google estiver configurado. O login tradicional continua disponível.

1. No Google Cloud Console, crie/configure o projeto e a tela de consentimento OAuth. Use apenas escopos openid, email e profile. Enquanto o app estiver em modo de teste, cadastre os testadores; para abrir aos demais usuários, siga a publicação/verificação solicitada pelo Google.
2. Crie um OAuth Client do tipo **Web application**. Em Authorized redirect URIs, cadastre exatamente:
   `https://SEU_DOMINIO/api/auth/google/callback`
3. No Render, configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `APP_URL`. Segredos ficam apenas no painel; nunca no GitHub ou frontend.
4. Publique/reinicie o serviço. A pessoa clica em Entrar com Google e confirma a conta. O servidor valida assinatura, emissor/audiência do ID token pela biblioteca Google, e-mail verificado, state, nonce e PKCE. Tokens Google não são enviados ao frontend nem guardados como acesso permanente.
5. Na primeira tentativa, a pessoa fica **aguardando aprovação**, sem acesso aos dados.
6. O admin abre **Mais → Contas Google**, verifica a identidade por meio confiável e vincula à conta ativa já cadastrada no Rally. Não há vínculo automático apenas porque o e-mail coincide. Uma conta pode ter no máximo um vínculo Google aprovado. Vincular uma conta administrativa exige confirmar a senha do administrador que está aprovando.
7. Na próxima tentativa Google, a pessoa entra com as permissões daquela conta. O admin pode rejeitar ou desvincular. A senha local continua válida; desvincular não significa excluir a pessoa.

Os e-mails de aviso vão para o endereço da conta cadastrada pelo admin, que pode ser diferente do e-mail Google usado no login.

O Google Cloud não pode ser configurado apenas por um commit no projeto. Nenhuma credencial Google real foi incluída e nenhuma aprovação é automática.

## Excluir pessoas preservando o histórico

No perfil da pessoa, o admin confirma a exclusão. Isso desativa o cadastro e o acesso, revoga sessões e retira a pessoa das listas de trabalho. Vínculos de rallies abertos são encerrados; registros encerrados, pontuações, relatórios e autoria continuam preservados.

É **exclusão lógica**, não eliminação definitiva dos dados pessoais. Não substitui um procedimento de anonimização/eliminação por obrigação legal. A operação não pode excluir a própria conta nem o último admin ativo. Não há DELETE físico nas tabelas históricas.

## Arquivar rallies

Em Rallies, encerre o rally antes de arquivar. Arquivados deixam de aparecer na seleção normal; o admin pode consultar o filtro de arquivados e desarquivar. Desarquivar mantém o status encerrado. Nenhum histórico ou pontuação é apagado, e o rally arquivado permanece somente leitura.

## Notificações internas e e-mails

O sino no topo e a página **Notificações** mostram avisos próprios e permitem marcar como lidos. O admin pode publicar um aviso importante para os destinatários permitidos. Novas missões avisam os usuários ativos participantes das tribos selecionadas, incluindo cabeça/auxiliar/participantes e admins. Relatórios enviados avisam os admins; devolvidos avisam os responsáveis da tribo. Respostas e aprovações de missões geram avisos conforme o papel.

Por privacidade, contas existentes começam com e-mail desativado. Cada usuário pode habilitar **Notificações → Preferências → Receber por e-mail**. Notificações internas funcionam mesmo sem provedor de e-mail. Somente contas ativas, não excluídas e com preferência habilitada entram na fila de e-mails.

Para o **Render Free**, prefira envio HTTPS com Resend, porque o Render bloqueia as portas SMTP 25, 465 e 587 ([documentação oficial](https://render.com/docs/free)). Crie uma conta no provedor, verifique seu domínio/remetente conforme as instruções de DNS e cadastre no Render:

```text
NOTIFICATIONS_EMAIL_ENABLED=true
RESEND_API_KEY=chave_privada_do_provedor
MAIL_FROM=Rally das Tribos <remetente@seu-dominio>
APP_URL=https://seu-servico.onrender.com
```

A API usa HTTPS e chave de idempotência por notificação para reduzir duplicações em novas tentativas. A chave fica apenas no servidor. O modo de teste do provedor pode limitar destinatários; para enviar aos usuários, conclua a verificação de domínio/remetente e confira as cotas do plano. As preferências individuais continuam necessárias.

Alternativamente, em uma hospedagem/porta que permita SMTP, configure no Render, usando um provedor SMTP e remetente verificado:

```text
NOTIFICATIONS_EMAIL_ENABLED=true
SMTP_HOST=host_fornecido_pelo_provedor
SMTP_PORT=587
SMTP_USER=usuario_smtp
SMTP_PASS=segredo_smtp
MAIL_FROM=Rally das Tribos <remetente@seu-dominio>
APP_URL=https://seu-servico.onrender.com
```

A porta 465 usa TLS direto; as demais exigem STARTTLS. Certificados são validados. Configure SPF/DKIM/DMARC conforme o provedor para melhorar entrega; planos gratuitos têm cotas. Não use a senha comum da caixa de e-mail onde o provedor exigir credencial de aplicativo/SMTP.

O worker do servidor consulta a fila, envia lotes limitados e tenta novamente em falhas, até cinco tentativas. O e-mail tem texto genérico e link para a conta: não expõe relatório, pontuação ou mensagem privada em caixa de entrada. A leitura completa exige login. Entrega SMTP não garante recebimento nem ausência absoluta de duplicatas se houver falha após o provedor aceitar o envio; o Message-ID é estável por notificação.

No Render Free, o processo pode dormir; os e-mails pendentes aguardam o serviço voltar. Para entrega contínua sem essa espera, use instância sempre ativa ou worker externo. A entrada Vercel não inicia worker em segundo plano. A aplicação não faz disparos retroativos de eventos anteriores à atualização.

## Publicar e conferir sem mexer nos dados em uso

1. Confira backup recente e guarde a chave. Preferencialmente restaure em um banco de teste para validar mudanças antes de produção.
2. Configure APP_URL. Para Google/e-mails, adicione os respectivos segredos; sem eles, senha local e notificações internas continuam disponíveis.
3. Publique a versão. O servidor Render aplica 003/004 uma vez e mantém dados existentes. Não rode os SQLs de instalação por cima.
4. Entre novamente com o admin e confira pessoas, rallies, pontos e relatórios antigos.
5. Teste exclusão com pessoa fictícia e arquivo com rally de teste encerrado.
6. Configure o OAuth e tente uma conta de teste: ela não deve ver dados antes de aprovação.
7. Habilite e-mail em uma conta de teste com consentimento e verifique o provedor de e-mail. Só habilite envio real depois da conferência.

Testes automáticos usam bancos locais e transportador de e-mail falso. Não conectam ao banco de produção e não enviam mensagens reais.
