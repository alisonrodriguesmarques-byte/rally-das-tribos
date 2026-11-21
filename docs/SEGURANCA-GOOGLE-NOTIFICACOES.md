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

## Notificações internas

O envio por e-mail foi removido. Variáveis antigas SMTP/Resend não ativam envios. Não há preferências de e-mail nem composição de mensagens na página de notificações, que guarda o histórico dos eventos.

Ao acessar a conta, os avisos não lidos aparecem em uma janela com saudação pessoal. Uma missão nova informa quem a disponibilizou; a devolução de relatório identifica o admin e mostra o motivo. Fechar a janela marca esses avisos como lidos, sem apagá-los do histórico. O admin deve manter seu nome/apelido cadastrado corretamente, por exemplo Obr. Márcia.

## Criar conta e validar

A tela de login tem o link Criar conta. O formulário solicita somente nome, e-mail e senha; não cria acesso antes de aprovação. O admin abre Validar cadastros, confere a identidade e aprova a criação de uma conta de membro, associando a uma pessoa já cadastrada sem acesso ou criando o cadastro. Depois atribui a tribo e as funções. Não há verificação automática de propriedade do e-mail, pois não há envio de e-mails; o admin deve confirmar a identidade por um meio confiável.

O cadastro Google usa a verificação OAuth real e também aguarda validação. Em Contas Google, o admin pode vincular uma conta existente ou validar a criação de uma conta de membro. Contas existentes nunca são substituídas por coincidência de e-mail. Google continua exigindo Client ID, Client Secret, APP_URL e URI de retorno na conta Google Cloud; o código não substitui essa configuração.

## Publicar e conferir sem mexer nos dados em uso

1. Confira backup recente e guarde a chave. Preferencialmente restaure em um banco de teste para validar mudanças antes de produção.
2. Configure APP_URL. Para Google/e-mails, adicione os respectivos segredos; sem eles, senha local e notificações internas continuam disponíveis.
3. Publique a versão. O servidor Render aplica 003/004 uma vez e mantém dados existentes. Não rode os SQLs de instalação por cima.
4. Entre novamente com o admin e confira pessoas, rallies, pontos e relatórios antigos.
5. Teste exclusão com pessoa fictícia e arquivo com rally de teste encerrado.
6. Configure o OAuth e tente uma conta de teste: ela não deve ver dados antes de aprovação.
7. Teste um cadastro novo e confira que só consegue entrar após validação do administrador.

Testes automáticos usam bancos locais e transportador de e-mail falso. Não conectam ao banco de produção e não enviam mensagens reais.
