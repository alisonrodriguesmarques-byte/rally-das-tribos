# Login Google com aprovação da coordenação

O login por e-mail e senha continua funcionando. Google é opcional e não substitui os usuários existentes. Uma identidade Google nunca é vinculada automaticamente só porque o e-mail parece igual ao de uma conta cadastrada.

## Fluxo da pessoa

1. Na tela de login, Entrar com Google abre a autorização oficial do Google.
2. No primeiro acesso, o sistema cria uma solicitação e uma notificação para os administradores. A pessoa ainda não recebe sessão nem acesso aos dados.
3. Em Mais → Contas Google, o administrador confere nome/e-mail e identidade da pessoa, escolhe uma conta existente e aprova o vínculo. Se a conta escolhida for administrativa, a confirmação exige a senha atual do próprio administrador que está aprovando, não a senha de outra pessoa.
4. A pessoa volta a Entrar com Google. O aplicativo aplica o papel e os vínculos de tribo que já existem nessa conta.

Não crie outra pessoa para o mesmo participante apenas para usar Google. Se a conta ainda não existe, cadastre a pessoa e seu acesso antes de aprovar o pedido. Uma conta aceita no máximo um vínculo Google. Desvincular interrompe o acesso Google e revoga as sessões dessa conta; o login por senha continua disponível. Solicitações rejeitadas não são aprovadas automaticamente em novas tentativas.

## Configuração no Google Cloud

1. Crie/selecione um projeto no Google Cloud Console.
2. Configure a tela de consentimento OAuth (Google Auth Platform/Branding, Audience e Data Access, conforme o painel).
3. Solicite somente OpenID, e-mail e perfil básico (`openid email profile`). Não é necessário acesso a Drive, Gmail, contatos ou arquivos.
4. Crie um OAuth client ID de tipo **Web application**.
5. No URI de redirecionamento autorizado, cadastre exatamente:

```text
https://SEU-ENDERECO-DO-SITE/api/auth/google/callback
```

Use o mesmo domínio canônico que será configurado em APP_URL, sem `#/`, parâmetros ou destinos alternativos. Se trocar de domínio, atualize tanto a variável quanto o URI autorizado. Para desenvolvimento local, cadastre separadamente `http://localhost:3000/api/auth/google/callback` e use apenas fora de produção.

6. Enquanto a tela de consentimento estiver em **Testing**, adicione os usuários de teste permitidos no painel. Para liberar ao público pretendido, publique a configuração e atenda aos requisitos de domínio, política de privacidade e verificação que o Google solicitar. A aprovação pelo Google e a aprovação interna do Rally são etapas diferentes.

## Variáveis privadas no servidor

No serviço Render → Environment, configure:

```text
APP_URL=https://SEU-ENDERECO-DO-SITE
GOOGLE_CLIENT_ID=ID_DO_CLIENTE_WEB
GOOGLE_CLIENT_SECRET=SEGREDO_DO_CLIENTE_WEB
```

APP_URL é apenas a origem HTTPS, sem caminho ou fragmento. JWT_SECRET já precisa estar configurado no aplicativo. Não copie o secret para o JavaScript do frontend, não envie credenciais em mensagens e não publique a configuração preenchida no GitHub. O botão só aparece quando a configuração de servidor está disponível.

## Proteções implementadas

Authorization Code com PKCE S256, state assinado e expirável em cookie HttpOnly, nonce e validação do ID token com a biblioteca oficial Google (assinatura, emissor, audiência e expiração), e-mail verificado, redirecionamento fixo para APP_URL, aprovação administrativa explícita, vínculo único e conta ativa/não excluída. Tokens de acesso Google não são guardados no banco.

As sessões locais usam JWT HS256 com emissor e audiência fixos e versão verificada a cada requisição no banco; o papel vem sempre do cadastro, não de um campo confiado do token. A atualização exige que usuários façam login novamente, sem mudar suas senhas existentes. Sessões duram até 12 horas e são revogadas em alterações de acesso/senha, logout e desvinculação Google.

## Conferência antes de liberar

Teste com usuários de teste no Google, primeiro pedido pendente sem acesso, notificação do admin, aprovação na pessoa correta, novo login e acesso somente à tribo/papel da pessoa. Teste também rejeição e desvinculação. O código foi validado com chamadas Google simuladas; uma conta real e as credenciais do seu projeto precisam ser configuradas pelo responsável para validar o fluxo externo.
