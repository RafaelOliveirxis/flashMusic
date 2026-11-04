const tracks=[
 {title:"Midnight Drive",artist:"The Velvet Echo",genre:"Indie",duration:"3:42",time:222,color:"linear-gradient(140deg,#f1a9d2,#62418c)",audio:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"},
 {title:"Neon Lights",artist:"Luna Stereo",genre:"Eletrônica",duration:"4:16",time:256,color:"linear-gradient(140deg,#ffc17b,#a84c70)",audio:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"},
 {title:"Golden Hour",artist:"June Avenue",genre:"Pop",duration:"3:28",time:208,color:"linear-gradient(140deg,#f6d18b,#b76e58)",audio:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"},
 {title:"Blue Skies",artist:"Ocean Bloom",genre:"R&B",duration:"4:02",time:242,color:"linear-gradient(140deg,#a4d9e8,#425d9a)",audio:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"},
 {title:"Afterglow",artist:"Nova Days",genre:"Pop",duration:"3:51",time:231,color:"linear-gradient(140deg,#d7a6ff,#654da6)",audio:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"},
 {title:"Soft Focus",artist:"Mira Sol",genre:"Indie",duration:"3:36",time:216,color:"linear-gradient(140deg,#a5d7bb,#3d746a)",audio:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3"}
];
const albums=[["Velvet Nights","The Velvet Echo","a1"],["Sunset Frequency","Luna Stereo","a2"],["Somewhere Blue","Ocean Bloom","a3"],["Dream State","Nova Days","a4"]];
const audio=document.querySelector("#audio"),list=document.querySelector("#trackList"),playButton=document.querySelector("#playButton"),progress=document.querySelector("#progress");
let current=-1,filtered=[...tracks],favorites=new Set(),shuffle=false,repeat=false;
const $=s=>document.querySelector(s);
function icons(){if(window.lucide)lucide.createIcons()}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
function renderTracks(items=filtered){list.innerHTML=items.map((t,i)=>{const index=tracks.indexOf(t);return `<div class="track-row ${index===current?"playing":""}" data-index="${index}"><span class="track-number">${String(index+1).padStart(2,"0")}</span><div class="track-name"><div class="track-cover" style="background:${t.color}">♫</div><div class="track-name-text"><strong>${t.title}</strong><span>${t.artist}</span></div></div><span class="track-genre">${t.genre}</span><span class="track-duration">${t.duration}</span><button class="track-play" data-play="${index}" aria-label="Tocar ${t.title}"><i data-lucide="${index===current&&!audio.paused?"pause":"play"}"></i></button></div>`}).join("");icons()}
function renderAlbums(){$("#albumGrid").innerHTML=albums.map((a,i)=>`<article class="album-card" data-album="${i}"><div class="album-art ${a[2]}"><i data-lucide="disc-3"></i></div><strong>${a[0]}</strong><p>${a[1]} · Coleção</p></article>`).join("");icons()}
function setPlayIcon(){playButton.innerHTML=`<i data-lucide="${audio.paused?"play":"pause"}"></i>`;icons()}
function selectTrack(index,autoplay=true){if(index<0||index>=tracks.length)return;current=index;const t=tracks[index];audio.src=t.audio;$("#playerTitle").textContent=t.title;$("#playerArtist").textContent=t.artist;$("#playerCover").style.background=t.color;$("#playerCover").textContent="♫";$("#duration").textContent=t.duration;$("#currentTime").textContent="0:00";progress.value=0;renderTracks();if(autoplay){audio.play().then(setPlayIcon).catch(()=>{setPlayIcon();toast("Toque em reproduzir para ouvir esta faixa.")})}else setPlayIcon()}
function togglePlay(){if(current<0){selectTrack(0);return}if(audio.paused)audio.play().then(setPlayIcon).catch(()=>toast("Não foi possível iniciar o áudio."));else{audio.pause();setPlayIcon()}}
function formatTime(n){if(!Number.isFinite(n))return"0:00";return Math.floor(n/60)+":"+String(Math.floor(n%60)).padStart(2,"0")}
list.addEventListener("click",e=>{const btn=e.target.closest("[data-play]");if(btn){const i=Number(btn.dataset.play);if(i===current)togglePlay();else selectTrack(i)}});
playButton.addEventListener("click",togglePlay);
audio.addEventListener("timeupdate",()=>{if(audio.duration){progress.value=audio.currentTime/audio.duration*100;$("#currentTime").textContent=formatTime(audio.currentTime);$("#duration").textContent=formatTime(audio.duration)}});
audio.addEventListener("ended",()=>{if(repeat){audio.currentTime=0;audio.play()}else next()});
progress.addEventListener("input",()=>{if(audio.duration)audio.currentTime=progress.value/100*audio.duration});
$("#volume").addEventListener("input",e=>audio.volume=Number(e.target.value));audio.volume=.7;
function next(){if(!tracks.length)return;selectTrack(shuffle?Math.floor(Math.random()*tracks.length):(current+1)%tracks.length)}
function previous(){if(audio.currentTime>3){audio.currentTime=0;return}selectTrack((current-1+tracks.length)%tracks.length)}
$("#nextTrack").addEventListener("click",next);$("#prevTrack").addEventListener("click",previous);$("#forwardButton").addEventListener("click",next);$("#backButton").addEventListener("click",previous);
$("#shuffleButton").addEventListener("click",()=>{shuffle=!shuffle;$("#shuffleButton").style.color=shuffle?"#b99aff":"";toast(shuffle?"Modo aleatório ativado":"Modo aleatório desativado")});
$("#repeatButton").addEventListener("click",()=>{repeat=!repeat;$("#repeatButton").style.color=repeat?"#b99aff":"";toast(repeat?"Repetição ativada":"Repetição desativada")});
$("#favoriteButton").addEventListener("click",()=>{if(current<0){toast("Escolha uma música primeiro");return}favorites.has(current)?favorites.delete(current):favorites.add(current);$("#favoriteButton").style.color=favorites.has(current)?"#ed83bd":"";toast(favorites.has(current)?"Adicionada às favoritas":"Removida das favoritas")});
$("#heroPlay").addEventListener("click",()=>selectTrack(0));
$("#searchInput").addEventListener("input",e=>{const q=e.target.value.toLocaleLowerCase("pt-BR");filtered=tracks.filter(t=>[t.title,t.artist,t.genre].some(v=>v.toLocaleLowerCase("pt-BR").includes(q)));renderTracks();if(q)$("#tracks").scrollIntoView({behavior:"smooth",block:"start"})});
document.querySelectorAll(".vibe-card").forEach(b=>b.addEventListener("click",()=>{const genre=b.dataset.filter;$("#searchInput").value=genre;filtered=tracks.filter(t=>t.genre===genre);renderTracks();$("#tracks").scrollIntoView({behavior:"smooth"})}));
$("#createPlaylist").addEventListener("click",()=>{const name=prompt("Qual será o nome da sua playlist?");if(name&&name.trim()){const a=document.createElement("a");a.href="#library";a.innerHTML='<span class="playlist-dot purple"></span>';a.append(document.createTextNode(name.trim()));$("#playlistLinks").append(a);toast("Playlist criada!")}}); 
$("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
document.addEventListener("click",e=>{if(window.innerWidth<=800&&!e.target.closest("#sidebar")&&!e.target.closest("#menuToggle"))$("#sidebar").classList.remove("open")});
document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#searchInput").focus()}if(e.code==="Space"&&!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)){e.preventDefault();togglePlay()}});
renderTracks();renderAlbums();icons();