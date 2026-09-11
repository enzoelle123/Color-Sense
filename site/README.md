# Guia do ColorSense

Página com o passo a passo de instalação e a explicação de cada função do app,
publicada em https://colorsense-guia.vercel.app. É um único `index.html`, sem
etapa de build.

## Publicar uma alteração

Não há deploy automático: um commit nesta pasta **não** atualiza o site.
Depois de alterar o `index.html`, publique de dentro desta pasta:

    npx vercel --prod

É preciso ter acesso ao projeto `colorsense-guia` na Vercel.

Os links de download apontam para os arquivos da release `v0.2.0` deste
repositório. Ao lançar uma versão nova, atualize esses links no `index.html`.
