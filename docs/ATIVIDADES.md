# Missões e provas — etapa 6

Esta etapa acrescenta as telas **Missões** e **Provas**, com entregas, revisão administrativa e pontuação integrada ao ranking da edição. Funciona com o ambiente sintético Linux existente. Execute `npm run init-db` para aplicar a migração 013 sem recriar o banco. As migrações anteriores e os resultados históricos são preservados.

## Preparar as contas e equipes

Crie e aprove a conta em **Contas e acessos**. Cadastre a pessoa e seu vínculo em **Equipes**. Em **Missões**, selecione a edição e abra **Associar conta a uma pessoa da equipe** para associar explicitamente a conta aprovada à pessoa correta. Não há correspondência automática por nome ou email. Uma pessoa só pode ter uma conta, e uma conta só pode identificar uma pessoa; a associação não pode ser reatribuída por essa tela ou API.

As permissões das atividades usam o vínculo ativo na edição, incluindo o papel atual de cabeça ou auxiliar. O perfil geral da conta, sozinho, não concede acesso à tribo. Contas administrativas organizam e revisam atividades; as respostas e entregas usam contas de integrantes associadas a pessoas.

## Missões

O administrador define título, descrição, tribos destinatárias, abertura, encerramento e pontos fixos de 1 a 1.000.000. Salve o rascunho, revise e publique. Os horários são apresentados no fuso do navegador e enviados à API com fuso explícito; o servidor verifica os instantes.

Somente cabeça e auxiliar com vínculo ativo na própria tribo podem enviar o relato ou comprovação em texto, com até 3.000 caracteres. A edição precisa estar ativa, a missão publicada e aberta e o horário dentro do período. Não há upload de arquivos nesta entrega.

Cada tribo pode ter uma entrega pendente ou aprovada por missão. A entrega pendente não soma pontos. O administrador registra aprovação ou rejeição com motivo. A aprovação concede os pontos fixos; a rejeição permite nova entrega dentro do prazo, preservando as anteriores. Uma decisão final não pode ser reescrita. Encerrar a missão impede novas entregas; entregas pendentes ainda podem ser revisadas enquanto o Rally estiver ativo.

Cabeça e auxiliar consultam o conteúdo das entregas da própria tribo. Os demais integrantes veem somente o estado dessas entregas. O administrador consulta todas as entregas da edição.

## Provas objetivas

Modalidades implementadas: **quiz**, **verdadeiro ou falso** e **complete o versículo**. Cada prova tem de 1 a 20 questões, valor inteiro positivo por questão e soma máxima de 1.000.000 pontos. Quiz aceita de duas a seis alternativas. Referência bíblica e dificuldade podem ser informadas por questão; a tradução é obrigatória para completar versículos.

O administrador escolhe em cada prova:

- **Cada integrante**: cada pessoa ativa das tribos destinatárias pode responder uma vez. Os pontos de cada pessoa somam para sua tribo.
- **Um representante por tribo**: somente a pessoa explicitamente selecionada pode responder. O representante pode ser qualquer integrante ativo da tribo. A substituição exige motivo e só é permitida antes de a tribo iniciar uma tentativa.

Há uma tentativa por respondente, com encerramento geral e limite opcional de 1 a 180 minutos. Iniciar reserva a tentativa; sair da página não interrompe o tempo. É possível retomar uma tentativa inacabada até seu prazo. O prazo efetivo é o menor entre o encerramento geral e o tempo individual. O servidor controla o prazo e recusa envios tardios. Todas as questões devem ser respondidas no envio final; não há salvamento parcial de respostas no navegador.

Os gabaritos são enviados somente ao administrador. Integrantes recebem as questões ao iniciar ou retomar a tentativa, sem respostas corretas ou variações aceitas. A correção ocorre no servidor, sem aceitar nota, aprovador ou tribo escolhidos pelo cliente. Completar versículos compara o trecho com o gabarito e variações explícitas, ignorando maiúsculas/minúsculas e espaços repetidos, mas preservando acentos. O resultado mostra a pontuação total, sem expor o gabarito.

Regras, gabaritos e destinatários ficam fixos após a publicação. Alterações em integrantes continuam permitidas; se o vínculo mudar durante uma tentativa, ela não poderá ser concluída nem reiniciada para obter outra chance. Resultados e pontos anteriores permanecem ligados à tribo de origem. A tela do integrante acompanha seu vínculo ativo; o administrador mantém a consulta ao histórico completo da edição.

## Pontuação e histórico

Aprovação de missão, lançamento dos pontos, histórico e auditoria compartilham uma transação. Nas provas, respostas, correção, resultado, pontos e auditoria também são confirmados juntos. Falha em qualquer etapa desfaz tudo. O ranking administrativo passa a considerar os pontos assim que a operação termina; reabrir **Pontos e ranking** consulta os valores atuais.

Cada resultado de origem só pode gerar uma premiação. Repetir a mesma aprovação ou as mesmas respostas retorna o resultado já registrado, sem somar novamente; alterar uma decisão final ou respostas já concluídas gera conflito. Resultado zero é preservado, sem inserir um lançamento positivo. Entregas, tentativas concluídas, respostas finais e auditoria são preservadas por controles no banco. Não há exclusão pelo fluxo.

Edições legadas, encerradas, arquivadas ou canceladas são somente consulta. A tela anterior de correção compensatória continua disponível para lançamentos **manuais**; revisão ou estorno de resultados de atividades não está implementado nesta etapa. Perguntas abertas, associação, ordenação, avaliações manuais de provas, tentativas extras e pontuação de missão por quantidade/meta ficam para entregas posteriores.

## API

Todas as rotas abaixo ficam sob `/api/atividades`, exigem sessão ativa/aprovada e, nas mutações, `X-CSRF-Token`. Gestão, publicação, associações e revisões exigem administrador. Entregas e respostas usam autorização por vínculo na edição.

| Método e caminho | Operação |
|---|---|
| GET `/edicoes` | Edições acessíveis ao usuário |
| GET/POST `/vinculos` | Listar pessoas/contas ou associar conta à pessoa |
| GET/POST `/missoes/edicao/:rally` | Consultar missões ou criar rascunho |
| PUT `/missoes/edicao/:rally/:id` | Editar rascunho |
| POST `/missoes/:id/publicar` ou `/encerrar` | Transição explícita |
| POST `/missoes/:id/entregas` | `{tribo_id, conteudo}` |
| POST `/entregas/:id/revisar` | `{decisao: "aprovada" ou "rejeitada", motivo}` |
| GET/POST `/provas/edicao/:rally` | Consultar provas ou criar rascunho |
| PUT `/provas/edicao/:rally/:id` | Editar rascunho |
| POST `/provas/:id/publicar` ou `/encerrar` | Transição explícita |
| PUT `/provas/:id/representantes` | `{tribo_id, participante_id, motivo}` |
| POST `/provas/:id/iniciar` | Iniciar/retomar e obter questões permitidas |
| POST `/tentativas/:id/respostas` | `{respostas: [{questao_id, resposta}]}` |

Configuração de missão: `{titulo, descricao, pontos, abre_em, encerra_em, tribos_ids}`. Configuração de prova: `{titulo, descricao?, tipo_prova, respondedor, abre_em, encerra_em, tribos_ids, representantes?, questoes, traducao?, tempo_limite_minutos?}`. Datas usam ISO 8601 com fuso; identificadores e pontos no corpo são números inteiros.

Questão: `{enunciado, pontos, correta, alternativas?, variacoes?, referencia?, dificuldade?}`. `correta` e a resposta do integrante são índice numérico começando em zero para quiz, booleano para verdadeiro/falso e texto para versículos. `representantes` contém pares `{tribo_id, participante_id}`. Associação de conta: `{participante_id, usuario_id, motivo}`. Campos extras são recusados. O limite JSON dessas rotas é 128 KiB; as demais mantêm 16 KiB.

## Validação

`npm test` inclui a suíte funcional de atividades em banco independente. Verifica papéis, escopo por tribo, proteção de gabaritos, decisões, correção das três modalidades, repetição/concorrência, prazos, transferência durante tentativa, regras publicadas, corpos de prova maiores, rollback após falha de auditoria e preservação de históricos.

`npm run test:activities:ui` usa Playwright/Chromium disponíveis no ambiente. Exercita associação explícita, criação/edição/publicação de missão e quiz, entrega, aprovação, resposta, ranking, celular e logout com contas e banco temporários próprios.
