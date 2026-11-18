# Identidade visual — Rally das Tribos

O tema segue a composição da referência fornecida: azul-marinho, painéis escuros com contorno ciano, destaques vermelhos, tipografia condensada e identidade das tribos. Os dados, as permissões e os fluxos existentes foram preservados. A referência contém provas e um ranking visível para líderes; essas funções não foram reintroduzidas, respeitando as decisões anteriores do projeto.

## Arquivos principais

- `frontend/public/css/app.css`: estrutura e componentes de base.
- `frontend/public/css/style.css`: cores, fontes, identidade, layouts, responsividade e impressão.
- `frontend/public/js/marca.js`: marca tipográfica do projeto.
- `frontend/public/js/emblemas.js`: associação dos emblemas às tribos.
- `frontend/public/img/tribos/`: emblemas fornecidos pelo usuário, otimizados em WebP.
- `frontend/public/fonts/`: fontes locais, com suas licenças SIL Open Font License.

## Fontes e imagens

Bebas Neue para títulos e destaques, Montserrat para identidade e chamadas, Inter para textos e controles. As fontes são servidas localmente, sem dependência do Google Fonts em tempo de uso. Licenças em `frontend/public/fonts/*-OFL.txt`.

Os 12 emblemas enviados incluem Rúben, Simeão, Issacar, Naftali, Levi, Gade, Zebulom, Efraim, Manassés, Benjamim, Aser e Judá. O ZIP não contém Dã; a interface usa uma identificação textual para essa tribo. Não foi inventado um novo emblema.

O fundo fotográfico é ilustrativo e não representa um encontro real da FJU. Fonte: Unsplash, fotografia `photo-1540575467063-178a50c2df87`, https://images.unsplash.com/photo-1540575467063-178a50c2df87. Licença: https://unsplash.com/license. O tratamento azul e as faixas diagonais são aplicados com CSS.

## Dispositivos com menos recursos

- 12 emblemas em WebP, aproximadamente 121 KB somados; cada imagem é carregada sob demanda.
- Fundo em WebP, aproximadamente 28 KB.
- Sem vídeo de fundo, bibliotecas de interface, efeitos contínuos ou filtros de desfoque.
- Chart.js é solicitado apenas por telas que exibem gráficos. Login e área dos cabeças não o carregam.
- Menu lateral a partir de 1000 pixels e navegação inferior abaixo dessa largura.
- Preferência de movimento reduzido respeitada e controles de formulário com pelo menos 44 pixels.
- Impressão de relatórios usa fundo branco e texto escuro.

## Validação

26 testes do backend aprovados. A verificação automatizada no Chromium percorreu 124 verificações de rotas e fluxos, nas larguras de 320, 390, 768, 1024 e 1440 pixels: sem erros de JavaScript, arquivos faltantes ou rolagem horizontal da página. Não foram realizadas requisições externas durante o uso da aplicação. Também foram verificados pesquisa de tribos, seleção de participantes no novo rally, envio do relatório semanal e impressão clara. Os testes simulam tamanhos de tela; não equivalem a uma medição em aparelhos físicos de pouca memória.
