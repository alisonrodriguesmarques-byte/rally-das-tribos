# Arquitetura do ambiente sintético

**Estado após as etapas 1 a 7.** O sistema usa Node.js/Express, SQLite sintético em Linux e frontend HTML/CSS/JavaScript. Estão implementados login, sessões, gestão de contas, Rallys com duas tribos, equipes com histórico, pontos administrativos, missões e três modalidades de provas objetivas. Consulte [Desenvolvimento na nuvem](DESENVOLVIMENTO_NUVEM.md) para preparar e retomar o ambiente. Produção e bancos originais permanecem fora desse fluxo.

## Domínio

- Rally tem estados planejamento → ativo → encerrado → arquivado, ou planejamento → cancelado. Transições são explícitas e auditáveis.
- O catálogo global `tribos_catalogo` contém doze identidades oficiais; `tribos` representa a participação por edição. Novos Rallys selecionam duas identidades distintas no planejamento, fixas após iniciar. Edições anteriores são `legado` e preservam seus IDs, tribos e resultados para consulta.
- Pessoas e vínculos são entidades distintas. Entradas, saídas, transferências e trocas de papel são permitidas no planejamento ou durante edição ativa. A mudança encerra um período e abre outro, sem apagar o histórico. Há no máximo um cabeça e um auxiliar ativos por tribo e um vínculo ativo por pessoa na edição. Veja [Equipes](EQUIPES.md).
- Missões e provas têm destinatários explícitos dentro da edição. Os administradores editam rascunhos e publicam; regras publicadas ficam fixas. Encerramento impede novos envios. Edições legadas e finalizadas são somente consulta.

## Identidade e autorização

Contas criadas por administrador ficam pendentes. Senhas usam scrypt; sessões opacas persistem somente por hash, com expiração absoluta/inatividade e revogação. Mutações autenticadas exigem CSRF. O primeiro administrador é criado por comando de uso único com segredo do operador, sem credencial padrão; criação, sentinela e auditoria compartilham uma transação. Veja [Autenticação](AUTENTICACAO.md).

Cabeça (`lider`), auxiliar e participante acessam atividades conforme vínculo ativo na edição. A associação entre conta e pessoa é explícita, única e não reatribuível pelo fluxo. Não há correspondência por nome/email. O papel geral da conta não substitui a verificação de vínculo. Gestão de contas, pessoas, Rallys, ranking administrativo, regras e revisões permanece administrativa.

Cabeça e auxiliar enviam entregas da própria tribo. Cada prova define se todos os integrantes podem responder individualmente ou se uma pessoa representa a tribo. Os gabaritos ficam restritos ao administrador; questões são disponibilizadas ao respondente autorizado no início da tentativa. Não há ranking público. Coleta de informações pessoais deve permanecer mínima.

## Pontos e atividades

Lançamentos manuais administrativos entram diretamente no ranking, sem aprovação adicional. Correções manuais preservam o original e acrescentam compensação e eventual substituição, com justificativa e chave de repetição. Veja [Pontuações](PONTUACOES.md).

Missões usam pontos fixos. Entregas pendentes não pontuam; aprovação administrativa gera uma premiação por resultado. Rejeição preserva o relato e permite novo envio no prazo. A decisão final não é reescrita.

Quiz, verdadeiro/falso e completar versículos são corrigidos pelo servidor, com uma tentativa por respondente e prazo verificado no servidor. Pontos derivam das respostas e do gabarito armazenados, nunca de uma nota enviada pelo navegador. Cada resultado gera pontos uma única vez; resultado zero também fica registrado. As modalidades e limites estão em [Atividades](ATIVIDADES.md).

Entrega/revisão, respostas, resultado, pontos, histórico e auditoria são gravados nas transações correspondentes. Falha de auditoria reverte toda a operação. Eventos e resultados finais têm controles lógicos de preservação no banco. Esses controles não protegem contra alguém com controle administrativo do arquivo ou da conta do sistema operacional. Movimentações de integrantes não transferem pontos já registrados.

## Persistência e operação

A conexão exige configuração explícita e arquivo sintético preexistente fora do checkout. Diretório e arquivos privados, marker e identificação interna são verificados; não há criação implícita nem sobrescrita. A restauração de snapshot com outro inode tem recuperação explícita do marker após verificação somente para leitura da identidade interna e integridade.

São verificados `foreign_keys=ON`, timeout e journal DELETE. Migrações seguem lista fechada com checksum, schema e ledger na mesma transação. O servidor exige schema atualizado antes de iniciar; não executa migrações automaticamente. SQL é parametrizado; erros externos não expõem detalhes internos. O servidor escuta apenas em loopback, recusa origem externa e mantém APIs sem cache.

O plano de gates/ACLs Windows descrito em [Segurança](SEGURANCA.md) continua separado e pendente de validação específica. O fluxo Linux não comprova controles Windows nem autoriza migrações dos bancos originais.

## Pendências de produto e produção

Permanecem para etapas posteriores: perguntas abertas e outras modalidades de prova, uploads, pontuação de missão por quantidade/meta, revisão/estorno de resultados automáticos, novas tentativas, dashboard ampliado e política de consulta de resultados por antigos integrantes. A correção compensatória atual atende somente pontos manuais.

[Backup/restauração sintéticos](BACKUP.md), [HTTPS local](HTTPS.md), interface Arena Turquesa e validação completa estão implementados. Permanecem pendentes domínio/implantação pública, recuperação de contas, retenção/expurgo e anonimização, identificação pública de menores, backup/restauração de dados reais e controles operacionais de produção. Não há publicação automática ao alterar os arquivos ou migrar o banco sintético.
