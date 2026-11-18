# Render

Web Service Node 24; Root Directory vazio; Build: npm --prefix backend ci --omit=dev; Start: npm start.

PORT é fornecida pelo Render; o servidor escuta em 0.0.0.0. Configure NODE_ENV=production, JWT_SECRET, ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 8 caracteres).

Sem disco persistente: remova DB_FILE das variáveis ou use /tmp/rally.sqlite. O banco é temporário e pode desaparecer em reinicializações/deploys. O aplicativo registra esse aviso quando usa o padrão temporário.

Com disco persistente: monte o disco em /var/data e configure DB_FILE=/var/data/rally.sqlite. Apenas definir a variável não cria um disco. EACCES mkdir /var/data indica que o caminho não está disponível para escrita: confira a montagem no serviço. Não há troca automática de banco quando um caminho explícito falha, para evitar ocultar problemas de armazenamento.

Nenhum banco local é importado automaticamente. Não publique .env nem SQLite no GitHub.
