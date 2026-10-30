# Arquitetura proposta

**Proposta para revisão; depende de aprovação antes de qualquer implementação/migration.** O sistema atual é Node.js/Express + SQLite, backend parcial, frontend placeholder e sem autenticação efetiva (auditoria estática). Não presumir funcionalidades como prontas.

## Domínio

- Rally tem estados planejamento → ativo → encerrado → arquivado, ou planejamento → cancelado. Transições são explícitas e auditáveis.
- **Proposta pendente:** catálogo global `tribos` e relação de participação Rally–tribo com exatamente duas tribos distintas selecionadas no planejamento e congeladas ao iniciar. Incluir marca explícita `legado` no Rally. Rally histórico de 12 tribos é preservado sem conversão automática.
- Membros vinculam participante a participação da tribo; validar unicidade de participação conforme Rally e período.
- Pontuações referenciam Rally, participação/tribo e origem válida. Origem de quiz continua exclusivamente automática; origem cadastrada e compatível com estado; texto livre só para lançamento administrativo comum, validado no servidor e, se possível, banco.

## Identidade, autorização e privacidade

- Contas novas pendentes de aprovação. Senhas somente com hash robusto; sessões protegidas, expiração e proteção CSRF conforme transporte escolhido.
- Papéis propostos: administrador, líder, auxiliar e participante, com menor privilégio. Só administrador pode lançar pontos manualmente e consultar ranking administrativo. Toda rota privada autentica e autoriza no servidor.
- Primeiro administrador: comando administrativo de uso único com segredo de inicialização fornecido pelo operador, falha se já houver admin, desativa após uso e registra auditoria.
- Participantes podem ser menores: coleta mínima e ranking público sem nomes de menores. Campos públicos separados de cadastro interno.

## Pontuações e auditoria

- Estados explícitos por lançamento: pendente, aprovado, rejeitado, estornado (proposta a aprovar); ranking considera somente aprovado. Revisão individual por linha em lote, com ator, instante, motivo e estado anterior/novo.
- Auditoria append-only lógica, sem exclusão em cascata. Exclusão/anonimização de dados pessoais preserva evento auditável sem reter identificadores desnecessários. Nenhuma operação destrutiva automática.
- Migrações futuras devem ocorrer apenas em banco sintético descartável, após aprovação; pontuações antigas ficam somente em consulta até decisão de tratamento.

## Persistência e segurança operacional

SQLite é fechado até gate de segurança aprovado. Banco dev criado por comando explícito fora de `data\`, sem sobrescrita sem flag explícita. Em abertura futura, `foreign_keys=ON`, timeout e modo de journal documentados. SQL parametrizado; migrations em lista fechada e com checksum; erros externos genéricos, detalhes apenas em log protegido. CORS com origens explícitas.

## Decisões pendentes

Aprovar catálogo/participação/legado; papéis e fluxo de aprovação; estados de pontuação e política de estorno; mecanismo de sessão; campos e retenção; formato de identificação pública de menores; desenho e validação do primeiro admin; estratégia de migração somente em cópia descartável.
