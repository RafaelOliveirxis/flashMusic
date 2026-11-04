# FlashMusic 🎧

Uma interface responsiva para descobrir músicas, artistas e produtores de diferentes países. O catálogo online é carregado da API pública de busca da iTunes Store; quando disponível, cada faixa pode ser ouvida em uma prévia curta. Também é possível carregar uma pasta local de músicas para ouvir os arquivos completos no navegador.

## Recursos
- Descobertas iniciais em mercados dos EUA, Reino Unido, África do Sul, Brasil, Japão, Índia, México, França, Alemanha e Austrália, além de uma seleção de K-pop
- Seleções de pop, sons africanos, K-pop, J-pop, música indiana, ritmos latinos, eletrônica, hip-hop e indie
- Busca de músicas e artistas no catálogo internacional
- Importação de pastas locais com arquivos MP3, M4A e WAV para reprodução completa
- Filtros por estilo e perfis de artistas encontrados no catálogo
- Seleção editorial ampliada de 20 produtores internacionais para conhecer
- Player de prévias com progresso, volume, reprodução aleatória, repetição e fila
- Faixas curtidas e playlists salvas no navegador
- Histórico de reprodução recente e fila atual
- Layout responsivo para desktop e dispositivos móveis

## Executar localmente
Abra `index.html` no navegador ou inicie um servidor local com uma ferramenta como a extensão Live Server do VS Code. É necessária uma conexão com a internet para carregar o catálogo, as capas e as prévias. Para adicionar músicas locais, clique em **Adicionar pasta de músicas** e selecione uma pasta que contenha arquivos MP3, M4A ou WAV. Você pode importar pastas adicionais durante a mesma sessão; elas são somadas às faixas já carregadas. O navegador pedirá acesso às pastas; os arquivos permanecem no local original e não são enviados nem copiados para o projeto. Se a pasta estiver no OneDrive, deixe os arquivos disponíveis neste dispositivo antes de tocar. Navegadores compatíveis com seleção de diretório (como Chrome e Edge) são recomendados. Após recarregar a página, selecione novamente as pastas para liberar o acesso aos arquivos locais.

## Catálogo e áudio
As faixas, artistas, capas, links e prévias online são obtidos da API de busca da iTunes Store. As prévias são curtas e a reprodução depende do suporte do navegador ao formato de áudio servido pela loja. As músicas locais são reproduzidas integralmente e diretamente dos arquivos selecionados pelo usuário, sem serem incluídas ou hospedadas pelo projeto. Os produtores em destaque são uma seleção editorial de nomes internacionais, não perfis de usuários ou uma alegação de parceria.

---
Desenvolvido como projeto FlashMusic.
