# FlashMusic 🎧

Uma interface responsiva para descobrir músicas, artistas e produtores de diferentes países. O catálogo online é carregado da API pública de busca da iTunes Store; quando disponível, cada faixa pode ser ouvida em uma prévia curta. Também é possível carregar uma pasta local de músicas para ouvir os arquivos completos no navegador.

## Recursos
- Descobertas iniciais em mercados dos EUA, Reino Unido, África do Sul, Brasil, Japão, Índia, México, França, Alemanha e Austrália, além de uma seleção de K-pop
- Seleções de pop, sons africanos, K-pop, J-pop, música indiana, ritmos latinos, eletrônica, hip-hop e indie
- Busca de músicas e artistas no catálogo internacional
- Importação de pastas locais com arquivos MP3 e M4A para reprodução completa
- Filtros por estilo e perfis de artistas encontrados no catálogo
- Seleção editorial de produtores internacionais para conhecer
- Player de prévias com progresso, volume, reprodução aleatória, repetição e fila
- Faixas curtidas e playlists salvas no navegador
- Histórico de reprodução recente e fila atual
- Layout responsivo para desktop e dispositivos móveis

## Executar localmente
Abra `index.html` no navegador ou inicie um servidor local com uma ferramenta como a extensão Live Server do VS Code. É necessária uma conexão com a internet para carregar o catálogo, as capas e as prévias. Para adicionar músicas locais, clique em **Adicionar pasta de músicas** e selecione a pasta que contém os arquivos MP3 ou M4A. O navegador pedirá acesso à pasta; os arquivos permanecem no local original e não são enviados nem copiados para o projeto. Se a pasta estiver no OneDrive, deixe os arquivos disponíveis neste dispositivo antes de tocar. Navegadores compatíveis com seleção de diretório (como Chrome e Edge) são recomendados.

## Catálogo e áudio
As faixas, artistas, capas, links e prévias online são obtidos da API de busca da iTunes Store. A disponibilidade varia conforme a região e algumas faixas não têm prévia. As músicas locais são reproduzidas diretamente dos arquivos selecionados pelo usuário, sem serem incluídas ou hospedadas pelo projeto. Os produtores em destaque são uma seleção editorial de nomes internacionais, não perfis de usuários ou uma alegação de parceria.

---
Desenvolvido como projeto FlashMusic.
