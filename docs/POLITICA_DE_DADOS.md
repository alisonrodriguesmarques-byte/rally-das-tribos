# Política de dados — proposta para aprovação

**Não aprovada.** Prazos, base legal e responsabilidades são decisões pendentes; não se afirma prazo legal. Aplicabilidade da LGPD e eventual consentimento deve ser validada pelo responsável jurídico/privacidade.

## Princípios propostos

- Coletar só dados necessários à participação, operação e segurança; evitar documentos, endereço, data de nascimento completa e dados sensíveis sem necessidade demonstrada.
- Participantes podem ser menores. Definir base legal e participação dos responsáveis antes de coleta; restringir acesso a cadastro identificável. Ranking público nunca apresenta nomes de menores; usar nome de equipe, pseudônimo ou agregação após avaliação de reidentificação.
- Separar dados de conta, perfil de participante, participação no Rally, pontuação e trilha de auditoria. Acesso por função e registro de operações administrativas.
- Não usar bancos reais em desenvolvimento/testes. Fixtures sintéticas; exportações e logs sem dados pessoais desnecessários.

## Retenção e opções

| Dado | Opções a decidir | Recomendação |
|---|---|---|
| conta e contato | manter enquanto ativo; excluir após encerramento; prazo definido pelo controlador | manter mínimo enquanto necessário, revisar periodicamente; prazo pendente |
| participação e resultado | identificação completa; pseudonimizada; agregada | preservar resultado operacional com identificador pseudônimo quando não houver necessidade de identificação |
| auditoria | retenção integral; anonimização controlada; descarte por prazo | preservar eventos sem cascata; anonimizar campos pessoais de forma controlada e auditada |
| logs técnicos | curto prazo operacional ou prazo maior para incidente | minimização, acesso restrito e prazo formal pendente |
| backups | ciclos e expurgo | definir ciclo, acesso, criptografia e expiração junto com infraestrutura |

## Direitos e incidentes

Definir canal para solicitações de titulares/responsáveis, correção, acesso, eliminação/anonimização quando aplicável, verificação de identidade proporcional e registro de atendimento. Incidentes devem ter responsável, triagem, contenção e avaliação de comunicação conforme orientação especializada vigente.

Anonimização de dados pessoais é operação controlada, revisada e registrada como evento auditável; não apagar trilha por cascata. A pseudonimização não equivale necessariamente à anonimização. Registrar minimamente base e finalidade por campo.

## Aprovações necessárias

Controlador/responsável, base legal por finalidade e menores, campos coletados, audiência do ranking, períodos de retenção e backup, processo de anonimização, canal de direitos e responsáveis por incidentes. Nenhum prazo legal é inventado neste documento.
