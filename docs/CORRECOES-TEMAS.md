# Correções de gráficos, emblemas e temas

- Paleta explícita para o gráfico de categorias, com cores distintas para as categorias existentes e para a categoria não informada.
- Redesenho das legendas e grades ao alternar o tema; animações desativadas para não deixar o gráfico em estado intermediário.
- Emblema de Dã com serpente e medalhão dourado, criado por geração digital com referência ao emblema de Judá enviado anteriormente.
- Seta SVG alinhada no botão Trocar rally, sem depender de glifo de fonte.
- Temas claro/escuro disponíveis antes e depois de entrar; preferência persistente no navegador, sem alterar o banco ou permissões.
- O fundo de reunião ainda não foi substituído: é necessário receber o banner original como arquivo para retirar apenas a marca FJU e o Instagram sem recriar a foto, conforme a última orientação do usuário.

Validação: 26 testes automatizados do backend; 80 verificações de rotas em ambos os temas, nas larguras de 320, 390, 768 e 1440 pixels; imagem de Dã carregada; preferência após recarregamento; legenda do gráfico atualizada; sigilo da pontuação para cabeças preservado. O teste de canvas confirma pixels das 11 cores distintas, inclusive após alternar o tema, e não apenas os dados de configuração do gráfico.
