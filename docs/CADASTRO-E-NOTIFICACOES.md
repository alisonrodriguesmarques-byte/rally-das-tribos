> Atualização: a opção Continuar com Google foi temporariamente ocultada das telas de entrada e cadastro. O formulário por e-mail e senha e a validação do admin continuam ativos. Vínculos e dados Google existentes foram preservados.

# Cadastro validado e notificações no acesso

## Mudanças em produção

Migração aditiva 005 cria somente a tabela de solicitações de cadastro. Não recria usuários ou dados existentes. Não repita os SQLs de instalação. Não foi acessado o banco de produção nos testes.

- O login oferece **Criar conta** e mantém Entrar com e-mail/senha.
- O cadastro oferece Continuar com Google (quando configurado), ou nome, e-mail e senha de pelo menos 12 caracteres. Não são coletados país e preferências de marketing.
- Solicitações por formulário ficam pendentes, com senha protegida por bcrypt, sem acesso ao Rally. O admin entra em **Validar cadastros** e confere a identidade antes de aprovar ou rejeitar. A conta aprovada é sempre de membro; ninguém pode escolher ser admin no cadastro.
- O admin pode associar a pessoa já cadastrada sem login, ou criar o cadastro. Depois atribui tribo/cabeça/auxiliar/participante. A senha de contas existentes não é substituída por um cadastro público.
- Cadastros Google aguardam a mesma decisão humana. Em **Contas Google**, o admin cria a conta de membro ou vincula a uma conta existente. O vínculo com admin continua exigindo a senha do admin que aprova.
- Google necessita de configuração no Google Cloud e das variáveis APP_URL, GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET. Até lá, o cadastro por formulário funciona e o botão Google explica que aguarda configuração.

## Notificações e imagens

Novas missões e devoluções de relatório geram avisos com saudação, autor e motivo. Ao entrar, os avisos não lidos aparecem em uma janela. Ao fechá-la, ficam lidos e permanecem no histórico; a página de notificações serve somente para consultar e marcar leitura. Nenhum aviso é enviado por e-mail, nem com variáveis antigas configuradas. Você pode remover SMTP_*, RESEND_API_KEY, MAIL_FROM e NOTIFICATIONS_EMAIL_ENABLED do Render.

O nome mostrado do responsável vem do nome/apelido cadastrado. Para aparecer “Obr. Márcia”, o admin deve ter esse nome/apelido no cadastro. Os avisos antigos não são reescritos; a nova redação vale para eventos novos.

Os emblemas exibidos usam SVG com recorte vetorial transparente ao redor do medalhão e da faixa. O WebP original é embutido sem recompressão, redesenho ou mudança de cores; os arquivos originais continuam preservados. A imagem aparece junto ao nome da tribo no início de cabeças/auxiliares e demais membros vinculados.

As requisições já recebidas, os vínculos Google, as preferências antigas e a antiga fila de e-mail são preservados para histórico; o worker é inerte e não processa envios. As senhas dos pedidos aprovados/rejeitados são removidas da tabela de solicitações depois da avaliação; a conta aprovada conserva apenas seu hash normal.

Pedidos por formulário não verificam e-mail automaticamente: essa verificação de identidade é responsabilidade do admin. Se já tem uma conta ou foi rejeitado, procure a coordenação, que pode conceder acesso pelo cadastro existente. Não existe recuperação de senha por e-mail nesta versão.

## Retenção e controles atuais

O item Validar cadastros está temporariamente oculto no menu lateral e em Mais; as contas, solicitações e aprovação não foram apagadas. Administradores ainda podem acessar a aprovação pelo aviso recebido ou pelo endereço interno #/cadastros.

Notificações lidas ou não lidas expiram após 7 dias de sua criação. A aplicação limpa os registros vencidos na inicialização, a cada hora enquanto o servidor está ativo e ao consultar notificações/contador. Se o Render estiver suspenso, a limpeza ocorre quando o serviço voltar; avisos vencidos são removidos antes da consulta. Exclui somente notificações e metadados da antiga fila vinculados a elas, sem alterar missões, relatórios, pontos ou cadastros. Backups anteriores seguem sua retenção própria.

Cada pessoa pode excluir manualmente seus próprios avisos, após confirmação. Não é possível apagar avisos de outra pessoa. O sino exibe a quantidade de não lidas (99+ acima de 99, e oculta o selo quando chega a zero), atualizada ao ler/excluir, ao voltar à janela e periodicamente.
