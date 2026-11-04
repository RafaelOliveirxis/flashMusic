const seedSearches = [
  { term: "global pop hits", country: "US", vibe: "Pop" },
  { term: "afrobeats hits", country: "GB", vibe: "African sounds" },
  { term: "amapiano", country: "ZA", vibe: "African sounds" },
  { term: "k-pop", country: "US", vibe: "K-pop" },
  { term: "latin pop hits", country: "BR", vibe: "Latin" },
  { term: "brazilian funk", country: "BR", vibe: "Latin" },
  { term: "electronic dance music", country: "FR", vibe: "Electronic" },
  { term: "hip hop hits", country: "US", vibe: "Hip-hop" },
  { term: "j-pop", country: "JP", vibe: "J-pop" },
  { term: "indian pop", country: "IN", vibe: "Indian" },
  { term: "reggaeton", country: "MX", vibe: "Latin" },
  { term: "techno", country: "DE", vibe: "Electronic" },
  { term: "indie rock", country: "AU", vibe: "Indie" }
];

const producers = [
  { name: "Metro Boomin", origin: "EUA · Hip-hop", initials: "MB" },
  { name: "Tainy", origin: "Porto Rico · Música latina", initials: "TA" },
  { name: "Kaytranada", origin: "Haiti / Canadá · Eletrônica", initials: "KA" },
  { name: "Pheelz", origin: "Nigéria · Afrobeats", initials: "PH" },
  { name: "Finneas", origin: "EUA · Pop alternativo", initials: "FI" },
  { name: "Nucleya", origin: "Índia · Eletrônica", initials: "NU" }
];

const audio = document.querySelector("#audio");
const trackList = document.querySelector("#trackList");
const playButton = document.querySelector("#playButton");
const progress = document.querySelector("#progress");
const searchInput = document.querySelector("#searchInput");
const musicFolderInput = document.querySelector("#musicFolderInput");
const $ = selector => document.querySelector(selector);
const state = {
  tracks: [],
  localTracks: [],
  visibleTracks: [],
  queue: [],
  favorites: new Set(),
  savedTracks: new Map(),
  playlists: [],
  recent: [],
  currentId: null,
  currentView: "home",
  activePlaylist: null,
  shuffle: false,
  repeat: false,
  showAll: false,
  searchTimer: null,
  searchSequence: 0,
  toastTimer: null,
  activeLibraryFilter: "all",
  playlistIntent: null
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function renderIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Não foi possível ler ${key} do armazenamento local.`, error);
    toast("Não foi possível carregar sua biblioteca salva.");
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Não foi possível salvar ${key} no armazenamento local.`, error);
    toast("Não foi possível salvar. O armazenamento do navegador pode estar cheio.");
    return false;
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function normalizeTrack(track, vibe = "") {
  return {
    id: String(track.trackId),
    title: track.trackName || "Faixa sem título",
    artist: track.artistName || "Artista desconhecido",
    album: track.collectionName || "",
    genre: track.primaryGenreName || vibe,
    vibe,
    artwork: safeUrl((track.artworkUrl100 || "").replace(/100x100bb/i, "500x500bb")),
    preview: safeUrl(track.previewUrl || ""),
    store: safeUrl(track.trackViewUrl || ""),
    duration: Number(track.trackTimeMillis) > 0 ? Math.floor(track.trackTimeMillis / 1000) : 0
  };
}

function normalizeLocalTrack(file, preview) {
  const fileName = file.name.replace(/\.(mp3|m4a)$/i, "");
  const cleanedName = fileName
    .replace(/^(?:freemp3\.plus-|X2Download\.com\s*-\s*)/i, "")
    .replace(/^\d+\s+/, "")
    .trim();
  const titleParts = cleanedName.split(/\s+-\s+/, 2);
  const hasArtist = titleParts.length === 2 && titleParts.every(Boolean);
  const relativePath = file.webkitRelativePath || file.name;

  return {
    id: `local:${relativePath}`,
    title: hasArtist ? titleParts[1] : cleanedName || fileName,
    artist: hasArtist ? titleParts[0] : "RAFAMIX",
    album: "RAFAMIX",
    genre: "Música local",
    vibe: "Sua coleção",
    artwork: "",
    preview,
    store: "",
    duration: 0,
    local: true
  };
}

async function requestSongs(term, country, limit = 25) {
  const params = new URLSearchParams({ term, country, entity: "song", limit: String(limit) });
  const response = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!response.ok) throw new Error(`Catálogo indisponível (${response.status}).`);
  const payload = await response.json();
  if (!Array.isArray(payload.results)) throw new Error("O catálogo retornou uma resposta inesperada.");
  return payload.results;
}

function uniqueTracks(tracks) {
  const seen = new Set();
  return tracks.filter(track => {
    if (!track.id || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
  $("#recentShelf").addEventListener("click", event => {
    const card = event.target.closest("[data-recent-track]");
    if (!card) return;
    const track = state.savedTracks.get(card.dataset.recentTrack) || state.tracks.find(item => item.id === card.dataset.recentTrack);
    setPlayerTrack(track, true, state.recent.map(id => state.savedTracks.get(id) || state.tracks.find(item => item.id === id)).filter(Boolean));
  });
}

function currentTrack() {
  return state.savedTracks.get(state.currentId) || state.tracks.find(track => track.id === state.currentId);
}

function albumImage(track, className = "") {
  return track?.artwork
    ? `<img class="${className}" src="${escapeHtml(track.artwork)}" alt="" loading="lazy">`
    : `<span class="artwork-fallback ${className}"><i data-lucide="music-2"></i></span>`;
}

function updateFavoriteCount() {
  const favoriteCount = $("#favoriteCount");
  if (favoriteCount) favoriteCount.textContent = `${state.favorites.size} ${state.favorites.size === 1 ? "música" : "músicas"}`;
  const liked = state.favorites.has(state.currentId);
  $("#favoriteButton").classList.toggle("liked", liked);
  $("#favoriteButton").setAttribute("aria-label", liked ? "Descurtir música" : "Curtir música");
  $("#featureLike").classList.toggle("liked", liked);
  $("#quickLiked").classList.toggle("has-favorites", state.favorites.size > 0);
}

function renderQuickGrid() {
  const quickTracks = state.tracks.slice(0, 5);
  $("#quickGrid").innerHTML = `<button class="quick-card quick-liked" id="quickLiked"><span class="quick-heart"><i data-lucide="heart"></i></span><strong>Músicas curtidas</strong><span class="quick-play"><i data-lucide="play"></i></span></button>`
    + quickTracks.map((track, index) =>
      `<button class="quick-card" data-quick="${escapeHtml(track.id)}">${albumImage(track, "quick-cover")}<strong>${escapeHtml(track.title)}</strong><span class="quick-play"><i data-lucide="play"></i></span></button>`
    ).join("");
  $("#quickLiked").classList.toggle("has-favorites", state.favorites.size > 0);
  renderIcons();
}

function renderRecentShelf() {
  const tracks = state.recent.map(id => state.savedTracks.get(id) || state.tracks.find(track => track.id === id)).filter(Boolean);
  $("#recentSection").hidden = !tracks.length;
  $("#recentShelf").innerHTML = tracks.map(track =>
    `<button class="album-card" data-recent-track="${escapeHtml(track.id)}">${albumImage(track, "album-cover")}<span class="album-play"><i data-lucide="play"></i></span><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></button>`
  ).join("");
  renderIcons();
}

function renderFeature(track) {
  if (!track) return;
  $("#featureBanner").style.setProperty("--feature-image", track.artwork ? `url("${track.artwork}")` : "none");
  $("#featureCover").innerHTML = albumImage(track, "feature-image");
  $("#featureTitle").textContent = track.title;
  $("#featureDescription").textContent = `${track.artist}${track.album ? ` · ${track.album}` : ""} · ${track.vibe || track.genre || "Descoberta global"}`;
  $("#featurePlay").dataset.track = track.id;
  $("#featureLike").dataset.like = track.id;
  $("#featureLike").classList.toggle("liked", state.favorites.has(track.id));
  renderIcons();
}

function albumMarkup(track, index) {
  const isPlaying = state.currentId === track.id && !audio.paused;
  const liked = state.favorites.has(track.id);
  const storeLink = track.store
    ? `<a class="track-outbound" href="${escapeHtml(track.store)}" target="_blank" rel="noreferrer" aria-label="Abrir ${escapeHtml(track.title)} na iTunes Store"><i data-lucide="external-link"></i></a>`
    : "";
  return `<div class="track-row${state.currentId === track.id ? " playing" : ""}" data-track-id="${escapeHtml(track.id)}">
    <span class="track-index">${index + 1}</span>
    <div class="track-title-cell"><button class="row-cover" data-play="${escapeHtml(track.id)}" ${track.preview ? "" : "disabled"} aria-label="Tocar ${escapeHtml(track.title)}">${albumImage(track)}<span class="row-play-icon"><i data-lucide="${isPlaying ? "pause" : "play"}"></i></span></button><span class="track-name-text"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></span></div>
    <span class="track-album">${escapeHtml(track.album || track.vibe || track.genre || "Single")}</span>
    <span class="track-duration">${track.duration ? formatTime(track.duration) : "—"}</span>
    <span class="track-row-actions"><button class="track-like${liked ? " liked" : ""}" data-like="${escapeHtml(track.id)}" aria-label="${liked ? "Descurtir" : "Curtir"}"><i data-lucide="heart"></i></button><button class="track-add" data-add="${escapeHtml(track.id)}" aria-label="Adicionar à playlist"><i data-lucide="plus"></i></button>${storeLink}</span>
  </div>`;
}

function renderTracks() {
  const tracks = state.visibleTracks;
  const shown = state.showAll ? tracks : tracks.slice(0, 8);
  trackList.innerHTML = shown.length
    ? shown.map(albumMarkup).join("")
    : `<div class="empty-state"><i data-lucide="music-2"></i><strong>Nenhuma música por aqui ainda.</strong><span>Tente outro estilo ou curta algumas faixas para montar sua biblioteca.</span></div>`;
  $("#loadMore").hidden = tracks.length <= 8;
  $("#loadMore").textContent = state.showAll ? "Mostrar menos" : `Mostrar todas as ${tracks.length} faixas`;
  $("#seeAllTracks").hidden = tracks.length <= 8;
  renderIcons();
}

function renderAlbumShelf(tracks) {
  const albums = new Map();
  for (const track of tracks) {
    const key = `${track.album || track.title}|${track.artist}`;
    if (!albums.has(key)) albums.set(key, track);
    if (albums.size === 8) break;
  }
  $("#albumShelf").innerHTML = [...albums.values()].map(track =>
    `<button class="album-card" data-album-track="${escapeHtml(track.id)}">${albumImage(track, "album-cover")}<span class="album-play"><i data-lucide="play"></i></span><strong>${escapeHtml(track.album || track.title)}</strong><span>${escapeHtml(track.artist)} · ${escapeHtml(track.vibe || track.genre || "Global")}</span></button>`
  ).join("");
  renderIcons();
}

function renderArtists(tracks = state.visibleTracks) {
  const groups = new Map();
  for (const track of tracks) {
    const category = track.vibe || track.genre || "Música";
    if (!groups.has(category)) groups.set(category, new Map());
    if (!groups.get(category).has(track.artist)) groups.get(category).set(track.artist, track);
  }
  const queues = [...groups.values()].map(group => [...group.values()]);
  const artists = [];
  while (artists.length < 16 && queues.some(queue => queue.length)) {
    for (const queue of queues) {
      if (queue.length && artists.length < 16) artists.push(queue.shift());
    }
  }
  $("#artistShelf").innerHTML = artists.map(track =>
    `<button class="artist-card" data-artist="${escapeHtml(track.artist)}"><span class="artist-photo">${albumImage(track)}</span><strong>${escapeHtml(track.artist)}</strong><span>${escapeHtml(track.vibe || track.genre || "Artista")}</span></button>`
  ).join("");
  renderIcons();
}

function renderProducers(query = "") {
  const normalizedQuery = query.toLocaleLowerCase();
  const matches = producers.filter(producer =>
    `${producer.name} ${producer.origin}`.toLocaleLowerCase().includes(normalizedQuery)
  );
  $("#producerGrid").innerHTML = matches.map(producer =>
    `<button class="producer-card" data-producer="${escapeHtml(producer.name)}"><span class="producer-avatar">${escapeHtml(producer.initials)}</span><span class="producer-copy"><strong>${escapeHtml(producer.name)}</strong><span>${escapeHtml(producer.origin)}</span></span><i data-lucide="arrow-up-right"></i></button>`
  ).join("");
  $("#producers").hidden = Boolean(query) && matches.length === 0;
  renderIcons();
}

function renderLibrary() {
  const playlists = state.playlists.filter(playlist => {
    if (state.activeLibraryFilter === "playlist") return true;
    return state.activeLibraryFilter === "all";
  });
  const favoriteItem = state.activeLibraryFilter === "artist" ? "" :
    `<button class="library-item liked-link" id="favoritesLink"><span class="liked-cover"><i data-lucide="heart"></i></span><span class="library-item-copy"><strong>Músicas curtidas</strong><small id="favoriteCount">${state.favorites.size} ${state.favorites.size === 1 ? "música" : "músicas"}</small></span></button>`;
  const playlistItems = playlists.map(playlist =>
    `<button class="library-item" data-playlist="${escapeHtml(playlist.id)}"><span class="playlist-art">${playlist.tracks?.length ? albumImage(state.savedTracks.get(playlist.tracks[0]) || state.tracks.find(track => track.id === playlist.tracks[0])) : `<i data-lucide="list-music"></i>`}</span><span class="library-item-copy"><strong>${escapeHtml(playlist.name)}</strong><small>Playlist · ${playlist.tracks.length} músicas</small></span></button>`
  ).join("");
  const artists = state.activeLibraryFilter === "artist"
    ? [...new Map([...state.favorites].map(id => state.savedTracks.get(id)).filter(Boolean).map(track => [track.artist, track])).values()]
      .map(track => `<button class="library-item" data-library-artist="${escapeHtml(track.artist)}"><span class="playlist-art artist-library-art">${escapeHtml(track.artist.slice(0, 1))}</span><span class="library-item-copy"><strong>${escapeHtml(track.artist)}</strong><small>Artista curtido</small></span></button>`).join("")
    : "";
  $("#playlistLinks").innerHTML = favoriteItem + playlistItems + artists +
    (state.activeLibraryFilter === "artist" && !artists ? `<span class="library-loading">Curta uma música para salvar o artista aqui.</span>` : "");
  renderIcons();
}

function renderQueue() {
  const track = currentTrack();
  $("#queueNow").innerHTML = track
    ? queueItemMarkup(track, true)
    : `<div class="queue-empty">Nenhuma faixa tocando.</div>`;
  const nextTracks = state.queue.filter(item => item.id !== state.currentId);
  $("#queueList").innerHTML = nextTracks.length
    ? nextTracks.map(item => queueItemMarkup(item)).join("")
    : `<div class="queue-empty">Sua fila está vazia. Escolha uma faixa para começar.</div>`;
  renderIcons();
}

function queueItemMarkup(track, nowPlaying = false) {
  return `<button class="queue-item${nowPlaying ? " queue-current" : ""}" data-queue-track="${escapeHtml(track.id)}">${albumImage(track, "queue-cover")}<span class="queue-item-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></span>${nowPlaying ? `<i data-lucide="volume-2"></i>` : `<i data-lucide="play"></i>`}</button>`;
}

function setCatalogStatus(message, isError = false) {
  const status = $("#catalogStatus");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setTrackView(tracks, heading, eyebrow, status, view = "collection") {
  state.visibleTracks = uniqueTracks(tracks);
  state.showAll = false;
  state.currentView = view;
  $("#tracksHeading").textContent = heading;
  $("#tracksEyebrow").textContent = eyebrow;
  setCatalogStatus(status);
  renderTracks();
  renderArtists();
  $("#tracks").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadGlobalCatalog() {
  setCatalogStatus("Preparando descobertas para você…");
  const responses = await Promise.allSettled(seedSearches.map(async search => {
    const songs = await requestSongs(search.term, search.country);
    return songs.map(song => normalizeTrack(song, search.vibe));
  }));
  const successful = responses.filter(result => result.status === "fulfilled");
  const onlineTracks = uniqueTracks(successful.flatMap(result => result.value));
  state.tracks = uniqueTracks([...state.localTracks, ...onlineTracks]);
  state.visibleTracks = state.tracks;
  state.queue = state.tracks;
  mergeSavedTracks();

  if (state.tracks.length) {
    const failed = responses.length - successful.length;
    const localStatus = state.localTracks.length ? `${state.localTracks.length} faixas locais · ` : "";
    setCatalogStatus(onlineTracks.length
      ? `${localStatus}${onlineTracks.length} descobertas online${failed ? ` · ${failed} região(ões) temporariamente indisponível(is).` : " · prévias quando disponíveis."}`
      : `${state.localTracks.length} músicas da pasta local · ${failed === responses.length ? "catálogo online indisponível." : "sem descobertas online."}`,
    !onlineTracks.length && failed === responses.length);
    renderQuickGrid();
    renderFeature(state.tracks[0]);
    renderAlbumShelf(state.tracks);
    renderRecentShelf();
    renderTracks();
    renderArtists();
    if (state.currentView === "favorites") showFavorites(false);
    if (state.currentView === "playlist") showPlaylist(state.activePlaylist, false);
  } else {
    setCatalogStatus("Não foi possível carregar o catálogo. Verifique a conexão e tente novamente.", true);
    trackList.innerHTML = `<div class="empty-state"><i data-lucide="wifi-off"></i><strong>Estamos sem conexão com o catálogo.</strong><button class="text-button" id="retryCatalog">Tentar novamente</button></div>`;
    $("#retryCatalog").addEventListener("click", loadGlobalCatalog);
    renderIcons();
  }
  renderLibrary();
  updateFavoriteCount();
  renderQueue();
}

function importLocalMusic(files) {
  const musicFiles = Array.from(files).filter(file => /\.(mp3|m4a)$/i.test(file.name));
  if (!musicFiles.length) {
    setCatalogStatus("A pasta selecionada não contém arquivos MP3 ou M4A.", true);
    toast("Selecione uma pasta com arquivos MP3 ou M4A.");
    return;
  }

  if (state.currentId && state.currentId.startsWith("local:")) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    state.currentId = null;
    $("#playerTitle").textContent = "Escolha uma música";
    $("#playerArtist").textContent = "Sua próxima descoberta começa aqui";
    $("#playerCover").innerHTML = `<i data-lucide="music-2"></i>`;
    playButton.disabled = true;
  }
  for (const track of state.localTracks) {
    if (track.preview.startsWith("blob:")) URL.revokeObjectURL(track.preview);
    state.savedTracks.delete(track.id);
  }

  state.localTracks = musicFiles
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }))
    .map(file => normalizeLocalTrack(file, URL.createObjectURL(file)));
  state.tracks = uniqueTracks([...state.localTracks, ...state.tracks.filter(track => !track.local)]);
  state.visibleTracks = state.tracks;
  state.queue = state.tracks;
  state.currentView = "home";
  state.activePlaylist = null;
  state.showAll = false;
  searchInput.value = "";
  state.searchSequence++;
  clearTimeout(state.searchTimer);
  $("#clearSearch").hidden = true;
  $("#tracksHeading").textContent = "Sua pasta de músicas";
  $("#tracksEyebrow").textContent = "SUA COLEÇÃO LOCAL";
  setCatalogStatus(`${state.localTracks.length} músicas adicionadas · reprodução completa neste dispositivo.`);
  mergeSavedTracks();
  renderQuickGrid();
  renderFeature(state.localTracks[0]);
  renderAlbumShelf(state.tracks);
  renderRecentShelf();
  renderTracks();
  renderArtists();
  renderLibrary();
  updateFavoriteCount();
  renderQueue();
  toast(`${state.localTracks.length} músicas adicionadas ao catálogo.`);
}

function mergeSavedTracks() {
  for (const track of state.tracks) {
    if (state.favorites.has(track.id)) state.savedTracks.set(track.id, track);
  }
  const validFavorites = [...state.favorites].filter(id => id.startsWith("local:") || state.savedTracks.has(id));
  state.favorites = new Set(validFavorites);
  writeStorage("flashmusic:favorites", [...state.favorites]);
  writeStorage("flashmusic:saved-tracks", [...state.savedTracks.values()]);
}

async function searchCatalog(query, sequence) {
  if (!query) {
    state.currentView = "home";
    state.queue = state.tracks;
    state.visibleTracks = state.tracks;
    $("#tracksHeading").textContent = "Em alta pelo mundo";
    $("#tracksEyebrow").textContent = "ARTISTAS DE TODO O PLANETA";
    setCatalogStatus(state.localTracks.length
      ? `${state.localTracks.length} músicas locais + descobertas de vários países · prévias quando disponíveis.`
      : `${state.tracks.length} descobertas de vários países · prévias quando disponíveis.`);
    renderTracks();
    renderArtists();
    renderProducers();
    $("#clearSearch").hidden = true;
    return;
  }

  state.currentView = "search";
  $("#clearSearch").hidden = false;
  renderProducers(query);
  const localMatches = state.tracks.filter(track =>
    `${track.title} ${track.artist} ${track.album} ${track.genre}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );
  state.queue = localMatches;
  state.visibleTracks = localMatches;
  $("#tracksHeading").textContent = `Resultados para “${query}”`;
  $("#tracksEyebrow").textContent = "BUSCA GLOBAL";
  setCatalogStatus(localMatches.length ? "Buscando mais resultados no catálogo…" : "Buscando no catálogo global…");
  renderTracks();
  renderArtists();

  const markets = ["US", "GB", "BR", "JP"];
  const responses = await Promise.allSettled(markets.map(country => requestSongs(query, country, 15)));
  if (sequence !== state.searchSequence) return;
  const successful = responses.filter(result => result.status === "fulfilled");
  const remoteTracks = successful
    .flatMap(result => result.value.map(song => normalizeTrack(song)));
  state.visibleTracks = uniqueTracks([...localMatches, ...remoteTracks]);
  state.queue = state.visibleTracks;
  const failed = responses.filter(result => result.status === "rejected").length;
  if (state.visibleTracks.length) {
    setCatalogStatus(failed
      ? `${state.visibleTracks.length} resultados · algumas regiões não responderam.`
      : `${state.visibleTracks.length} resultados de vários mercados.`);
  } else if (successful.length === 0) {
    setCatalogStatus("Busca online indisponível. Verifique sua conexão e tente novamente.", true);
  } else {
    setCatalogStatus("Nenhum resultado encontrado. Experimente outro nome ou gênero.");
  }
  renderTracks();
  renderArtists();
}

function setPlayerTrack(track, autoplay = true, queue = state.visibleTracks) {
  if (!track) return;
  state.savedTracks.set(track.id, track);
  state.currentId = track.id;
  state.recent = [track.id, ...state.recent.filter(id => id !== track.id)].slice(0, 12);
  writeStorage("flashmusic:recent", state.recent);
  writeStorage("flashmusic:saved-tracks", [...state.savedTracks.values()]);
  renderRecentShelf();
  if (queue.length) state.queue = uniqueTracks(queue);
  if (!state.queue.some(item => item.id === track.id)) state.queue.unshift(track);
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  $("#playerTitle").textContent = track.title;
  $("#playerArtist").textContent = track.preview ? track.artist : `${track.artist} · áudio indisponível`;
  $("#playerCover").innerHTML = albumImage(track, "player-cover-image");
  $("#duration").textContent = track.duration ? formatTime(track.duration) : "0:00";
  $("#currentTime").textContent = "0:00";
  progress.value = 0;
  playButton.disabled = !track.preview;
  updateFavoriteCount();
  if (track.preview) audio.src = track.preview;
  renderTracks();
  renderQueue();
  renderIcons();
  if (!track.preview) {
    setPlayIcon();
    toast("O áudio desta faixa não está disponível.");
    return;
  }
  if (autoplay) {
    audio.play().then(setPlayIcon).catch(() => {
      setPlayIcon();
      toast("Não foi possível tocar a prévia. Tente novamente.");
    });
  } else {
    setPlayIcon();
  }
}

function setPlayIcon() {
  playButton.innerHTML = `<i data-lucide="${audio.paused ? "play" : "pause"}"></i>`;
  playButton.setAttribute("aria-label", audio.paused ? "Reproduzir música" : "Pausar música");
  renderIcons();
}

function togglePlay() {
  if (!state.currentId) {
    const firstPreview = state.visibleTracks.find(track => track.preview);
    if (firstPreview) setPlayerTrack(firstPreview);
    return;
  }
  if (audio.paused) {
    if (!audio.src) {
      const track = currentTrack();
      if (track?.preview) audio.src = track.preview;
      else return;
    }
    audio.play().then(setPlayIcon).catch(() => toast("Não foi possível tocar a prévia. Tente novamente."));
  } else {
    audio.pause();
    setPlayIcon();
  }
}

function moveTrack(direction) {
  if (!state.queue.length) return;
  const currentIndex = state.queue.findIndex(track => track.id === state.currentId);
  if (state.shuffle && direction > 0 && state.queue.length > 1) {
    const candidates = state.queue.filter(track => track.id !== state.currentId);
    const track = candidates[Math.floor(Math.random() * candidates.length)];
    setPlayerTrack(track, true, state.queue);
    return;
  }
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0) {
    setPlayerTrack(state.queue[state.queue.length - 1], true, state.queue);
  } else if (nextIndex >= state.queue.length) {
    if (state.repeat) setPlayerTrack(state.queue[0], true, state.queue);
    else {
      audio.pause();
      setPlayIcon();
      toast("Fim da fila. Ative repetir para ouvir novamente.");
    }
  } else {
    setPlayerTrack(state.queue[nextIndex], true, state.queue);
  }
}

function persistFavorites() {
  writeStorage("flashmusic:favorites", [...state.favorites]);
  writeStorage("flashmusic:saved-tracks", [...state.savedTracks.values()]);
}

function toggleFavorite(trackId = state.currentId) {
  if (!trackId) {
    toast("Escolha uma música primeiro.");
    return;
  }
  const track = state.savedTracks.get(trackId) || state.tracks.find(item => item.id === trackId);
  if (!track) {
    toast("Esta música não está disponível na biblioteca.");
    return;
  }
  const wasLiked = state.favorites.has(trackId);
  if (wasLiked) state.favorites.delete(trackId);
  else {
    state.favorites.add(trackId);
    state.savedTracks.set(trackId, track);
  }
  persistFavorites();
  updateFavoriteCount();
  renderTracks();
  renderLibrary();
  toast(wasLiked ? "Faixa removida das músicas curtidas." : "Adicionada às músicas curtidas.");
}

function showFavorites(scroll = true) {
  searchInput.value = "";
  state.searchSequence++;
  clearTimeout(state.searchTimer);
  const tracks = [...state.favorites].map(id => state.savedTracks.get(id)).filter(Boolean);
  state.queue = tracks;
  setTrackView(tracks, "Músicas curtidas", "SUA COLEÇÃO", `${tracks.length} ${tracks.length === 1 ? "música salva" : "músicas salvas"} neste dispositivo.`, "favorites");
  if (!scroll) window.scrollTo({ top: 0, behavior: "instant" });
}

function showPlaylist(playlistId, scroll = true) {
  const playlist = state.playlists.find(item => item.id === playlistId);
  if (!playlist) return;
  state.activePlaylist = playlistId;
  searchInput.value = "";
  state.searchSequence++;
  clearTimeout(state.searchTimer);
  const tracks = playlist.tracks.map(id => state.savedTracks.get(id) || state.tracks.find(track => track.id === id)).filter(Boolean);
  state.queue = tracks;
  setTrackView(tracks, playlist.name, "SUA PLAYLIST", `${tracks.length} ${tracks.length === 1 ? "música" : "músicas"} · Sua coleção pessoal.`, "playlist");
  if (!scroll) window.scrollTo({ top: 0, behavior: "instant" });
}

function createPlaylist(name) {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  const playlist = { id: `playlist-${Date.now()}`, name: trimmedName, tracks: [] };
  state.playlists.unshift(playlist);
  writeStorage("flashmusic:playlists", state.playlists);
  renderLibrary();
  toast(`Playlist “${trimmedName}” criada.`);
}

function openPlaylistDialog(intent, trackId = null) {
  state.playlistIntent = { mode: intent, trackId };
  const isAdding = intent === "add";
  const dialog = $("#playlistDialog");
  const choices = $("#playlistChoices");
  const nameField = $("#playlistNameField");
  $("#playlistDialogTitle").textContent = isAdding ? "Adicionar à playlist" : "Criar playlist";
  $("#playlistDialogDescription").textContent = isAdding
    ? `Escolha onde salvar “${state.savedTracks.get(trackId)?.title || state.tracks.find(track => track.id === trackId)?.title || "esta música"}”.`
    : "Dê um nome à sua nova playlist.";
  $("#playlistSubmit").textContent = isAdding ? "Adicionar música" : "Criar playlist";
  $("#playlistNameInput").value = "";
  choices.hidden = !isAdding || !state.playlists.length;
  nameField.hidden = isAdding && state.playlists.length > 0;
  choices.innerHTML = isAdding && state.playlists.length
    ? state.playlists.map(playlist =>
      `<button class="playlist-choice${state.playlists[0].id === playlist.id ? " selected" : ""}" type="button" data-choice="${escapeHtml(playlist.id)}"><span class="playlist-choice-art"><i data-lucide="list-music"></i></span><span><strong>${escapeHtml(playlist.name)}</strong><small>${playlist.tracks.length} músicas</small></span><i data-lucide="circle-check"></i></button>`
    ).join("") + `<button class="new-playlist-choice" id="newPlaylistChoice" type="button"><i data-lucide="plus"></i> Criar nova playlist</button>`
    : "";
  renderIcons();
  dialog.showModal();
  if (!nameField.hidden) $("#playlistNameInput").focus();
}

function closePlaylistDialog() {
  $("#playlistDialog").close();
  state.playlistIntent = null;
}

function addToPlaylist(trackId) {
  const track = state.savedTracks.get(trackId) || state.tracks.find(item => item.id === trackId);
  if (!track) return;
  state.savedTracks.set(track.id, track);
  openPlaylistDialog("add", track.id);
}

function submitPlaylistDialog(event) {
  event.preventDefault();
  const intent = state.playlistIntent;
  if (!intent) return;
  const isAdding = intent.mode === "add";
  const name = $("#playlistNameInput").value.trim();
  if (!isAdding && !name) {
    $("#playlistNameInput").focus();
    toast("Digite um nome para a playlist.");
    return;
  }
  let playlist;
  if (isAdding && !$("#playlistNameField").hidden) {
    if (!name) {
      $("#playlistNameInput").focus();
      toast("Digite um nome para a playlist.");
      return;
    }
    playlist = { id: `playlist-${Date.now()}`, name, tracks: [] };
    state.playlists.unshift(playlist);
  } else if (isAdding) {
    const selected = $("#playlistChoices .playlist-choice.selected");
    playlist = state.playlists.find(item => item.id === selected?.dataset.choice);
    if (!playlist) {
      toast("Escolha uma playlist para continuar.");
      return;
    }
  } else {
    playlist = { id: `playlist-${Date.now()}`, name, tracks: [] };
    state.playlists.unshift(playlist);
  }
  if (isAdding && !playlist.tracks.includes(intent.trackId)) playlist.tracks.push(intent.trackId);
  writeStorage("flashmusic:playlists", state.playlists);
  writeStorage("flashmusic:saved-tracks", [...state.savedTracks.values()]);
  renderLibrary();
  closePlaylistDialog();
  toast(isAdding ? `Adicionada à playlist “${playlist.name}”.` : `Playlist “${playlist.name}” criada.`);
}

function filterByVibe(vibe) {
  searchInput.value = "";
  $("#clearSearch").hidden = true;
  state.searchSequence++;
  clearTimeout(state.searchTimer);
  const tracks = state.tracks.filter(track => track.vibe === vibe);
  state.queue = tracks;
  setTrackView(tracks, vibe, "EXPLORE POR ESTILO", `${tracks.length} descobertas de ${vibe} no catálogo global.`, "genre");
}

trackList.addEventListener("click", event => {
  const playControl = event.target.closest("[data-play]");
  const likeControl = event.target.closest("[data-like]");
  const addControl = event.target.closest("[data-add]");
  if (playControl && !playControl.disabled) {
    const track = state.visibleTracks.find(item => item.id === playControl.dataset.play);
    if (track?.id === state.currentId) togglePlay();
    else setPlayerTrack(track, true, state.visibleTracks);
  }
  if (likeControl) toggleFavorite(likeControl.dataset.like);
  if (addControl) addToPlaylist(addControl.dataset.add);
});

$("#quickGrid").addEventListener("click", event => {
  const liked = event.target.closest("#quickLiked");
  const quick = event.target.closest("[data-quick]");
  if (liked) showFavorites();
  if (quick) {
    const track = state.tracks.find(item => item.id === quick.dataset.quick);
    setPlayerTrack(track, true, state.tracks);
  }
});
$("#featurePlay").addEventListener("click", event => {
  const track = state.tracks.find(item => item.id === event.currentTarget.dataset.track);
  setPlayerTrack(track, true, state.tracks);
});
$("#featureLike").addEventListener("click", event => toggleFavorite(event.currentTarget.dataset.like));
$("#featureBanner").addEventListener("dblclick", () => $("#featurePlay").click());
$("#featureBanner").addEventListener("keydown", event => {
  if (event.key === "Enter") $("#featurePlay").click();
});
$("#albumShelf").addEventListener("click", event => {
  const card = event.target.closest("[data-album-track]");
  if (!card) return;
  const track = state.tracks.find(item => item.id === card.dataset.albumTrack);
  const albumTracks = state.tracks.filter(item => item.artist === track?.artist && item.album === track?.album);
  setPlayerTrack(track, true, albumTracks.length ? albumTracks : [track]);
});
$("#artistShelf").addEventListener("click", event => {
  const card = event.target.closest("[data-artist]");
  if (card) {
    searchInput.value = card.dataset.artist;
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
$("#producerGrid").addEventListener("click", event => {
  const card = event.target.closest("[data-producer]");
  if (card) {
    searchInput.value = card.dataset.producer;
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
});

playButton.addEventListener("click", togglePlay);
$("#favoriteButton").addEventListener("click", () => toggleFavorite());
$("#forwardButton").addEventListener("click", () => moveTrack(1));
$("#backButton").addEventListener("click", () => moveTrack(-1));
$("#shuffleButton").addEventListener("click", event => {
  state.shuffle = !state.shuffle;
  event.currentTarget.classList.toggle("active", state.shuffle);
  toast(state.shuffle ? "Reprodução aleatória ativada." : "Reprodução aleatória desativada.");
});
$("#repeatButton").addEventListener("click", event => {
  state.repeat = !state.repeat;
  event.currentTarget.classList.toggle("active", state.repeat);
  toast(state.repeat ? "Repetição da fila ativada." : "Repetição desativada.");
});
audio.addEventListener("play", setPlayIcon);
audio.addEventListener("pause", setPlayIcon);
audio.addEventListener("loadedmetadata", () => {
  if (!Number.isFinite(audio.duration)) return;
  $("#duration").textContent = formatTime(audio.duration);
  const track = currentTrack();
  if (track?.local) {
    track.duration = Math.floor(audio.duration);
    renderTracks();
  }
});
audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  progress.value = String(audio.currentTime / audio.duration * 100);
  $("#currentTime").textContent = formatTime(audio.currentTime);
  $("#duration").textContent = formatTime(audio.duration);
});
audio.addEventListener("ended", () => moveTrack(1));
audio.addEventListener("error", () => {
  if (state.currentId) toast("Não foi possível carregar o áudio desta faixa.");
});
progress.addEventListener("input", () => {
  if (audio.duration) audio.currentTime = Number(progress.value) / 100 * audio.duration;
});
$("#volume").addEventListener("input", event => { audio.volume = Number(event.target.value); });
audio.volume = 0.7;

$("#loadMore").addEventListener("click", () => {
  state.showAll = !state.showAll;
  renderTracks();
});
$("#importMusic").addEventListener("click", () => {
  if (!("webkitdirectory" in musicFolderInput)) {
    toast("Use um navegador que permita selecionar pastas, como Chrome ou Edge.");
    return;
  }
  musicFolderInput.click();
});
musicFolderInput.addEventListener("change", () => {
  if (musicFolderInput.files.length) importLocalMusic(musicFolderInput.files);
  musicFolderInput.value = "";
});
$("#seeAllTracks").addEventListener("click", () => {
  state.showAll = true;
  renderTracks();
  $("#tracks").scrollIntoView({ behavior: "smooth" });
});
$("#createPlaylist").addEventListener("click", () => openPlaylistDialog("create"));
$("#playlistLinks").addEventListener("click", event => {
  const playlistButton = event.target.closest("[data-playlist]");
  const artistButton = event.target.closest("[data-library-artist]");
  const favorites = event.target.closest("#favoritesLink");
  if (favorites) showFavorites();
  if (playlistButton) showPlaylist(playlistButton.dataset.playlist);
  if (artistButton) {
    searchInput.value = artistButton.dataset.libraryArtist;
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
document.querySelectorAll(".genre-card").forEach(button => button.addEventListener("click", () => filterByVibe(button.dataset.vibe)));
document.querySelectorAll("[data-library-filter]").forEach(button => button.addEventListener("click", () => {
  state.activeLibraryFilter = button.dataset.libraryFilter;
  document.querySelectorAll(".library-chip[data-library-filter]").forEach(chip => chip.classList.toggle("active", chip.dataset.libraryFilter === state.activeLibraryFilter));
  renderLibrary();
}));

searchInput.addEventListener("focus", () => {
  document.querySelector(".search-box").classList.add("focused");
});
searchInput.addEventListener("blur", () => document.querySelector(".search-box").classList.remove("focused"));
searchInput.addEventListener("input", event => {
  clearTimeout(state.searchTimer);
  const query = event.target.value.trim();
  const sequence = ++state.searchSequence;
  $("#clearSearch").hidden = !query;
  if (query) $("#tracks").scrollIntoView({ behavior: "smooth", block: "start" });
  state.searchTimer = setTimeout(() => searchCatalog(query, sequence), 350);
});
$("#clearSearch").addEventListener("click", () => {
  searchInput.value = "";
  searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  searchInput.focus();
});
$("#searchNav").addEventListener("click", event => {
  event.preventDefault();
  searchInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
document.querySelectorAll("[data-nav]").forEach(link => link.addEventListener("click", () => {
  document.querySelectorAll(".nav-link").forEach(nav => nav.classList.toggle("active", nav === link));
}));
$("#backPage").addEventListener("click", () => history.back());
$("#forwardPage").addEventListener("click", () => history.forward());
document.querySelectorAll(".shelf-scroll").forEach(button => button.addEventListener("click", () => {
  const shelf = $(`#${button.dataset.scroll}`);
  shelf.scrollBy({ left: Number(button.dataset.direction) * shelf.clientWidth * 0.8, behavior: "smooth" });
}));

$("#queueToggle").addEventListener("click", () => {
  $("#queuePanel").hidden = !$("#queuePanel").hidden;
  renderQueue();
});
$("#closeQueue").addEventListener("click", () => { $("#queuePanel").hidden = true; });
$("#playlistForm").addEventListener("submit", submitPlaylistDialog);
$("#closePlaylistDialog").addEventListener("click", closePlaylistDialog);
$("#cancelPlaylistDialog").addEventListener("click", closePlaylistDialog);
$("#playlistChoices").addEventListener("click", event => {
  if (event.target.closest("#newPlaylistChoice")) {
    $("#playlistChoices").hidden = true;
    $("#playlistNameField").hidden = false;
    $("#playlistDialogTitle").textContent = "Criar e adicionar música";
    $("#playlistSubmit").textContent = "Criar e adicionar";
    $("#playlistNameInput").focus();
    return;
  }
  const choice = event.target.closest("[data-choice]");
  if (!choice) return;
  $("#playlistChoices").querySelectorAll(".playlist-choice").forEach(button => button.classList.toggle("selected", button === choice));
});
$("#playlistDialog").addEventListener("cancel", () => { state.playlistIntent = null; });
$("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#profileButton").addEventListener("click", () => toast("Sua biblioteca fica salva neste navegador."));
$("#queueList").addEventListener("click", event => {
  const row = event.target.closest("[data-queue-track]");
  if (!row) return;
  const track = state.queue.find(item => item.id === row.dataset.queueTrack);
  setPlayerTrack(track, true, state.queue);
});
$("#queueNow").addEventListener("click", event => {
  const row = event.target.closest("[data-queue-track]");
  if (row && row.dataset.queueTrack !== state.currentId) {
    const track = state.queue.find(item => item.id === row.dataset.queueTrack);
    setPlayerTrack(track, true, state.queue);
  }
});

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.code === "Space" && !["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    togglePlay();
  }
  if (event.key === "Escape") {
    $("#queuePanel").hidden = true;
    $("#sidebar").classList.remove("open");
  }
});
document.addEventListener("click", event => {
  if (window.innerWidth <= 760 && !event.target.closest("#sidebar") && !event.target.closest("#menuToggle")) {
    $("#sidebar").classList.remove("open");
  }
});

function setGreeting() {
  const hour = new Date().getHours();
  $("#greetingTitle").textContent = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function hydrateLibrary() {
  const savedFavorites = readStorage("flashmusic:favorites", []);
  const savedTracks = readStorage("flashmusic:saved-tracks", []);
  const savedPlaylists = readStorage("flashmusic:playlists", []);
  const savedRecent = readStorage("flashmusic:recent", []);
  if (Array.isArray(savedTracks)) {
    for (const track of savedTracks) {
      if (track?.id && !String(track.id).startsWith("local:")) {
        state.savedTracks.set(String(track.id), { ...track, id: String(track.id) });
      }
    }
  }
  if (Array.isArray(savedFavorites)) state.favorites = new Set(savedFavorites.map(String));
  if (Array.isArray(savedPlaylists)) {
    state.playlists = savedPlaylists.filter(playlist => playlist && typeof playlist.name === "string" && Array.isArray(playlist.tracks));
  }
  if (Array.isArray(savedRecent)) state.recent = savedRecent.map(String).slice(0, 12);
}

hydrateLibrary();
setGreeting();
renderLibrary();
renderQuickGrid();
renderRecentShelf();
renderProducers();
updateFavoriteCount();
renderIcons();
loadGlobalCatalog();
