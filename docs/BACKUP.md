# Backup e restauração verificáveis

O fluxo atual atende somente os bancos sintéticos em Linux, nos modos `development` e `test`. Não abre nem converte bancos originais, não aceita `production` e não altera os controles do banco existente. Preparar um backup não publica o aplicativo.

## Criar um backup

Configure as mesmas variáveis usadas para iniciar o banco de desenvolvimento. Escolha um **novo diretório**, fora do checkout, da instância atual e das pastas protegidas. O diretório pai deve existir e ser seguro; o comando cria somente o último diretório, com permissão 0700.

```bash
cd /workspace/rally-das-tribos
export NODE_ENV=development
export RALLY_SYNTHETIC_DIR=/workspace/.rally-synthetic-dev
export RALLY_DEV_DB_PATH="$RALLY_SYNTHETIC_DIR/rally-dev.db"
npm run db:backup -- --dest /workspace/.rally-backup-antes-da-atualizacao
```

O destino não pode existir, mesmo que esteja vazio. Não há opções `force`, reset ou sobrescrita. Repetir o comando exige outro nome de diretório.

O aplicativo pode continuar aberto durante a cópia. O comando usa `VACUUM INTO` do SQLite para obter um snapshot transacional consistente; não copia diretamente um arquivo `.db` em uso. Escritores concorrentes podem aguardar brevemente os locks do SQLite. O backup contém transações confirmadas antes do ponto do snapshot; alterações posteriores continuam apenas no banco de origem.

Cada pacote contém:

- `database.sqlite`: snapshot autocontido, com permissão 0600 e sem depender de WAL/journal externos;
- `backup.json`: manifesto privado com identificador, instante UTC, identidade/modo sintéticos da origem, tamanho, SHA-256 e lista de migrações verificadas.

Antes de confirmar o pacote, são verificadas a proveniência sintética interna, a lista completa de migrações/checksums da versão atual, os objetos essenciais do schema, as views, as chaves estrangeiras e `PRAGMA integrity_check`. Arquivos e diretório são sincronizados no disco. O comando não modifica os dados da origem nem revoga suas sessões.

O checksum identifica corrupção e alterações acidentais. Não é assinatura criptográfica nem proteção contra alguém que possa modificar tanto o arquivo quanto o manifesto. A fronteira de confiança continua sendo a conta do sistema operacional e seus diretórios privados. Backups contêm cadastros e hashes de senha: mantenha cópias fora do checkout e fora de pastas públicas. Criptografia de disco/armazenamento e cópia externa devem ser configuradas no serviço de hospedagem escolhido; o pacote não cifra os dados por conta própria.

## Restaurar para uma nova instância

A restauração nunca sobrescreve nem troca o banco em uso. Valida o pacote e cria uma **nova instância sintética** em outro diretório novo. O modo precisa ser o mesmo do backup. Exemplo para um backup de desenvolvimento:

```bash
export NODE_ENV=development
npm run db:restore -- \
  --backup /workspace/.rally-backup-antes-da-atualizacao \
  --dest /workspace/.rally-restaurado-verificacao
```

A verificação de SHA-256, proveniência, migrações, schema, integridade e chaves estrangeiras ocorre antes de criar o destino. A cópia também confere novamente o checksum dos bytes efetivamente copiados. A instância recebe nova identidade sintética interna e marker correspondente ao seu caminho/inode. Antes de disponibilizar o marker, a restauração revoga todas as sessões ativas copiadas e registra `database_restored` na auditoria; esse ajuste é transacional. As contas e senhas continuam válidas, mas todos devem entrar novamente. A sentinela do primeiro administrador permanece consumida.

O pacote original e o banco anterior permanecem intactos. Links simbólicos, hardlinks, permissões públicas, ancestrais substituíveis, destinos existentes, caminhos protegidos e pacotes com auxiliares SQLite são recusados. Uma falha limpa somente arquivos criados exclusivamente pela operação. Arquivos inesperados encontrados no destino são preservados para investigação; escolha outro diretório para tentar novamente.

## Verificar antes de trocar o caminho

Use o checkout/versão com o mesmo conjunto de migrações do backup. Restaurar backups de outras versões exige um procedimento específico; o comando atual não presume compatibilidade e não aplica migrações automaticamente.

```bash
export NODE_ENV=development
export RALLY_SYNTHETIC_DIR=/workspace/.rally-restaurado-verificacao
export RALLY_DEV_DB_PATH="$RALLY_SYNTHETIC_DIR/rally-dev.db"
npm run init-db
npm start
```

O inicializador deve confirmar todas as migrações existentes sem alterar ou recriar o banco. Faça login novamente e confira Rallys, integrantes, entregas, resultados e ranking esperados. Para um ensaio isolado, use outra porta disponível, mantendo a configuração de HTTPS escolhida. O processo anterior continua apontando para o caminho antigo até ser encerrado e reiniciado com a nova configuração.

Somente depois da conferência, pare o serviço e configure o caminho restaurado na sua inicialização. Reinicie e repita a conferência. Para voltar ao estado anterior, pare o serviço e retorne às variáveis do diretório original preservado. Não exclua o original como parte da troca. Essa volta perde as alterações feitas somente na instância restaurada depois da troca; reconcilie os dados antes de qualquer reversão operacional.

O comando `db:synthetic:restore` existente tem outra finalidade: recupera o marker de uma **mesma instância** após snapshot do ambiente que mudou seu inode. Ele não restaura backups de dados e não substitui `db:restore`.

## Rotina sugerida antes da publicação

1. Crie um pacote antes de atualizações e antes de migrações; guarde a versão de código correspondente.
2. Defina frequência e retenção conforme a perda de dados aceitável. Exemplo inicial: cópia diária, sete diárias e quatro semanais, ajustadas ao uso.
3. Mantenha uma cópia externa privada, com criptografia e acesso restrito, no provedor escolhido. Cópia no mesmo disco não protege contra perda dessa máquina.
4. Faça ensaio de restauração em nova instância e confira os resultados após cada mudança no procedimento.
5. Registre os horários, tamanhos, identificadores dos pacotes e resultado da conferência, sem senhas ou tokens. Meça o tempo de restauração com o volume real antes de definir um prazo operacional.

Agendamento, retenção automática, armazenamento externo, gestão de chaves e garantias de RPO/RTO dependem da hospedagem. Não foram presumidos ou configurados sem essa definição.

## Testes

```bash
npm run test:backup
```

A suíte usa apenas fixtures próprias e verifica snapshot com a origem aberta, escritor concorrente sem transação parcial, dados restaurados e schema completo, nova identidade, revogação de sessão anterior e novo login, preservação de origem/pacote, destinos existentes, caminhos protegidos, corrupção, identidade forjada, symlinks/hardlinks/permissões, auxiliares externos, falha de backup e rollback de auditoria da restauração. Não exige rede ou acesso a bancos reais.

As opções completas dos comandos estão em `npm run db:backup -- --help` e `npm run db:restore -- --help`.
