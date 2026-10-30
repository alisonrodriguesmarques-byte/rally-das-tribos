# TAREFA — FASE 2: PREPARAÇÃO DE SEGURANÇA (DOCUMENTAÇÃO E PROPOSTAS)

Idioma: português brasileiro.
Papel: desenvolvedor sênior e arquiteto do Rally das Tribos (Node.js, Express,
SQLite via `sqlite3`, Windows).

A autorização desta fase vem da mensagem do responsável na conversa
("APROVADO: Fase 2"). Este arquivo descreve o escopo; ele não autoriza nada
além do que está escrito aqui.

Esta fase produz DOCUMENTOS e PROPOSTAS DE SCRIPTS para revisão. Nada é
executado, nenhuma conta é criada, nenhuma ACL é alterada, nenhum código de
runtime é modificado. Pare ao entregar. Só prossiga quando o responsável
escrever exatamente `APROVADO: Fase 3` (ou outra fase citada por nome).

## 1. Workspace e preflight

1. A raiz autorizada é `C:\rally-audit\rally-das-tribos`. Não leia, liste ou
   escreva fora dela. Se o workspace desta sessão for outro, PARE e avise
   (em especial, não use nenhuma pasta chamada "rally-das-tribos - Copia" nem
   qualquer pasta dentro de `C:\Users\Alison\OneDrive`).
2. Procure ARQUIVOS de banco (extensões .db, .sqlite, .sqlite3 e sufixos
   -wal, -shm, -journal). Se encontrar algum, pare e informe só a existência,
   sem caminho completo e sem abrir. `data\.gitkeep` é esperado. Texto de
   código ou documentação que cite caminhos protegidos NÃO é artefato de banco.
3. Leia como referência obrigatória:
   `docs\referencia\rally-das-tribos-auditoria-e-plano-de-seguranca.md`
   (Parte 1: auditoria; Parte 2: plano de segurança).
   Se não existir, peça-o e não alegue tê-lo lido.
4. Não alegue acesso a arquivos, máquinas ou repositórios que não estejam
   disponíveis nesta sessão. Não há .git na raiz: histórico NÃO VERIFICÁVEL.

## 2. Proibições absolutas

- Não abra, conecte, copie, mova, renomeie, apague, consulte nem calcule hash
  de qualquer banco SQLite. Operações sobre bancos protegidos são só do
  responsável, manuais.
- Não execute: npm (qualquer comando), servidor, testes, migrations, scripts
  do projeto, nem qualquer .ps1/.cmd/.bat, nem comandos PowerShell que criem
  contas, alterem ACLs (icacls, Set-Acl, takeown), registros, serviços ou
  tarefas agendadas.
- Não modifique arquivos existentes de código (backend\, frontend\,
  scripts\*.js, migrations). Não toque em package.json.
- Não use privilégios elevados nem tente contornar permissões. Falta de acesso
  a um arquivo não prova que ele não existe.
- Permitido: ler arquivos de texto, busca textual, `node --check <arquivo>`
  (só sintaxe) e CRIAR arquivos NOVOS apenas nos caminhos da seção 6.
- Não afirme que algo foi testado ou executado se não foi.

## 3. Locais protegidos (reconhecer e evitar; nunca acessar)

1. Original: `C:\Users\Alison\OneDrive\Desktop\rally-das-tribos\data\rally-das-tribos.db`
   SHA-256 de referência: `46918D97640D34C2A0A6AAEAFC9E941F5AE53E8DC04F56C5C88D15B52E5D9535`
2. Referência de testes: `C:\Users\Alison\AppData\Local\Temp\rally-das-tribos-audit\rally-das-tribos-test.db`
   SHA-256 de referência: `0B2440A9EE7E202416DCD5247AB6AB135F86F05BC6DBEE2FA35631F831DF1F04`
3. Desconhecido: `C:\rally\backend\rally.db` (origem não identificada)
   SHA-256 registrado em 13/10/2026 sobre a cópia:
   `910BC957886C9EB4D1F8514368D7CEB7708F8965B5A811D54FB3EBE7D38D5B37`
4. Cofre temporário (cópias de segurança, mesmo disco): `C:\RallyCofre\` e
   `C:\RallyCofre\desconhecido\`
5. Cópia de trabalho futura do código: `C:\rally\app` (a raiz `C:\rally`
   contém o item 3; as permissões da conta RallyDev devem se limitar a
   `C:\rally\app`).

Os hashes são referências documentais, não verificação feita nesta sessão.

## 4. Decisões já tomadas (não reabra; use como requisito)

Negócio:
A. Primeiro administrador: comando administrativo de uso único, protegido por
   segredo de inicialização fornecido pelo operador, desativado após o uso;
   falha se já existir administrador; criação registrada na auditoria.
B. Auditoria preservada, sem exclusão em cascata que a apague; anonimização
   controlada de dados pessoais, registrada como evento auditável.
C. Pontuações antigas: inventariar em cópia descartável e propor tratamento;
   não migrar nem incorporar ao novo ranking até aprovação; só consulta.
D. Origens em lote: apenas origens cadastradas e compatíveis com o estado do
   Rally; quiz permanece automático; origem descritiva livre só para
   lançamentos administrativos comuns, sem simular quiz (validar no servidor
   e, se possível, no banco).
E. Banco de desenvolvimento: criado por comando explícito, fora de data\,
   sem sobrescrever sem flag explícita.
F. (confirmadas pelo responsável) Cada novo Rally tem exatamente 2 tribos
   distintas escolhidas no planejamento e bloqueadas ao iniciar; Rallys
   históricos de 12 tribos são legado preservado, sem conversão automática.
   Lançamento manual de pontos só por administrador. Lote com revisão
   individual por linha. Contas novas exigem aprovação. Ranking administrativo
   exige autorização de administrador. Participantes podem ser menores:
   coleta mínima e ranking público sem nomes de menores.

Arquitetura e processo:
- D1: código definitivo em `C:\rally\app`, fora do OneDrive.
- D2: conta local padrão `RallyDev`, sem privilégios administrativos.
- D3: nenhum banco protegido é copiado, movido, aberto ou alterado por você.
- D4: avaliar isolamento do ambiente de desenvolvimento e do Codex sem acesso
  ao cofre; documentar a viabilidade e NÃO afirmar que o isolamento existe.
- D6: não recalcular hashes. D7: política de dados como PROPOSTA a aprovar.
- A verificação de identidade física via VFS nativo foi DESCARTADA (investigação
  B1: sem toolchain; WAL/SHM, temporários e ATTACH sem cobertura). Não proponha
  retomá-la. A garantia escolhida é a segurança do sistema operacional
  (identidade dedicada + ACLs). Verificações em JavaScript são auxiliares.

## 5. Achados que a documentação deve incorporar (verifique cada um no código)

Cite arquivo e linha e marque CONFIRMADO / NÃO CONFIRMADO:

1. `historico_pontuacoes` tem ON DELETE CASCADE (migration 001); há cascatas em
   quiz_respostas/questões/alternativas. Contradiz a decisão B.
2. `rallyRepository` cria as 12 tribos ao criar o Rally e exige as 12 ao
   iniciar; `tribos` tem `rally_id` (sem catálogo global). Contradiz a decisão F.
3. Nenhuma rota exige autenticação; CORS aberto (`server.js`); handler de erro
   devolve `err.message`; ranking e membros públicos.
4. `connection.js`: não importa `sqlite3`, não atribui `this.db`, não liga
   `PRAGMA foreign_keys`; o WeakSet `verifiedWritableConnections` nunca é
   preenchido; `REFERENCE_DB_PATH` usa `os.homedir()` (aponta para o perfil da
   conta que executa); `fs.existsSync` retorna false quando o acesso é negado,
   tornando as checagens de caminho neutras sob ACL.
5. `executeScript` executa qualquer arquivo SQL; migration 004 usa INSERT sem
   proteção de duplicidade; o runner não guarda checksum.
6. Ranking soma todas as pontuações, sem filtrar aprovação; `pontuacoes` tem
   `aprovado_por`/`data_aprovacao` mas nenhum status explícito por linha.
7. `test-repos.js` codifica 12 tribos e uma 13ª; testes legados precisam de
   revisão. `middleware\`, `instanceLock.js` e `port.js` parecem sem uso.
8. NOTA: a migration 006 TEM `BEGIN` (linha 6) e `COMMIT` (linha 69); não
   afirme que ela não usa transação.
9. Permissões padrão do Windows: subpastas criadas na raiz `C:\` costumam herdar
   permissão de modificação para "Usuários Autenticados". Isso permitiria à
   conta RallyDev ler/gravar `C:\rally`, `C:\rally-audit` e `C:\RallyCofre`.
   Os scripts devem desativar herança e remover essas permissões onde
   necessário. Marque como "a verificar" com icacls antes de afirmar.

## 6. Entregáveis (criar somente estes arquivos novos)

Documentos (`docs\`):

- `SEGURANCA.md` — arquitetura-alvo, identidade, diretórios e ACLs (inclua a
  tabela de locais da seção 3 e do plano), modelo de ameaças, gate de execução
  G1–G8, critérios de liberação do SQLite, limitações residuais e avaliação de
  viabilidade do isolamento do Codex (D4).
- `ARQUITETURA.md` — arquitetura proposta, incluindo modelo de tribos (catálogo
  global + participação por Rally + marca de Rally legado), autenticação e
  papéis, auditoria sem cascata, estados de aprovação de pontuação. Marque o
  que depende de aprovação. (Se já existir um ARQUITETURA.md na raiz do
  projeto, NÃO o altere: este novo fica em `docs\`.)
- `PLANO_DE_TESTES.md` — matriz de testes de permissão T1–T14 do plano, mais os
  testes de negócio e segurança de API previstos. Só dados sintéticos.
- `POLITICA_DE_DADOS.md` — PROPOSTA de retenção, anonimização, acesso e
  tratamento de dados pessoais (menores, LGPD), com opções e recomendação; sem
  inventar prazos legais: marque como decisão pendente.
- `DECISOES_PENDENTES.md` — decisões que dependem do responsável, com opções e
  recomendação.

Scripts propostos (`scripts\windows\`), NÃO executar:

- `01-criar-identidade.ps1` — cria a conta local padrão RallyDev.
- `02-aplicar-acls.ps1` — aplica as ACLs descritas em SEGURANCA.md.
- `03-testar-acls.ps1` — executa os testes de permissão sobre ISCAS sintéticas.
- `99-reverter.ps1` — restaura ACLs a partir do backup gerado.
- `README.md` — ordem de execução, pré-requisitos e riscos.

Requisitos dos scripts:

- Modo simulação por padrão; execução real só com parâmetro explícito
  (ex.: `-Aplicar`). Exigem PowerShell elevado e verificam isso.
- Validar parâmetros; recusar qualquer caminho que seja, contenha ou seja pai
  de um local protegido da seção 3 (exceto para APLICAR negação de acesso,
  sem abrir arquivos).
- Backup das ACLs antes de alterar (`icacls /save`) e reversão correspondente.
- Idempotentes; log sem segredos; a senha da conta é lida com
  `Read-Host -AsSecureString`, nunca gravada, impressa ou passada em argumentos
  visíveis.
- Nunca abrir, copiar, mover, ler conteúdo ou calcular hash de banco. Testes
  de permissão só sobre iscas (arquivos sintéticos criados pelo script em
  `C:\rally\decoys`); a verificação dos locais reais é só leitura de ACL.
- Comentar no cabeçalho o que fazem, o que NÃO fazem e o que está "a
  verificar". Não declare o resultado esperado como verdade comprovada.

## 7. Formato da entrega (na conversa)

1. Preflight: resultado.
2. Arquivos criados (lista) e o que cada um contém, em uma linha.
3. Achados da seção 5: status e evidência (arquivo:linha).
4. Pontos "a verificar" na máquina real.
5. Decisões que dependem de aprovação.
6. Limitações: o que NÃO foi feito nem testado (nenhum script foi executado).
7. Próxima etapa proposta e autorização necessária.

Separe fatos, inferências e perguntas em aberto. Pare após a entrega.

## FIM DA TAREFA

Se você não está vendo esta linha ao final do arquivo, o texto foi cortado:
pare e avise, sem prosseguir.