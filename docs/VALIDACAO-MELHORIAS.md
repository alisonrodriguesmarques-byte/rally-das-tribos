# Validação desta versão

- 19 testes automatizados aprovados: tribos, permissões de admin/cabeça/auxiliar/participante, sigilo da pontuação, relatórios, validação, duplicidade, envio, conferência, devolução, exportação, rally encerrado e migração com preservação do histórico.
- Chromium: 28 verificações de rotas e fluxos, sem erros de console/JavaScript. Rascunho persistiu após recarregar; envio bloqueou edição; auxiliar acessou a mesma semana; admin conferiu e devolveu; exportações funcionaram.
- Larguras verificadas: 320, 390 e 1280 pixels, sem transbordamento horizontal na tela do relatório.
- Modelo preenchido no teste: 15 novas + 10 afastadas = 25; corrigido para 34 após devolução.
- Banco recebido: 17 pessoas, 2 usuários, 52 lançamentos e 16 vínculos de participantes preservados. Ambos os rallies passaram a ter 13 tribos. Relatórios de teste não foram incluídos no banco de entrega.
- Integridade SQLite e chaves estrangeiras verificadas.
- Iniciador Node executado no ambiente Linux com sucesso. O arquivo INICIAR.bat usa o mesmo iniciador, mas não foi executado em Windows neste ambiente.

O ZIP não inclui node_modules, pois o SQLite usa um módulo nativo específico de cada sistema. O iniciador instala as dependências corretas no computador do usuário com Node 24 e conexão à internet na primeira execução.
