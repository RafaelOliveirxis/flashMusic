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
const $ = selector => document.querySelector(selector);
const state = {
  tracks: [],
  visibleTracks: [],
  currentId: null,
  favorites: new Set(),
  shuffle: false,
  repeat: false,
  showAll: false,
  searchTimer: null,
  searchSequence: 0,
  toastTimer: null
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
}

function updateFavoriteCount() {
  $("#favoriteCount").textContent = String(state.favorites.size);
  const currentIsFavorite = state.favorites.has(state.currentId);
  $("#favoriteButton").classList.toggle("liked", currentIsFavorite);
  $("#favoriteButton").setAttribute("aria-label", currentIsFavorite ? "Descurtir música" : "Curtir música");
}

function trackMarkup(track, index) {
  const cover = track.artwork
    ? `<img src="${escapeHtml(track.artwork)}" alt="" loading="lazy">`
    : `<i data-lucide="music-2"></i>`;
  const isPlaying = state.currentId === track.id && !audio.paused;
  const liked = state.favorites.has(track.id);
  const storeLink = track.store
    ? `<a class="track-outbound" href="${escapeHtml(track.store)}" target="_blank" rel="noreferrer" aria-label="Abrir ${escapeHtml(track.title)} na iTunes Store"><i data-lucide="external-link"></i></a>`
    : "";
  return `<div class="track-row${state.currentId === track.id ? " playing" : ""}" data-track-id="${escapeHtml(track.id)}">
    <span class="track-number">${String(index + 1).padStart(2, "0")}</span>
    <div class="track-name"><div class="track-cover">${cover}</div><div class="track-name-text"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)}</span></div></div>
    <span class="track-genre">${escapeHtml(track.vibe || track.genre || "Música")}</span>
    <span class="track-duration">${track.duration ? formatTime(track.duration) : "—"}</span>
    <div class="track-actions"><button class="track-play" data-play="${escapeHtml(track.id)}" aria-label="${track.preview ? "Reproduzir" : "Prévia indisponível"}" ${track.preview ? "" : "disabled"}><i data-lucide="${isPlaying ? "pause" : "play"}"></i></button><button class="track-like${liked ? " liked" : ""}" data-like="${escapeHtml(track.id)}" aria-label="${liked ? "Descurtir" : "Curtir"}"><i data-lucide="heart"></i></button>${storeLink}</div>
  </div>`;
}

function renderTracks() {
  const tracks = state.visibleTracks;
  const shown = state.showAll ? tracks : tracks.slice(0, 12);
  trackList.innerHTML = shown.length
    ? shown.map(trackMarkup).join("")
    : `<div class="empty-state">Nenhuma faixa encontrada. Tente buscar outro artista ou estilo.</div>`;
  $("#catalogCount").textContent = tracks.length ? `${tracks.length} faixas` : "";
  $("#loadMore").hidden = tracks.length <= 12;
  $("#loadMore").textContent = state.showAll ? "Mostrar menos" : "Carregar mais músicas";
  renderIcons();
}

function renderArtists(tracks = state.visibleTracks) {
  const groups = new Map();
  for (const track of tracks) {
    const category = track.vibe || track.genre || "Music";
    if (!groups.has(category)) groups.set(category, new Map());
    if (!groups.get(category).has(track.artist)) groups.get(category).set(track.artist, track);
  }
  const queues = [...groups.values()].map(group => [...group.values()]);
  const artists = [];
  while (artists.length < 12 && queues.some(queue => queue.length)) {
    for (const queue of queues) {
      if (queue.length && artists.length < 12) artists.push(queue.shift());
    }
  }
  $("#artistGrid").innerHTML = artists.map(track => {
    const photo = track.artwork
      ? `<img src="${escapeHtml(track.artwork)}" alt="${escapeHtml(track.artist)}" loading="lazy">`
      : `<i data-lucide="mic-2"></i>`;
    return `<article class="artist-card"><div class="artist-photo">${photo}</div><strong>${escapeHtml(track.artist)}</strong><span>${escapeHtml(track.vibe || track.genre || "Artista")}</span></article>`;
  }).join("");
  renderIcons();
}

function renderProducers(query = "") {
  const normalizedQuery = query.toLocaleLowerCase();
  const matches = producers.filter(producer =>
    `${producer.name} ${producer.origin}`.toLocaleLowerCase().includes(normalizedQuery)
  );
  $("#producerGrid").innerHTML = matches.length ? matches.map(producer =>
    `<article class="producer-card"><div class="producer-avatar" aria-hidden="true">${escapeHtml(producer.initials)}</div><div><strong>${escapeHtml(producer.name)}</strong><span>${escapeHtml(producer.origin)}</span></div></article>`
  ).join("") : `<div class="empty-state">Nenhum produtor em destaque corresponde a “${escapeHtml(query)}”.</div>`;
}

function setCatalogStatus(message, isError = false) {
  const status = $("#catalogStatus");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

async function loadGlobalCatalog() {
  setCatalogStatus("Buscando músicas em diferentes cenas musicais…");
  const responses = await Promise.allSettled(seedSearches.map(async search => {
    const songs = await requestSongs(search.term, search.country);
    return songs.map(song => normalizeTrack(song, search.vibe));
  }));
  const successful = responses.filter(result => result.status === "fulfilled");
  state.tracks = uniqueTracks(successful.flatMap(result => result.value));
  state.visibleTracks = state.tracks;
  state.showAll = false;
  renderTracks();
  renderArtists();

  if (state.tracks.length) {
    const failed = responses.length - successful.length;
    setCatalogStatus(failed
      ? `Descobertas de vários países · ${failed} região(ões) temporariamente indisponível(is).`
      : "Descobertas de vários países · prévias gratuitas quando disponíveis.");
  } else {
    setCatalogStatus("Não foi possível carregar o catálogo. Verifique a conexão e tente novamente.", true);
    trackList.innerHTML = `<div class="empty-state">O catálogo está indisponível no momento. <button class="text-button" id="retryCatalog">Tentar novamente</button></div>`;
    $("#retryCatalog").addEventListener("click", loadGlobalCatalog);
  }
}

async function searchCatalog(query, sequence) {
  if (!query) {
    state.visibleTracks = state.tracks;
    state.showAll = false;
    $("#tracksHeading").textContent = "Em alta pelo mundo";
    setCatalogStatus("Descobertas de vários países · prévias gratuitas quando disponíveis.");
    renderArtists();
    renderProducers();
    renderTracks();
    return;
  }

  renderProducers(query);
  const localMatches = state.tracks.filter(track =>
    `${track.title} ${track.artist} ${track.album} ${track.genre}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );
  state.visibleTracks = localMatches;
  state.showAll = false;
  $("#tracksHeading").textContent = `Resultados para “${query}”`;
  setCatalogStatus(localMatches.length ? "Buscando mais resultados no catálogo…" : "Buscando no catálogo global…");
  renderTracks();
  renderArtists();

  try {
    const songs = await requestSongs(query, "US", 25);
    if (sequence !== state.searchSequence) return;
    const remoteMatches = songs.map(song => normalizeTrack(song));
    state.visibleTracks = uniqueTracks([...localMatches, ...remoteMatches]);
    setCatalogStatus("Resultados do catálogo global · prévias gratuitas quando disponíveis.");
  } catch (error) {
    if (sequence !== state.searchSequence) return;
    if (localMatches.length) {
      setCatalogStatus("Mostrando resultados já carregados. A busca online está temporariamente indisponível.", true);
    } else {
      setCatalogStatus("Não foi possível pesquisar online. Verifique a conexão e tente novamente.", true);
    }
  }
  renderTracks();
  renderArtists();
}

function setPlayerTrack(track, autoplay = true) {
  if (!track) return;
  state.currentId = track.id;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  $("#playerTitle").textContent = track.title;
  $("#playerArtist").textContent = track.preview ? track.artist : `${track.artist} · prévia indisponível`;
  $("#playerCover").innerHTML = track.artwork
    ? `<img src="${escapeHtml(track.artwork)}" alt="">`
    : `<i data-lucide="music-2"></i>`;
  $("#duration").textContent = track.duration ? formatTime(track.duration) : "0:00";
  $("#currentTime").textContent = "0:00";
  progress.value = 0;
  playButton.disabled = !track.preview;
  updateFavoriteCount();
  if (track.preview) audio.src = track.preview;
  renderTracks();
  renderIcons();
  if (!track.preview) {
    setPlayIcon();
    toast("Esta faixa não tem prévia de áudio disponível.");
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
  renderIcons();
}

function togglePlay() {
  if (!state.currentId) {
    const firstPreview = state.visibleTracks.find(track => track.preview);
    if (firstPreview) setPlayerTrack(firstPreview);
    return;
  }
  if (audio.paused) {
    audio.play().then(setPlayIcon).catch(() => toast("Não foi possível tocar a prévia. Tente novamente."));
  } else {
    audio.pause();
    setPlayIcon();
  }
}

function moveTrack(direction) {
  if (!state.visibleTracks.length) return;
  const currentIndex = state.visibleTracks.findIndex(track => track.id === state.currentId);
  let nextIndex;
  if (state.shuffle && direction > 0) {
    nextIndex = Math.floor(Math.random() * state.visibleTracks.length);
  } else {
    nextIndex = (currentIndex + direction + state.visibleTracks.length) % state.visibleTracks.length;
  }
  setPlayerTrack(state.visibleTracks[nextIndex]);
}

function toggleFavorite(trackId = state.currentId) {
  if (!trackId) {
    toast("Escolha uma música primeiro.");
    return;
  }
  const wasLiked = state.favorites.has(trackId);
  if (wasLiked) state.favorites.delete(trackId);
  else state.favorites.add(trackId);
  try {
    localStorage.setItem("flashmusic:favorites", JSON.stringify([...state.favorites]));
  } catch (error) {
    console.error("Não foi possível salvar as faixas curtidas.", error);
    toast("Não foi possível salvar suas faixas neste navegador.");
  }
  updateFavoriteCount();
  renderTracks();
  toast(wasLiked ? "Faixa removida das curtidas." : "Faixa adicionada às curtidas.");
}

trackList.addEventListener("click", event => {
  const playControl = event.target.closest("[data-play]");
  const likeControl = event.target.closest("[data-like]");
  if (playControl && !playControl.disabled) {
    const track = state.visibleTracks.find(item => item.id === playControl.dataset.play);
    if (track?.id === state.currentId) togglePlay();
    else setPlayerTrack(track);
  }
  if (likeControl) toggleFavorite(likeControl.dataset.like);
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
  toast(state.repeat ? "Repetição ativada." : "Repetição desativada.");
});
audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  progress.value = String(audio.currentTime / audio.duration * 100);
  $("#currentTime").textContent = formatTime(audio.currentTime);
  $("#duration").textContent = formatTime(audio.duration);
});
audio.addEventListener("ended", () => {
  if (state.repeat) {
    audio.currentTime = 0;
    audio.play().catch(() => toast("Não foi possível repetir a prévia."));
  } else {
    moveTrack(1);
  }
});
audio.addEventListener("error", () => {
  if (state.currentId) toast("Não foi possível carregar esta prévia de áudio.");
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
$("#favoritesLink").addEventListener("click", event => {
  event.preventDefault();
  searchInput.value = "";
  state.searchSequence++;
  clearTimeout(state.searchTimer);
  state.visibleTracks = state.tracks.filter(track => state.favorites.has(track.id));
  state.showAll = true;
  $("#tracksHeading").textContent = "Suas faixas curtidas";
  setCatalogStatus(`${state.visibleTracks.length} faixa(s) salva(s) neste navegador.`);
  renderTracks();
  renderArtists();
  renderProducers();
  $("#tracks").scrollIntoView({ behavior: "smooth" });
});
document.querySelectorAll(".vibe-card").forEach(button => button.addEventListener("click", () => {
  searchInput.value = "";
  state.searchSequence++;
  clearTimeout(state.searchTimer);
  const vibe = button.dataset.vibe;
  state.visibleTracks = state.tracks.filter(track => track.vibe === vibe);
  state.showAll = true;
  $("#tracksHeading").textContent = vibe;
  setCatalogStatus(`Descobertas de ${vibe} no catálogo global.`);
  renderTracks();
  renderArtists();
  renderProducers();
  $("#tracks").scrollIntoView({ behavior: "smooth" });
}));

searchInput.addEventListener("input", event => {
  clearTimeout(state.searchTimer);
  const query = event.target.value.trim();
  const sequence = ++state.searchSequence;
  state.searchTimer = setTimeout(() => searchCatalog(query, sequence), 350);
});
$("#createPlaylist").addEventListener("click", () => {
  const name = prompt("Qual será o nome da sua playlist?");
  if (!name?.trim()) return;
  const link = document.createElement("a");
  link.href = "#tracks";
  const dot = document.createElement("span");
  dot.className = "playlist-dot green";
  link.append(dot, document.createTextNode(name.trim()));
  $("#playlistLinks").append(link);
  toast("Playlist criada nesta sessão.");
});
$("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
document.addEventListener("click", event => {
  if (window.innerWidth <= 800 && !event.target.closest("#sidebar") && !event.target.closest("#menuToggle")) {
    $("#sidebar").classList.remove("open");
  }
});
document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.code === "Space" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    togglePlay();
  }
});

try {
  const savedFavorites = JSON.parse(localStorage.getItem("flashmusic:favorites") || "[]");
  if (Array.isArray(savedFavorites)) state.favorites = new Set(savedFavorites.map(String));
} catch (error) {
  console.error("Não foi possível ler as faixas curtidas salvas.", error);
  toast("Não foi possível carregar suas faixas curtidas.");
}
renderProducers();
updateFavoriteCount();
renderIcons();
loadGlobalCatalog();
