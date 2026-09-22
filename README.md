# Nivela

### ▶ Abrir o player: **https://mfpassoss.github.io/nivela/**
### ⤓ Baixar para Windows: **[Releases](https://github.com/mfpassoss/nivela/releases/latest)**

---

Player estilo DJ que roda no navegador, sem instalar nada. Ele lê músicas **e clipes** direto do computador, **nivela o volume de todas as faixas**, identifica o estilo (sertanejo universitário, sofrência, modão, pagode, forró…) e toca aleatório por estilo com emenda automática entre as faixas.

## Como usar

1. Abra **https://mfpassoss.github.io/nivela/** no **Chrome** ou **Edge**.
2. Clique em **+ Pasta** e escolha a pasta de músicas. Também dá para arrastar pastas ou arquivos para a tela.
3. Espere a barra de status dizer "tudo nivelado". Cada música é analisada uma única vez e o resultado fica guardado no navegador.
4. Marque os estilos que quer ouvir e clique em **▶ Aleatório**. Sem marcar nada, toca tudo.

Na próxima vez que abrir, o Nivela reabre as pastas sozinho e já traz o que apareceu de novo nelas. Se o navegador tiver esquecido a permissão, use **Reconectar biblioteca**. As músicas já analisadas não são analisadas de novo.

## Clipes em vídeo

Clipe entra na mesma biblioteca e usa a mesma mesa: mesmo nivelamento de volume, mesmo aleatório por estilo, mesma emenda automática. Música e clipe se misturam na mesma sequência.

- **🖥 Tela de vídeo**: abre uma janela só com a imagem. Arraste para a TV ou projetor e aperte **Tela cheia** (ou tecle F, ou dê duplo clique). O som continua saindo pela janela principal.
- **Ajustar ou preencher**: por padrão o clipe aparece inteiro, com tarja preta quando o formato não bate com o da TV. O botão **Ajustar à tela** troca para preencher a tela toda, cortando as bordas. A escolha fica guardada.
- A imagem cruza junto com o som: quando um clipe emenda no outro, a imagem também faz a passagem.
- Quando a faixa é só música, a tela mostra um cartão com o nome de quem está tocando, em vez de ficar preta.
- Na janela da tela, **espaço** pausa e **seta para a direita** pula, sem precisar voltar para a janela principal. A barra de botões só some em tela cheia, e volta ao primeiro movimento do mouse.

**Formatos**: MP4 com H.264 e AAC (o formato da quase totalidade dos clipes) e WebM. **MKV, AVI, MOV e WMV não tocam** — o Nivela avisa na hora da importação, marcando a faixa como "não suportado" em vez de falhar na hora do evento. Converta para MP4 e ela entra.

## Biblioteca grande

Feito para milhares de músicas:

- **⟳ Reescanear**: procura arquivos novos nas pastas já adicionadas. Baixou um CD? Clique aqui (ou apenas reabra o programa) e ele entra.
- **⧉ Repetidas**: mostra as músicas que aparecem duas vezes (mesmo artista e título vindos de fontes diferentes). O **✕** de cada linha tira a música da biblioteca; o arquivo continua no computador.
- A lista carrega por partes conforme você rola, então abrir com 5.000 músicas é tão rápido quanto com 50.

### De onde tirar música legalmente

- **Palco MP3** e **Sua Música**: artistas independentes disponibilizam download gratuito. Baixe pelo site ou pelo aplicativo deles para a pasta que o Nivela acompanha. Prefira o perfil oficial do artista; coletâneas postadas por terceiros costumam não ser licenciadas.
- **CDs em .zip**: arraste o arquivo para a tela, sem descompactar. O Nivela abre o zip, lê as músicas de dentro e mantém os acentos do nome, inclusive em arquivos feitos por programas antigos do Windows. Guarde o zip numa pasta acompanhada e ele volta sozinho a cada abertura.
- **iTunes Store** e **Bandcamp**: compra de faixas avulsas, sem trava, nos formatos que o Nivela toca.

## O que ele faz com o volume

Cada faixa é medida pelo padrão ITU-R BS.1770 (LUFS), o mesmo que Spotify e YouTube usam. O player aplica um ganho por faixa para que todas cheguem ao mesmo alvo (padrão -14 LUFS, ajustável no painel Master), com um limitador na saída para nada estourar. A coluna "LUFS / ajuste" da biblioteca mostra o volume medido e a correção aplicada.

## Como ele identifica o estilo

Na ordem: artista conhecido (base com centenas de artistas brasileiros e internacionais) → tag de gênero do MP3 → palavras no nome do arquivo ou da pasta → artista no nome do arquivo. "Sertanejo" genérico é separado em sofrência ou universitário pelo BPM. Quando não há pista, a música vai para "Não identificado" e pode ser classificada manualmente no menu da coluna Estilo. A escolha manual é guardada.

## Escolher só música ou só clipe

Na linha da biblioteca há um seletor: **música e clipe**, **só música** ou **só clipe**. Ele vale para a lista e também para o que toca no aleatório, então dá para fazer um bloco só de clipe sem misturar com o resto. A escolha fica guardada e pode ser trocada no meio da festa: a fila é refeita na hora.

## Arrastar para os decks

Arraste qualquer faixa da biblioteca para cima de um deck:

- **Deck que está no ar** → toca agora, com a emenda de sempre.
- **Deck livre** (ou o campo **a seguir**) → entra como a próxima, sem cortar o que está tocando.

O deck mostra o que vai acontecer antes de você soltar.

## Playlists

Crie uma playlist em **+ Nova**, selecione-a e use o botão **+** de cada música na biblioteca. A playlist toca em ordem ou aleatório.

## Instalar no Windows (funciona sem internet)

Baixe em [Releases](../../releases/latest):

- **Nivela-Setup-x.y.z.exe**: instalador normal. Cria atalho na área de trabalho e no menu Iniciar.
- **Nivela-Portatil-x.y.z.exe**: roda direto de um pendrive, sem instalar.

Tudo vem dentro do programa (navegador embutido, fontes, análise). Não precisa de internet em momento nenhum. Na primeira abertura o Windows SmartScreen pode avisar que o programa não é reconhecido (não é assinado digitalmente): "Mais informações" → "Executar assim mesmo".

Para gerar um instalador novo: em *Actions → Gerar instalador → Run workflow*, ou crie uma tag `vX.Y.Z`. O instalador aparece em Releases em poucos minutos. Para rodar em desenvolvimento: `npm install` e `npm start`.

## Instalar como aplicativo web (PWA)

O Nivela é um PWA. Abrindo o link publicado no Chrome ou Edge (PC ou Android), aparece o botão **⤓ Instalar app** no topo (ou o ícone de instalar na barra de endereço). Ele passa a abrir em janela própria, com ícone na área de trabalho ou na tela inicial, e funciona sem internet. No iPhone: Safari → Compartilhar → "Adicionar à Tela de Início".

Atualizações chegam sozinhas: ao abrir o app com internet, a versão nova é baixada e um aviso pede para recarregar.

## Publicar

O workflow em `.github/workflows/pages.yml` publica no GitHub Pages a cada push na branch padrão. O GitHub Pages exige repositório público em contas gratuitas.

## Formatos e navegadores

Música: MP3, M4A/AAC, OGG, OPUS, WAV e FLAC. Vídeo: MP4 (H.264/AAC) e WebM. No Chrome e Edge a biblioteca fica lembrada entre sessões. Firefox e Safari funcionam, mas é preciso adicionar a pasta a cada abertura (a análise fica guardada mesmo assim).

## Estrutura

- `index.html`, `css/style.css`: interface.
- `js/zip.js`: leitura de CDs em .zip sem descompactar (deflate e nomes em UTF-8 ou CP437).
- `js/tags.js`: leitura de tags ID3 (título, artista, gênero, capa).
- `js/genres.js`: base de artistas e regras de classificação.
- `js/analyzer.js`: loudness (BS.1770), pico, forma de onda e BPM.
- `js/player.js`: dois decks (música ou clipe), crossfade, ganho por faixa, limitador e medidor.
- `tela.html`, `js/tela.js`: janela de vídeo, com a imagem dos dois decks cruzando junto com o som.
- `js/db.js`: persistência local (IndexedDB).
- `js/app.js`: importação, fila de análise, estilos, playlists e fila de reprodução.
- `js/pwa.js`, `sw.js`, `manifest.webmanifest`: instalação como app web e funcionamento offline no navegador.
- `desktop/main.js`, `package.json`: aplicativo de mesa (Electron) e configuração do instalador.
- `fonts/`: fontes empacotadas (licença OFL) para não depender de internet.
