# Rally das Tribos — FJU

Esta versão inclui as melhorias solicitadas: seleção das tribos participantes a partir do catálogo de 13 tribos, pontuação reservada ao administrador e relatório semanal de almas. Requer Node.js 24. O repositório contém o código e as migrations; os arquivos privados de configuração e banco não são publicados.

Antes de iniciar, copie `backend/.env.example` para `backend/.env` e preencha `ADMIN_PASSWORD` (pelo menos 8 caracteres) e `JWT_SECRET` com valores definidos localmente. Para gerar o segredo de sessão, execute localmente `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

No Windows, execute **INICIAR.bat**. No VS Code, abra a pasta e execute `node scripts/iniciar.cjs`. O endereço padrão é http://localhost:3000. Para instalar manualmente: `npm run setup` na raiz e depois `npm start`.

## Funcionalidades

- Catálogo com 13 tribos, incluindo Levi, Manassés e Efraim. Ao criar um rally, o admin deve marcar quais participarão; nenhuma vem marcada automaticamente. É possível selecionar uma, algumas ou todas. A antiga José foi renomeada para Manassés, preservando vínculos e histórico. Efraim foi adicionada aos rallies existentes.
- Ranking e pontuações apenas para o administrador, inclusive nas respostas da API, perfis, entregas, gráficos e exportações.
- Missões e entregas, cadastro de pessoas, liderança e lançamento manual de pontos.
- Relatório de almas semanal: segunda, quarta, quinta, sexta e sábado. Novas, afastadas e totais calculados pelo servidor.
- Cabeças e auxiliares preenchem somente a própria tribo, salvam rascunhos e enviam. Um relatório por tribo e semana.
- Admin acompanha o resumo, tribos sem envio, confere ou devolve para correção. Pode exportar TXT, CSV, copiar o texto e imprimir/salvar PDF.
- Provas, quizzes e dinâmicas foram retirados das telas e da API. As tabelas antigas e seus pontos históricos foram mantidos para preservar os dados existentes.

## Relatórios e pontuação

Uma semana vai de segunda a domingo; o formulário contém as cinco reuniões do modelo fornecido. As contagens são de presenças em reuniões: uma pessoa que veio em mais de uma reunião conta em cada uma. Rascunhos não entram no resumo geral. O envio e a conferência não criam pontos automaticamente; o admin usa **Lançar pontos** e escolhe o valor.

Os períodos são filtrados por rally e semana. Os totais, a tribo e o responsável são verificados no servidor. Relatórios enviados precisam ser devolvidos pelo admin antes de qualquer correção. Rallies encerrados permitem consulta, mas não alterações.

## Configuração e dados

O arquivo `backend/.env` e o banco `backend/data/rally.sqlite` são locais e ignorados pelo Git. O servidor executa migrations e seeds automaticamente. Em banco novo, cria o catálogo de 13 tribos, as categorias e o administrador configurado. Em um banco existente, a migração preserva os dados, renomeia José para Manassés, adiciona Efraim e cria a tabela de relatórios. Não versione arquivos `.env` nem o banco.

Para preservar os dados de uma instalação anterior, pare o servidor, mantenha uma cópia de segurança e reutilize o arquivo de banco local e sua configuração `.env` na pasta da versão atualizada. O download do GitHub não inclui esses arquivos privados.

Os dados fictícios de exemplo podem ser recriados, em banco sem rallies, com `python scripts/demo.py` (Python 3, servidor em execução). O script solicita as senhas sem exibi-las e é opcional; o funcionamento normal do sistema não requer Python.

`docs/arquitetura.html` e `docs/schema-original.sql` são referências da versão anterior. O esquema em uso está nas migrations do backend; a migração 002 adiciona o relatório e atualiza as tribos. A antiga dependência npm chamada `python3` foi removida da raiz: o funcionamento normal do sistema não requer Python.

## Testes

Instale as dependências com `npm run setup` e execute `npm test`. Os testes cobrem permissões, sigilo da pontuação, relatórios, exportações, validações, envio duplicado, correções e migração com preservação dos dados.

## Tribos de cada rally

Em **Mais → Rallies → Novo rally**, marque as tribos participantes. Use **Selecionar todas** ou **Limpar seleção** se desejar. A criação exige pelo menos uma tribo, inclusive pela API (`POST /api/rallies`, campo `tribos`: lista de IDs do catálogo disponível para admin em `GET /api/tribos`). A seleção define as tribos do ranking, painel e relatórios. A cópia de líderes e participantes considera somente as tribos marcadas. Rallies existentes mantêm sua composição ao editar o nome ou as datas.
