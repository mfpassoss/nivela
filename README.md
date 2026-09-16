# Nivela

Player estilo DJ que roda no navegador, sem instalar nada. Ele lê as músicas direto do computador, **nivela o volume de todas as faixas**, identifica o estilo (sertanejo universitário, sofrência, modão, pagode, forró…) e toca aleatório por estilo com emenda automática entre as músicas.

## Como usar

1. Abra o link publicado (veja "Instalar" abaixo) ou o arquivo `index.html` no **Chrome** ou **Edge**.
2. Clique em **+ Pasta** e escolha a pasta de músicas. Também dá para arrastar pastas ou arquivos para a tela.
3. Espere a barra de status dizer "tudo nivelado". Cada música é analisada uma única vez e o resultado fica guardado no navegador.
4. Marque os estilos que quer ouvir e clique em **▶ Aleatório**. Sem marcar nada, toca tudo.

Na próxima vez que abrir, clique em **Reconectar biblioteca**: o Chrome pede permissão para a pasta de novo e tudo volta sem precisar analisar outra vez.

## O que ele faz com o volume

Cada faixa é medida pelo padrão ITU-R BS.1770 (LUFS), o mesmo que Spotify e YouTube usam. O player aplica um ganho por faixa para que todas cheguem ao mesmo alvo (padrão -14 LUFS, ajustável no painel Master), com um limitador na saída para nada estourar. A coluna "LUFS / ajuste" da biblioteca mostra o volume medido e a correção aplicada.

## Como ele identifica o estilo

Na ordem: artista conhecido (base com centenas de artistas brasileiros e internacionais) → tag de gênero do MP3 → palavras no nome do arquivo ou da pasta → artista no nome do arquivo. "Sertanejo" genérico é separado em sofrência ou universitário pelo BPM. Quando não há pista, a música vai para "Não identificado" e pode ser classificada manualmente no menu da coluna Estilo. A escolha manual é guardada.

## Playlists

Crie uma playlist em **+ Nova**, selecione-a e use o botão **+** de cada música na biblioteca. A playlist toca em ordem ou aleatório.

## Instalar como aplicativo

O Nivela é um PWA. Abrindo o link publicado no Chrome ou Edge (PC ou Android), aparece o botão **⤓ Instalar app** no topo (ou o ícone de instalar na barra de endereço). Ele passa a abrir em janela própria, com ícone na área de trabalho ou na tela inicial, e funciona sem internet. No iPhone: Safari → Compartilhar → "Adicionar à Tela de Início".

Atualizações chegam sozinhas: ao abrir o app com internet, a versão nova é baixada e um aviso pede para recarregar.

## Publicar

O workflow em `.github/workflows/pages.yml` publica no GitHub Pages a cada push na branch padrão. O GitHub Pages exige repositório público em contas gratuitas.

## Formatos e navegadores

MP3, M4A/AAC, OGG, OPUS, WAV e FLAC (o que o navegador souber decodificar). No Chrome e Edge a biblioteca fica lembrada entre sessões. Firefox e Safari funcionam, mas é preciso adicionar a pasta a cada abertura (a análise fica guardada mesmo assim).

## Estrutura

- `index.html`, `css/style.css`: interface.
- `js/tags.js`: leitura de tags ID3 (título, artista, gênero, capa).
- `js/genres.js`: base de artistas e regras de classificação.
- `js/analyzer.js`: loudness (BS.1770), pico, forma de onda e BPM.
- `js/player.js`: dois decks, crossfade, ganho por faixa, limitador e medidor.
- `js/db.js`: persistência local (IndexedDB).
- `js/app.js`: importação, fila de análise, estilos, playlists e fila de reprodução.
