/* ============================================================
   CAPESSA STUDIOS — loader.js
   Carrega dados do Firebase Realtime Database e popula as páginas
   ============================================================ */

'use strict';

/* ── Firebase config ──────────────────────────────────────── */
const FB_DB_URL = 'https://capessa-studios-default-rtdb.europe-west1.firebasedatabase.app';


/* ── Download tracker ─────────────────────────────────────────
   Incrementa settings/stats/downloads no Firebase via REST.
   Usa transação read→write para ser thread-safe.
   Chamado em onclick de qualquer link de download/play. */
async function trackDownload() {
  try {
    const url = `${FB_DB_URL}/settings/stats/downloads.json`;
    // Lê valor actual
    const res = await fetch(url);
    const current = (await res.json()) || 0;
    // Escreve incrementado
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current + 1),
    });
  } catch(e) {
    // Falha silenciosa — não bloqueia o utilizador
  }
}

/* ── Firebase REST fetcher ────────────────────────────────── */
/* Lê uma coleção do Firebase e devolve os dados no mesmo formato
   que os antigos ficheiros JSON, para que todo o código de
   renderização abaixo não precise de mudar. */
/* ── Normaliza raw Firebase (objecto chave→item) para array com wrapper ── */
function normalizeCollection(collection, raw) {
  if (!raw || typeof raw !== 'object') return null;
  // Se já vier como array (improvável no Firebase REST mas por segurança)
  const arr = Array.isArray(raw) ? raw : Object.values(raw);
  if (!arr.length) return null;

  if (collection === 'settings') return raw;
  if (collection === 'news')    { arr.sort((a,b) => new Date(b.date)-new Date(a.date)); return { news: arr }; }
  if (collection === 'updates') { arr.sort((a,b) => new Date(b.date)-new Date(a.date)); return { updates: arr }; }
  if (collection === 'games')   { arr.sort((a,b) => (b.featured?1:0)-(a.featured?1:0) || (a.name||'').localeCompare(b.name||'')); return { games: arr }; }
  if (collection === 'apps')    { arr.sort((a,b) => (a.name||'').localeCompare(b.name||'')); return { apps: arr }; }
  if (collection === 'tools')   { arr.sort((a,b) => (b.featured?1:0)-(a.featured?1:0) || (a.name||'').localeCompare(b.name||'')); return { tools: arr }; }
  if (collection === 'lab')     { arr.sort((a,b) => (b.featured?1:0)-(a.featured?1:0) || (a.name||'').localeCompare(b.name||'')); return { lab: arr }; }
  return arr;
}

async function fetchData(collection) {
  // ── Tentativa 1: Firebase Realtime Database REST ──
  try {
    const res = await fetch(`${FB_DB_URL}/${collection}.json`);
    if (res.status === 401 || res.status === 403) {
      console.warn(`[Loader] Firebase bloqueou leitura de "${collection}" (${res.status}). Regras não permitem leitura pública. A usar fallback local.`);
    } else if (res.ok) {
      const raw = await res.json();
      if (raw) {
        const result = normalizeCollection(collection, raw);
        if (result) return result;
      }
      // raw === null significa colecção vazia no Firebase
      console.info(`[Loader] "${collection}" vazio no Firebase — a tentar ficheiro local.`);
    } else {
      console.warn(`[Loader] Firebase REST erro ${res.status} para "${collection}".`);
    }
  } catch (e) {
    console.warn(`[Loader] Falha de rede ao ler "${collection}" do Firebase:`, e.message);
  }

  // ── Tentativa 2: ficheiro JSON local em data/ ──
  try {
    const base = getBasePath();
    const res  = await fetch(`${base}data/${collection}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    console.info(`[Loader] "${collection}" carregado do ficheiro local.`);
    // Ficheiros locais já têm o wrapper { tools: [...] } — devolve directamente
    return json;
  } catch (e) {
    console.warn(`[Loader] Sem dados locais para "${collection}":`, e.message);
    return null;
  }
}

/* ── Retrocompatibilidade: mapeia os caminhos JSON antigos ── */
/* Chamado por qualquer código externo que ainda use fetchJSON */
async function fetchJSON(path) {
  const map = {
    'games.json':    'games',
    'apps.json':     'apps',
    'news.json':     'news',
    'updates.json':  'updates',
    'settings.json': 'settings',
  };
  /* Extrai o nome do ficheiro do caminho completo */
  const filename = path.split('/').pop();
  const collection = map[filename];
  if (collection) return fetchData(collection);

  /* Fallback: tenta HTTP normal (por segurança) */
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[Loader] Falha ao carregar ${path}:`, e);
    return null;
  }
}

/* ── Path resolver (works from any page depth) ────────────── */
function getBasePath() {
  const depth = (window.location.pathname.match(/\//g) || []).length - 1;
  return depth <= 0 ? './' : '../'.repeat(depth);
}

/* ── Category color map ───────────────────────────────────── */
const CATEGORY_COLORS = {
  'Lançamento': '#4ADE80',
  'Atualização': '#60A5FA',
  'Conteúdo':   '#F59E0B',
  'Estúdio':    '#D4AF37',
  'Evento':     '#A78BFA',
};

/* ── Description formatter — preserva parágrafos e quebras ── */
function formatDescription(text) {
  if (!text) return '';
  // Escapa HTML para evitar XSS
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Divide por linhas duplas (parágrafos) e linhas simples
  return escaped
    .split(/\n{2,}/)                        // parágrafos separados por linha em branco
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/* ── Date formatter ───────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('pt-PT', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return dateStr; }
}

/* ── Relative time ────────────────────────────────────────── */
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 30)  return `há ${days} dias`;
  if (days < 365) return `há ${Math.floor(days/30)} meses`;
  return `há ${Math.floor(days/365)} anos`;
}

/* ── Status badge ─────────────────────────────────────────── */
function statusBadge(status) {
  const map = {
    released:    { label: 'Lançado',           cls: 'released' },
    beta:        { label: 'Beta',              cls: 'beta' },
    'in-dev':    { label: 'Em Desenvolvimento', cls: 'dev' },
    'coming-soon':{ label: 'Em Breve',         cls: 'soon' },
  };
  const s = map[status] || { label: status, cls: '' };
  return `<span class="card-badge ${s.cls}">${s.label}</span>`;
}

/* ── Platform icons ───────────────────────────────────────── */
function platformChips(platforms = []) {
  return platforms.map(p => `<span class="platform-chip">${p}</span>`).join('');
}

/* ── Resolve link de uma tool/experimento: URL externa dada,
   ou página de detalhe interna quando não há URL definida ── */
function toolLinkAttrs(item, base, kind = 'tools') {
  // Card sempre abre a página de detalhe — a URL da tool fica no detalhe
  return { href: `${base}${kind}/detail.html?id=${item.id}`, targetAttr: '' };
}

/* ── Resolve path: URL absoluto fica intacto, relativo recebe base ── */
function resolveImg(path, base) {
  if (!path) return '';
  return /^https?:\/\//.test(path) ? path : base + path;
}

/* ── Card image with graceful fallback ────────────────────── */
/* ── Fallback global para imagens de card quebradas ──────────
   Registado uma vez aqui, chamado por onerror="csImgErr(this)"
   no atributo HTML — sem aspas aninhadas, sem SyntaxError.    */
window.csImgErr = function(img) {
  const el    = img.parentElement;
  const color = img.dataset.color  || '#D4AF37';
  const fa    = img.dataset.fa     || '';
  const init  = img.dataset.init   || '?';
  img.remove();
  if (fa) {
    el.insertAdjacentHTML('afterbegin',
      `<i class="${fa}" style="font-size:2.8rem;color:${color};opacity:.55;" aria-hidden="true"></i>`);
  } else {
    el.insertAdjacentHTML('afterbegin',
      `<div class="card-image-placeholder" style="color:${color};opacity:0.35;">${init}</div>`);
  }
};

function cardImageHTML(name, imagePath, color, base, faIcon) {
  const initials = (name||'?').split(' ').map(w => w[0]).join('').slice(0,3);

  if (!imagePath) {
    if (faIcon) {
      return `<i class="${faIcon}" style="font-size:2.8rem;color:${color};opacity:.55;" aria-hidden="true"></i>`;
    }
    return `<div class="card-image-placeholder" aria-hidden="true" style="color:${color};opacity:0.35;">${initials}</div>`;
  }

  // data-attrs passam os dados ao handler global sem aspas aninhadas
  return `<img src="${resolveImg(imagePath, base)}" alt="${name}" loading="lazy"
       class="card-image-photo"
       data-color="${color}" data-fa="${faIcon||''}" data-init="${initials}"
       onerror="csImgErr(this)" />`;
}

/* ============================================================
   HOME PAGE LOADERS
   ============================================================ */

/* ── Featured games grid ─────────────────────────────────── */
async function loadFeaturedGames(base) {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  const data = await fetchData('games');
  if (!data?.games?.length) return;

  const featured = data.games.filter(g => g.featured);
  if (!featured.length) return;

  const cards = featured.map(game => `
    <article class="project-card reveal" tabindex="0" aria-label="${game.name}">
      <div class="card-image" style="background:linear-gradient(135deg, ${game.color}18, var(--bg-3));">
        ${cardImageHTML(game.name, game.image, game.color, base)}
      </div>
      <div class="card-body">
        <div class="card-meta">
          ${statusBadge(game.status)}
          <span class="card-badge">${game.category}</span>
          <span class="card-badge" style="color:var(--text-3);">v${game.version}</span>
        </div>
        <h3 class="card-title">${game.name}</h3>
        <p class="card-desc">${game.shortDesc}</p>
        <div class="card-footer">
          <div class="card-platforms">${platformChips(game.platforms)}</div>
          <a href="${base}projects/detail.html?id=${game.id}" class="card-link" aria-label="Ver ${game.name}">
            Ver mais <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </article>
  `).join('');

  const remaining = Math.max(0, 3 - featured.length);
  const placeholders = Array(remaining).fill(`
    <article class="project-card reveal" style="opacity:0.4;pointer-events:none;" aria-label="Projeto em desenvolvimento">
      <div class="card-image">
        <div class="card-image-placeholder" aria-hidden="true">?</div>
      </div>
      <div class="card-body">
        <div class="card-meta"><span class="card-badge">Em Breve</span></div>
        <h3 class="card-title">Projeto Secreto</h3>
        <p class="card-desc">Algo novo está a ser desenvolvido. Fique atento.</p>
        <div class="card-footer">
          <div class="card-platforms"><span class="platform-chip">TBA</span></div>
        </div>
      </div>
    </article>
  `).join('');

  grid.innerHTML = cards + placeholders;

  grid.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.1}s`;
    if (window.ScrollReveal) ScrollReveal.observe(el);
    else el.classList.add('visible');
  });
}

/* ── News feed ────────────────────────────────────────────── */
async function loadNewsFeed(base) {
  const feed = document.getElementById('updates-feed');
  if (!feed) return;

  const data = await fetchData('news');
  if (!data?.news?.length) {
    feed.innerHTML = '<p class="no-content">Sem atualizações por agora.</p>';
    return;
  }

  const items = data.news.slice(0, 4).map((item, i) => {
    const color = CATEGORY_COLORS[item.category] || 'var(--gold)';
    return `
      <article class="update-card reveal reveal-delay-${i+1}" aria-label="${item.title}">
        <div class="update-card-top">
          <span class="update-cat" style="color:${color}; background:${color}15; border-color:${color}30;">
            <i class="${item.categoryIcon || 'fas fa-circle'}" aria-hidden="true"></i>
            ${item.category}
          </span>
          <time class="update-date" datetime="${item.date}" title="${formatDate(item.date)}">
            ${relativeTime(item.date)}
          </time>
        </div>
        <h3 class="update-title">${item.title}</h3>
        <p class="update-summary">${item.summary}</p>
        ${item.game ? `
          <a href="${base}projects/detail.html?id=${item.game}" class="update-link">
            Ver projeto <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </a>
        ` : `
          <a href="${base}pages/news.html" class="update-link">
            Ler mais <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </a>
        `}
      </article>
    `;
  }).join('');

  feed.innerHTML = items;

  feed.querySelectorAll('.reveal').forEach(el => {
    if (window.ScrollReveal) ScrollReveal.observe(el);
    else el.classList.add('visible');
  });
}

/* ── Stats from settings ─────────────────────────────────── */
async function loadStats(base) {
  const data = await fetchData('settings');
  if (!data?.stats) return;

  const s = data.stats;

  // Mapa: selector → valor do settings.json
  // Suporta os campos actuais e futuros — ignora os que não existam na página
  const map = {
    '[data-stat="games"]':     s.games,
    '[data-stat="downloads"]': s.downloads,
    '[data-stat="players"]':   s.players,
    '[data-stat="platforms"]': s.platforms,
    '[data-stat="countries"]': s.countries,
    '[data-stat="founded"]':   s.founded,
    '[data-stat="cards"]':     s.cards,
  };

  Object.entries(map).forEach(([sel, val]) => {
    if (val == null) return;
    const el = document.querySelector(sel);
    if (!el) return;
    // Números animados pelo main.js via data-count
    if (typeof val === 'number') {
      el.dataset.count = val;
      el.textContent   = val + (el.dataset.suffix || '');
    } else {
      // Texto simples (ex: "2024") — não anima
      el.textContent = val;
    }
  });
}

/* ============================================================
   GAMES PAGE LOADER
   ============================================================ */
async function loadGamesPage(base) {
  const grid = document.getElementById('games-grid');
  if (!grid) return;

  const data = await fetchData('games');
  if (!data?.games?.length) {
    grid.innerHTML = '<p class="no-content">Nenhum jogo encontrado.</p>';
    return;
  }

  renderGamesGrid(grid, data.games, base);
  initFilters(data.games, grid, base);
}

function renderGamesGrid(grid, games, base) {
  if (!games.length) {
    grid.innerHTML = '<p class="no-content" style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:40px 0;">Nenhum resultado encontrado.</p>';
    return;
  }

  grid.innerHTML = games.map((game, i) => `
    <article class="project-card reveal reveal-delay-${(i%4)+1}" data-category="${game.category}" data-status="${game.status}" tabindex="0" aria-label="${game.name}">
      <div class="card-image" style="background:linear-gradient(135deg, ${game.color}18, var(--bg-3));">
        ${cardImageHTML(game.name, game.image, game.color, base)}
      </div>
      <div class="card-body">
        <div class="card-meta">
          ${statusBadge(game.status)}
          <span class="card-badge">${game.category}</span>
        </div>
        <h3 class="card-title">${game.name}</h3>
        <p class="card-desc">${game.shortDesc}</p>
        <div class="card-features">
          ${game.features.slice(0,3).map(f => `<span class="feature-tag"><i class="fas fa-check" aria-hidden="true"></i> ${f}</span>`).join('')}
        </div>
        <div class="card-footer">
          <div class="card-platforms">${platformChips(game.platforms)}</div>
          <a href="${base}projects/detail.html?id=${game.id}" class="card-link">
            Ver mais <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.reveal').forEach(el => {
    if (window.ScrollReveal) ScrollReveal.observe(el);
    else el.classList.add('visible');
  });
}

function initFilters(games, grid, base) {
  const filterBtns = document.querySelectorAll('[data-filter]');
  const searchInput = document.getElementById('games-search');

  let activeFilter = 'all';
  let searchQuery  = '';

  function applyFilters() {
    let filtered = [...games];
    if (activeFilter !== 'all') {
      if (activeFilter.startsWith('platform-')) {
        // Filtro por plataforma: platform-web → filtra games que têm 'Web' nas platforms
        const plat = activeFilter.replace('platform-', '').replace(/-/g, ' ');
        filtered = filtered.filter(g =>
          g.platforms?.some(p => p.toLowerCase() === plat.toLowerCase())
        );
      } else {
        filtered = filtered.filter(g =>
          g.category.toLowerCase() === activeFilter ||
          g.status.toLowerCase()   === activeFilter
        );
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    renderGamesGrid(grid, filtered, base);
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  searchInput?.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    applyFilters();
  });
}

/* ============================================================
   NEWS PAGE LOADER
   ============================================================ */
async function loadNewsPage(base) {
  const feed = document.getElementById('news-feed');
  if (!feed) return;

  const data = await fetchData('news');
  if (!data?.news?.length) {
    feed.innerHTML = '<p class="no-content">Sem notícias por enquanto.</p>';
    return;
  }

  feed.innerHTML = data.news.map((item, i) => {
    const color = CATEGORY_COLORS[item.category] || 'var(--gold)';
    const imgHTML = item.image
      ? `<div class="news-card-image">
           <img src="${resolveImg(item.image, base)}" alt="${item.title}"
                loading="lazy" data-init="" onerror="this.closest('.news-card-image').style.display='none'" />
         </div>`
      : '';
    return `
      <article class="news-card reveal reveal-delay-${(i%4)+1}" ${item.featured ? 'data-featured="true"' : ''}>
        ${imgHTML}
        <div class="news-card-body">
          <div class="news-card-inner">
            <div class="news-card-left">
              <span class="update-cat" style="color:${color};background:${color}15;border-color:${color}30;">
                <i class="${item.categoryIcon || 'fas fa-circle'}" aria-hidden="true"></i>
                ${item.category}
              </span>
              ${item.featured ? '<span class="news-featured-badge"><i class="fas fa-star"></i> Destaque</span>' : ''}
              <h2 class="news-title">${item.title}</h2>
              <p class="news-summary">${item.summary}</p>
              <time class="update-date" datetime="${item.date}">${formatDate(item.date)}</time>
            </div>
          </div>
          <div class="news-tags">
            ${(item.tags||[]).map(t => `<span class="news-tag">#${t}</span>`).join('')}
          </div>
        </div>
      </article>
    `;
  }).join('');

  feed.querySelectorAll('.reveal').forEach(el => {
    if (window.ScrollReveal) ScrollReveal.observe(el);
    else el.classList.add('visible');
  });
}

/* ============================================================
   PROJECT DETAIL PAGE LOADER
   ============================================================ */
function extractVideoId(url) {
  if (!url) return null;
  const ytShort  = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  const ytWatch  = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  const ytOther  = url.match(/youtube\.com\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
  const ytId = (ytShort || ytWatch || ytOther)?.[1] || null;
  if (ytId) return { provider: 'youtube', id: ytId };

  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return { provider: 'vimeo', id: vmMatch[1] };

  return null;
}

function trailerEmbedHTML(trailerUrl) {
  const video = extractVideoId(trailerUrl);
  if (!video) {
    return `
      <div class="trailer-wrapper">
        <div class="trailer-placeholder">
          <i class="fas fa-video" aria-hidden="true"></i>
          <p>Trailer em breve</p>
        </div>
      </div>`;
  }

  let thumbURL, embedURL;
  if (video.provider === 'youtube') {
    thumbURL = `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`;
    embedURL = `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&mute=0&rel=0`;
  } else {
    thumbURL = '';
    embedURL = `https://player.vimeo.com/video/${video.id}?autoplay=1`;
  }

  return `
    <div class="trailer-wrapper" id="trailer-container">
      <div class="trailer-thumb" data-embed="${encodeURIComponent(embedURL)}" data-provider="${video.provider}" data-id="${video.id}" style="${thumbURL ? `background-image:url('${thumbURL}')` : ''}">
        <div class="trailer-play-btn" aria-label="Reproduzir trailer">
          <i class="fas fa-play" aria-hidden="true"></i>
        </div>
        ${video.provider === 'vimeo' ? `<div class="trailer-thumb-loading"><div class="spinner" style="width:32px;height:32px;"></div></div>` : ''}
      </div>
    </div>`;
}

function initTrailer(base) {
  const container = document.getElementById('trailer-container');
  if (!container) return;

  const thumb = container.querySelector('.trailer-thumb');
  if (!thumb) return;

  if (thumb.dataset.provider === 'vimeo') {
    const id = thumb.dataset.id;
    fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.thumbnail_url) {
          thumb.style.backgroundImage = `url('${d.thumbnail_url}')`;
          const loading = thumb.querySelector('.trailer-thumb-loading');
          if (loading) loading.remove();
        }
      })
      .catch(() => {});
  }

  thumb.addEventListener('click', () => {
    const embedURL = decodeURIComponent(thumb.dataset.embed);
    container.innerHTML = `<iframe class="trailer-iframe" src="${embedURL}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  });
}

/* ── Social list normalizer — usado em footer, contact e fundador ── */

/* ── safeUrl ──────────────────────────────────────────────────
   Garante que qualquer URL/email tem o protocolo correto.
   - email@dominio.com  → mailto:email@dominio.com
   - github.com/foo     → https://github.com/foo
   - https://...        → mantém igual
   - vazio / '#'        → '' (sem link)
─────────────────────────────────────────────────────────────── */
function safeUrl(raw) {
  if (!raw) return '';
  const s = raw.trim();
  if (!s || s === '#') return '';
  if (/^(mailto:|tel:|https?:\/\/)/i.test(s)) return s;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return 'mailto:' + s;
  return 'https://' + s;
}

function parseSocialList(raw) {
  if (!raw) return [];
  // Mantém TODAS as entradas — filtra apenas as sem label E sem url
  if (Array.isArray(raw)) return raw.filter(s => safeUrl(s.url));
  // formato legado: { github: 'url', itchio: 'url', ... }
  const iconMap = {
    github:   'fab fa-github',
    itchio:   'fab fa-itch-io',
    twitter:  'fab fa-x-twitter',
    youtube:  'fab fa-youtube',
    instagram:'fab fa-instagram',
    facebook: 'fab fa-facebook',
    tiktok:   'fab fa-tiktok',
    discord:  'fab fa-discord',
    linkedin: 'fab fa-linkedin',
    twitch:   'fab fa-twitch',
    telegram: 'fab fa-telegram',
    whatsapp: 'fab fa-whatsapp',
  };
  return Object.entries(raw)
    .filter(([, url]) => url?.trim())
    .map(([key, url]) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      icon:  iconMap[key] || 'fas fa-link',
      url,
    }));
}

// Normaliza game.links para um array de { label, url, icon, meta, cta }
// Suporta o novo formato (array flexível) e o formato antigo (objeto fixo), para não partir dados existentes.
function normalizeLinks(game) {
  const raw = game.links;
  if (Array.isArray(raw)) return raw.filter(l => l && l.url);

  // Formato antigo: { play, download, itchio, github }
  const legacy = raw || {};
  const out = [];
  if (legacy.play)     out.push({ label: 'Web',     url: legacy.play,     icon: 'fas fa-globe',   meta: 'Jogar no navegador', cta: 'primary' });
  if (legacy.download) out.push({ label: 'Download', url: legacy.download, icon: 'fas fa-download', meta: 'Download direto',    cta: 'secondary' });
  if (legacy.itchio)   out.push({ label: 'itch.io',  url: legacy.itchio,   icon: 'fab fa-itch-io', meta: 'Página itch.io' });
  if (legacy.github)   out.push({ label: 'GitHub',   url: legacy.github,   icon: 'fab fa-github',  meta: 'GitHub Releases' });
  return out;
}

async function loadProjectPage(base) {
  const projectId = document.body.dataset.project;
  if (!projectId) return;

  const [gamesData, appsData, newsData, updatesData] = await Promise.all([
    fetchData('games'),
    fetchData('apps'),
    fetchData('news'),
    fetchData('updates'),
  ]);

  const game = gamesData?.games?.find(g => g.id === projectId)
            || appsData?.apps?.find(a => a.id === projectId);
  if (!game) return;

  // Hero
  const logo = document.getElementById('project-logo');
  if (logo) {
    const initials = game.name.split(' ').map(w => w[0]).join('');
    if (game.icon) {
      logo.innerHTML = `<img src="${resolveImg(game.icon, base)}" alt="" loading="lazy"
        data-init="${initials}" onerror="this.parentElement.textContent=this.dataset.init;" />`;
    } else {
      logo.textContent = initials;
    }
  }

  const titleEl = document.getElementById('project-name');
  if (titleEl) titleEl.textContent = game.name;

  const taglineEl = document.getElementById('project-tagline');
  if (taglineEl) taglineEl.textContent = game.shortDesc || '';

  const badgesEl = document.getElementById('project-badges');
  if (badgesEl) {
    badgesEl.innerHTML = `
      ${statusBadge(game.status)}
      <span class="card-badge">${game.category}</span>
      <span class="card-badge">v${game.version}</span>
    `;
  }

  const descEl = document.getElementById('project-description');
  if (descEl) descEl.innerHTML = formatDescription(game.description || game.shortDesc || '');

  // CTAs
  const gameLinks = normalizeLinks(game);
  const ctaEl = document.getElementById('project-ctas');
  if (ctaEl) {
    const primaryLink   = gameLinks.find(l => l.cta === 'primary');
    const secondaryLink = gameLinks.find(l => l.cta === 'secondary');
    ctaEl.innerHTML = `
      ${primaryLink
        ? `<a href="${primaryLink.url}" class="btn btn-primary" target="_blank" rel="noopener" onclick="trackDownload()"><i class="${primaryLink.icon || 'fas fa-play'}" aria-hidden="true"></i> ${primaryLink.label || 'Jogar Agora'}</a>`
        : `<span class="btn btn-primary" style="opacity:0.5;pointer-events:none;"><i class="fas fa-play" aria-hidden="true"></i> Em Breve</span>`
      }
      ${secondaryLink
        ? `<a href="${secondaryLink.url}" class="btn btn-secondary" target="_blank" rel="noopener" onclick="trackDownload()"><i class="${secondaryLink.icon || 'fas fa-download'}" aria-hidden="true"></i> ${secondaryLink.label || 'Download'}</a>`
        : ''
      }
    `;
  }

  // Info bar
  const infoEl = document.getElementById('project-info-bar');
  if (infoEl) {
    const stats = [
      ['Versão', `v${game.version}`],
      ['Tamanho', game.size],
      ['Lançamento', game.releaseDate],
      ['Categoria', game.category],
      ['Desenvolvedor', game.developer],
    ];
    infoEl.innerHTML = stats.filter(([,v]) => v).map(([label, value]) => `
      <div class="info-stat">
        <div class="info-stat-value">${value}</div>
        <div class="info-stat-label">${label}</div>
      </div>
    `).join('');
  }

  // Features
  const featEl = document.getElementById('project-features');
  if (featEl && game.features?.length) {
    featEl.innerHTML = game.features.map(f => `
      <div class="feature-item">
        <div class="feature-icon" aria-hidden="true"><i class="fas fa-check"></i></div>
        <div>
          <div class="feature-title">${f}</div>
        </div>
      </div>
    `).join('');
  }

  // Screenshots — carrossel horizontal
  const galleryEl = document.getElementById('project-gallery');
  if (galleryEl) {
    const items = game.screenshots?.length
      ? game.screenshots.map(src => `
          <div class="gallery-item">
            <img src="${resolveImg(src, base)}" alt="Screenshot de ${game.name}" loading="lazy" />
          </div>`).join('')
      : `<div class="gallery-item">Screenshot em breve</div>
         <div class="gallery-item">Screenshot em breve</div>
         <div class="gallery-item">Screenshot em breve</div>`;

    // Envolve a gallery-grid num wrapper e adiciona botões de navegação
    const wrapper = galleryEl.closest('.gallery-wrapper') || galleryEl.parentElement;
    galleryEl.innerHTML = items;

    // Só mostra botões se houver mais do que cabe (2+)
    if ((game.screenshots?.length || 0) > 1) {
      const nav = document.createElement('div');
      nav.className = 'gallery-nav';
      nav.innerHTML = `
        <button class="gallery-nav-btn" id="gallery-prev" aria-label="Anterior" title="Anterior">
          <i class="fas fa-chevron-left"></i>
        </button>
        <button class="gallery-nav-btn" id="gallery-next" aria-label="Seguinte" title="Seguinte">
          <i class="fas fa-chevron-right"></i>
        </button>`;
      galleryEl.after(nav);

      const SCROLL_AMOUNT = 320;

      const prevBtn = nav.querySelector('#gallery-prev');
      const nextBtn = nav.querySelector('#gallery-next');

      function updateNavBtns() {
        prevBtn.disabled = galleryEl.scrollLeft <= 4;
        nextBtn.disabled = galleryEl.scrollLeft + galleryEl.clientWidth >= galleryEl.scrollWidth - 4;
      }

      prevBtn.addEventListener('click', () => {
        galleryEl.scrollBy({ left: -SCROLL_AMOUNT, behavior: 'smooth' });
      });
      nextBtn.addEventListener('click', () => {
        galleryEl.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' });
      });
      galleryEl.addEventListener('scroll', updateNavBtns, { passive: true });

      updateNavBtns();
    }
  }

  // Platforms / downloads — grelha livre, um card por link definido em game.links
  const platEl = document.getElementById('project-platforms');
  if (platEl && gameLinks.length) {
    platEl.innerHTML = gameLinks.map(l => {
      const inner = `
        <i class="${l.icon || 'fas fa-download'}" aria-hidden="true"></i>
        <div class="platform-card-body">
          <div class="platform-card-name">${l.label}</div>
          <div class="platform-card-meta">${l.meta || ''}</div>
        </div>
        <i class="fas fa-arrow-up-right-from-square" aria-hidden="true" style="color:var(--text-3);font-size:0.75rem;"></i>
      `;
      return l.url
        ? `<a href="${l.url}" class="platform-card" target="_blank" rel="noopener" onclick="trackDownload()">${inner}</a>`
        : `<div class="platform-card disabled">${inner}</div>`;
    }).join('');
  }

  // Changelog
  const changelogEl = document.getElementById('project-changelog');
  if (changelogEl) {
    const versionUpdates = (updatesData?.updates || [])
      .filter(u => u.gameId === projectId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (versionUpdates.length) {
      changelogEl.innerHTML = versionUpdates.map(item => `
        <div class="changelog-item">
          <div class="changelog-version"><i class="fas fa-tag" aria-hidden="true"></i> v${item.version}</div>
          <div class="changelog-body">
            <h4>${item.title}</h4>
            ${item.changes?.length ? `
              <ul class="changelog-changes">
                ${item.changes.map(c => `<li>${c}</li>`).join('')}
              </ul>
            ` : ''}
            <time class="changelog-date" datetime="${item.date}">${formatDate(item.date)}</time>
          </div>
        </div>
      `).join('');
    } else {
      const related = (newsData?.news || []).filter(n => n.game === projectId);
      if (related.length) {
        changelogEl.innerHTML = related.map(item => `
          <div class="changelog-item">
            <div class="changelog-version"><i class="fas fa-tag" aria-hidden="true"></i> ${item.category}</div>
            <div class="changelog-body">
              <h4>${item.title}</h4>
              <p>${item.summary}</p>
              <time class="changelog-date" datetime="${item.date}">${formatDate(item.date)}</time>
            </div>
          </div>
        `).join('');
      } else {
        changelogEl.innerHTML = '<p class="no-content">Sem atualizações registadas ainda.</p>';
      }
    }
  }

  // Trailer
  const trailerSection = document.getElementById('project-trailer');
  if (trailerSection) {
    trailerSection.innerHTML = trailerEmbedHTML(game.trailer);
    initTrailer(base);
  }

  document.querySelectorAll('.reveal').forEach(el => {
    if (window.ScrollReveal) ScrollReveal.observe(el);
    else el.classList.add('visible');
  });

  document.title = `${game.name} — Capessa Studios`;
}

/* ============================================================
   ABOUT PAGE LOADER
   ============================================================ */
async function loadAboutPage(base) {
  const data = await fetchData('settings');
  if (!data?.studio) return;

  const { studio, stats } = data;

  const map = {
    '[data-field="founder"]':     studio.founder,
    '[data-field="founded"]':     studio.founded,
    '[data-field="tagline"]':     studio.tagline,
    '[data-field="description"]': studio.description,
  };
  Object.entries(map).forEach(([sel, val]) => {
    if (!val) return;
    document.querySelectorAll(sel).forEach(el => {
      if (sel.includes('description')) el.innerHTML = formatDescription(val);
      else el.textContent = val;
    });
  });

  // Iniciais do fundador (fallback sem foto)
  document.querySelectorAll('[data-field="founder-initials"]').forEach(el => {
    if (studio.founder)
      el.textContent = studio.founder.split(' ').map(w => w[0]).slice(0, 2).join('');
  });

  // Foto do fundador
  const photoEl = document.getElementById('founder-photo');
  if (photoEl) {
    const photoUrl = studio.founderPhoto || '';
    if (photoUrl) {
      photoEl.src = photoUrl;
      photoEl.style.display = 'block';
      const fallback = document.getElementById('founder-initials-banner');
      if (fallback) fallback.style.display = 'none';
    } else {
      photoEl.style.display = 'none';
      const fallback = document.getElementById('founder-initials-banner');
      if (fallback) fallback.style.display = 'flex';
    }
  }

  // Stats
  if (stats) {
    const statMap = {
      '[data-stat="games"]':     stats.games,
      '[data-stat="platforms"]': stats.platforms,
      '[data-stat="founded"]':   stats.founded,
    };
    Object.entries(statMap).forEach(([sel, val]) => {
      document.querySelectorAll(sel).forEach(el => {
        if (val != null) el.textContent = val;
      });
    });
  }

  // Links sociais no banner do fundador
  const socialContainer = document.getElementById('founder-social-links');
  if (socialContainer) {
    const socialList = parseSocialList(studio.founderSocial);
    if (socialList.length) {
      socialContainer.innerHTML = socialList.map(s => {
        const hasUrl = !!safeUrl(s.url);
        return `<a ${hasUrl ? `href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer"` : 'aria-disabled="true" tabindex="-1" style="opacity:.4;pointer-events:none;"'}
           class="founder-social-btn" aria-label="${s.label}">
          <i class="${s.icon || 'fas fa-link'}" aria-hidden="true"></i> ${s.label}
        </a>`;
      }).join('');
    }
  }

  // Carregar equipa
  // data.team existe se vier do JSON local (settings.json tem team na raiz)
  // No Firebase, settings/team é sub-nó separado — buscamos explicitamente
  let teamData = data.team || null;
  if (!teamData) {
    try {
      const res = await fetch(`${FB_DB_URL}/settings/team.json`);
      if (res.ok) teamData = await res.json();
    } catch (_) {}
  }
  loadTeam(teamData);
}

/* ============================================================
   TEAM LOADER
   Lê settings.team (array ou objeto Firebase) e renderiza
   a secção de equipa em about.html dinamicamente
   ============================================================ */
function loadTeam(teamRaw) {
  const container = document.getElementById('team-grid');
  if (!container) return;

  // teamRaw pode ser: null, array (JSON local) ou objeto Firebase {id: {...}}
  let members = [];
  if (Array.isArray(teamRaw)) {
    members = teamRaw;
  } else if (teamRaw && typeof teamRaw === 'object') {
    members = Object.values(teamRaw);
  }

  if (!members.length) {
    // Esconde a secção em vez de a remover — pode carregar mais tarde
    const section = container.closest('section');
    if (section) section.style.display = 'none';
    return;
  }

  // Garante que a secção está visível
  const section = container.closest('section');
  if (section) section.style.display = '';

  // Ordenar por campo order
  members.sort((a, b) => (a.order || 99) - (b.order || 99));

  container.innerHTML = members.map(member => {
    const initials = member.name
      ? member.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
      : '?';

    const socialList = parseSocialList(member.social);
    const socialHTML = socialList.length
      ? `<div class="team-card-social">
          ${socialList.map(s => {
            const hasUrl = !!safeUrl(s.url);
            return `<a ${hasUrl
                ? `href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer"`
                : `aria-disabled="true" tabindex="-1" style="opacity:.35;pointer-events:none;"`}
               class="team-social-btn" aria-label="${s.label}" title="${s.label}">
              <i class="${s.icon || 'fas fa-link'}" aria-hidden="true"></i>
            </a>`;
          }).join('')}
         </div>`
      : '';

    const isFounder = (member.order === 1) || member.roleTag?.toLowerCase().includes('fundador');

    return `
      <article class="team-card reveal ${isFounder ? 'team-card--founder' : ''}" aria-label="${member.name}">
        <div class="team-card-photo">
          ${member.photo
            ? `<img src="${member.photo}" alt="${member.name}" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
               <div class="team-card-initials" style="display:none">${initials}</div>`
            : `<div class="team-card-initials">${initials}</div>`}
          ${isFounder ? '<div class="team-card-founder-badge"><i class="fas fa-star"></i></div>' : ''}
        </div>
        <div class="team-card-body">
          <div class="team-card-tag">
            <i class="${member.roleIcon || 'fas fa-user'}" aria-hidden="true"></i>
            ${member.roleTag || member.role || 'Membro'}
          </div>
          <h3 class="team-card-name">${member.name}</h3>
          <p class="team-card-role">${member.role || ''}</p>
          ${member.bio ? `<p class="team-card-bio">${member.bio}</p>` : ''}
          ${socialHTML}
        </div>
      </article>
    `;
  }).join('');

  // Re-observar reveals
  container.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.1}s`;
    if (window.ScrollReveal) ScrollReveal.observe(el);
    else el.classList.add('visible');
  });
}

/* ============================================================
   CONTACT PAGE LOADER
   ============================================================ */
/* ============================================================
   FOOTER SOCIAL — corre em TODAS as páginas
   Lê studio.social (array ou objecto legado) e preenche
   qualquer elemento com id="footer-social-dynamic"
   ============================================================ */
async function loadFooterSocial(base) {
  const footerSocial = document.getElementById('footer-social-dynamic');
  if (!footerSocial) return;                   // página sem footer dinâmico

  const data = await fetchData('settings');
  if (!data?.studio) return;

  footerSocial.innerHTML = parseSocialList(data.studio.social)
    .map(s => {
      const hasUrl = !!safeUrl(s.url);
      return `<a ${hasUrl ? `href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer"` : 'aria-disabled="true" tabindex="-1" style="opacity:.35;pointer-events:none;"'}
         class="social-btn" aria-label="${s.label}">
        <i class="${s.icon || 'fas fa-link'}"></i>
      </a>`;
    }).join('');
}

async function loadContactPage(base) {
  const data = await fetchData('settings');
  if (!data?.studio) return;

  const { studio } = data;

  const emailEl = document.querySelector('[data-field="email"]');
  if (emailEl) {
    emailEl.textContent = studio.email || 'em breve';
    if (studio.email) emailEl.closest('a')?.setAttribute('href', `mailto:${studio.email}`);
  }

  // Preenche cards dinâmicos na página de contacto
  const socialList = parseSocialList(studio.social);
  const contactCards = document.getElementById('social-cards-dynamic');
  if (contactCards) {
    // Remove display:contents para manter o fluxo do flex container
    contactCards.style.display = 'flex';
    contactCards.style.flexDirection = 'column';
    contactCards.style.gap = '14px';

    // Só renderiza entradas com URL preenchido
    const activeSocial = socialList;

    if (!activeSocial.length) {
      contactCards.innerHTML = '';
    } else {
      contactCards.innerHTML = activeSocial.map(s => {
        const raw = (s.url || '').trim();

        // Determina o href real e o texto a exibir no card
        let href        = raw;
        let displayText = raw;

        // Detecta se é um número de telefone puro (só dígitos, +, espaços)
        const isPhone = /^[\d\s\+\-\(\)]{5,20}$/.test(raw);
        // Detecta se é um username (sem protocolo, sem ponto de domínio típico)
        const isUsername = raw.startsWith('@') || (!raw.includes('.') && !raw.startsWith('http') && !isPhone);

        if (isPhone) {
          // Número de telemóvel — para WhatsApp/Telegram usa o link directo
          const digits = raw.replace(/[^\d]/g, '');
          const lbl = (s.label || '').toLowerCase();
          if (lbl.includes('whatsapp')) {
            href = 'https://wa.me/' + digits;
          } else if (lbl.includes('telegram')) {
            href = 'https://t.me/+' + digits;
          } else {
            href = 'tel:+' + digits;
          }
          displayText = raw; // mostra o número como foi escrito
        } else if (isUsername) {
          // Username sem @: deixa o link como está (pode ser só texto)
          href = raw.startsWith('@') ? 'https://instagram.com/' + raw.slice(1) : raw;
          displayText = raw;
        } else if (raw.startsWith('http')) {
          // URL completa — extrai só o domínio para exibição
          try {
            const u = new URL(raw);
            displayText = u.hostname.replace('www.', '');
          } catch(e) { displayText = raw; }
        } else if (raw.includes('@') && !raw.startsWith('http')) {
          // Email
          href = 'mailto:' + raw;
          displayText = raw;
        } else {
          // Qualquer outra coisa — tenta adicionar https:// se faltar
          href = 'https://' + raw;
          try { displayText = new URL(href).hostname.replace('www.', ''); } catch(e) { displayText = raw; }
        }

        return `<a href="${href}" class="contact-card" target="_blank" rel="noopener noreferrer">
          <i class="${s.icon||'fas fa-link'}" aria-hidden="true"></i>
          <div>
            <div class="contact-card-label">${s.label||''}</div>
            <div class="contact-card-value">${displayText}</div>
          </div>
        </a>`;
      }).join('');
    }
  }

  // Footer social já é preenchido por loadFooterSocial() no boot

  const form = document.getElementById('contact-form');
  if (form && studio.email) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name    = form.querySelector('#cf-name')?.value || '';
      const email   = form.querySelector('#cf-email')?.value || '';
      const subject = form.querySelector('#cf-subject')?.value || 'Contacto via site';
      const message = form.querySelector('#cf-message')?.value || '';

      const body = `Nome: ${name}\nEmail: ${email}\n\n${message}`;
      window.location.href = `mailto:${studio.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      const status = document.getElementById('contact-status');
      if (status) {
        status.textContent = 'A abrir o teu cliente de email...';
        status.classList.add('show', 'success');
      }
    });
  }
}

/* ============================================================
   APPS PAGE LOADER
   ============================================================ */
async function loadAppsPage(base) {
  const grid = document.getElementById('apps-grid');
  if (!grid) return;

  const data = await fetchData('apps');
  const apps = (data?.apps || []).map(a => ({ ...a, __kind: 'app' }));

  if (!apps.length) {
    grid.innerHTML = '<p class="no-content">Nenhuma aplicação disponível ainda.</p>';
    return;
  }

  renderCatalogGrid(grid, apps, base);
  initCatalogFilters(apps, grid, base, 'apps-search');
}

/* ============================================================
   WEB GAMES PAGE LOADER
   ============================================================ */
async function loadWebGamesPage(base) {
  const grid = document.getElementById('webgames-grid');
  if (!grid) return;

  const data = await fetchData('games');
  const webGames = (data?.games || [])
    .filter(g => g.platforms?.includes('Web'))
    .map(g => ({ ...g, __kind: 'game' }));

  if (!webGames.length) {
    grid.innerHTML = '<p class="no-content">Nenhum jogo web disponível ainda.</p>';
    return;
  }

  renderCatalogGrid(grid, webGames, base);
  initCatalogFilters(webGames, grid, base, 'webgames-search');
}

/* ============================================================
   BOOT — detect page and call the right loader
   ============================================================ */
/* ============================================================
   HOME — TOOLS PREVIEW
   ============================================================ */
async function loadToolsHomePreview(base) {
  const grid = document.getElementById('tools-home-grid');
  if (!grid) return;

  let tools = [];
  try {
    const res = await fetch(`${FB_DB_URL}/tools.json`);
    if (res.ok) {
      const raw = await res.json();
      if (raw && typeof raw === 'object') {
        tools = (Array.isArray(raw) ? raw : Object.values(raw))
          .filter(t => t && t.status !== 'coming-soon')
          .sort((a,b) => (b.featured?1:0)-(a.featured?1:0) || (a.name||'').localeCompare(b.name||''));
      }
    }
  } catch(e) {}

  if (!tools.length) {
    grid.innerHTML = '<p class="no-content" style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:24px 0;">Ferramentas em breve.</p>';
    return;
  }

  grid.innerHTML = tools.slice(0, 3).map((item, i) => {
    const { href, targetAttr } = toolLinkAttrs(item, base, 'tools');
    return `
    <article class="project-card reveal reveal-delay-${i + 1}">
      <div class="card-image" style="background:linear-gradient(135deg,${item.color}18,var(--bg-3));">
        ${cardImageHTML(item.name, item.image, item.color, base, item.faIcon || 'fas fa-wrench')}
      </div>
      <div class="card-body">
        <div class="card-meta">
          ${statusBadge(item.status)}
          <span class="card-badge">${item.category}</span>
        </div>
        <h3 class="card-title">${item.name}</h3>
        <p class="card-desc">${item.shortDesc}</p>
        <div class="card-footer">
          <div class="card-platforms"></div>
          <a href="${href}" class="card-link"${targetAttr}>
            Abrir <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </article>`;
  }).join('');

  grid.querySelectorAll('.reveal').forEach(el => {
    if (window.ScrollReveal) ScrollReveal.observe(el);
    else el.classList.add('visible');
  });
}

/* ============================================================
   HOME — LAB PREVIEW
   ============================================================ */
async function loadLabHomePreview(base) {
  const grid = document.getElementById('lab-home-grid');
  if (!grid) return;

  const data = await fetchData('lab');
  const items = data?.lab || [];

  if (!items.length) {
    grid.innerHTML = '<p class="no-content" style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:24px 0;">Experimentos em breve.</p>';
    return;
  }

  grid.innerHTML = items.slice(0, 3).map((item, i) => `
    <article class="project-card reveal reveal-delay-${i + 1}">
      <div class="card-image" style="background:linear-gradient(135deg,${item.color}18,var(--bg-3));">
        ${cardImageHTML(item.name, item.image, item.color, base, item.faIcon || 'fas fa-flask')}
      </div>
      <div class="card-body">
        <div class="card-meta">
          ${statusBadge(item.status)}
          <span class="card-badge">${item.category}</span>
        </div>
        <h3 class="card-title">${item.name}</h3>
        <p class="card-desc">${item.shortDesc}</p>
        <div class="card-footer">
          <div class="card-platforms"></div>
          ${item.url && item.url !== '#'
            ? `<a href="${item.url}" class="card-link">Ver <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
            : `<a href="${base}tools/detail.html?id=${item.id}" class="card-link">Ver mais <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`}
        </div>
      </div>
    </article>`).join('');

  grid.querySelectorAll('.reveal').forEach(el => {
    if (window.ScrollReveal) ScrollReveal.observe(el);
    else el.classList.add('visible');
  });
}

/* ============================================================
   TOOLS PAGE LOADER
   ============================================================ */
async function loadToolsPage(base) {
  const grid = document.getElementById('tools-grid');
  if (!grid) return;

  const _toolsData = await fetchData('tools');
  let tools = (_toolsData?.tools || [])
    .filter(Boolean)
    .sort((a,b) => (b.featured?1:0)-(a.featured?1:0) || (a.name||'').localeCompare(b.name||''));

  if (!tools.length) {
    grid.innerHTML = '<p class="no-content" style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:40px 0;">Nenhuma ferramenta disponível ainda.</p>';
    return;
  }

  grid.innerHTML = tools.map((item, i) => {
    const { href, targetAttr } = toolLinkAttrs(item, base, 'tools');
    const color = item.color || '#D4AF37';
    return `
    <article class="project-card reveal reveal-delay-${(i%4)+1}" data-category="${(item.category||'').toLowerCase()}" tabindex="0">
      <div class="card-image" style="background:linear-gradient(135deg,${color}18,var(--bg-3));">
        ${cardImageHTML(item.name, item.image, color, base, item.faIcon || 'fas fa-wrench')}
      </div>
      <div class="card-body">
        <div class="card-meta">
          ${statusBadge(item.status)}
          <span class="card-badge">${item.category||''}</span>
        </div>
        <h3 class="card-title">${item.name||''}</h3>
        <p class="card-desc">${item.shortDesc||''}</p>
        <div class="card-footer">
          <div class="card-platforms"></div>
          <a href="${href}" class="card-link"${targetAttr}>
            Abrir <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </article>`;
  }).join('');

  grid.querySelectorAll('.reveal').forEach(el => {
    if (window.ScrollReveal) ScrollReveal.observe(el);
    else el.classList.add('visible');
  });
  initSimpleFilters(tools, grid, 'tools-search', base);
}

/* ============================================================
   LAB PAGE LOADER
   ============================================================ */
async function loadLabPage(base) {
  const grid = document.getElementById('lab-grid');
  if (!grid) return;

  const _labData = await fetchData('lab');
  let items = (_labData?.lab || [])
    .filter(Boolean)
    .sort((a,b) => (b.featured?1:0)-(a.featured?1:0) || (a.name||'').localeCompare(b.name||''));

  if (!items.length) {
    grid.innerHTML = '<p class="no-content" style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:40px 0;">O laboratório está a aquecer. Em breve!</p>';
    return;
  }

  grid.innerHTML = items.map((item, i) => {
    const color = item.color || '#2471A3';
    const hasUrl = item.url && item.url !== '#';
    return `
    <article class="project-card reveal reveal-delay-${(i%4)+1}" data-category="${(item.category||'').toLowerCase()}" tabindex="0">
      <div class="card-image" style="background:linear-gradient(135deg,${color}18,var(--bg-3));">
        ${cardImageHTML(item.name, item.image, color, base, item.faIcon || 'fas fa-flask')}
      </div>
      <div class="card-body">
        <div class="card-meta">
          ${statusBadge(item.status)}
          <span class="card-badge">${item.category||''}</span>
        </div>
        <h3 class="card-title">${item.name||''}</h3>
        <p class="card-desc">${item.shortDesc||''}</p>
        <div class="card-footer">
          <div class="card-platforms"></div>
          ${hasUrl
            ? `<a href="${item.url}" class="card-link" target="_blank" rel="noopener">Ver <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
            : `<span class="card-link" style="opacity:.4;cursor:default;">Em breve</span>`}
        </div>
      </div>
    </article>`;
  }).join('');

  grid.querySelectorAll('.reveal').forEach(el => {
    if (window.ScrollReveal) ScrollReveal.observe(el);
    else el.classList.add('visible');
  });
  initSimpleFilters(items, grid, 'lab-search', base);
}

/* ── Filtros simples partilhados por Tools e Lab ────────────── */
function initSimpleFilters(items, grid, searchId, base) {
  const filterBtns  = document.querySelectorAll('[data-filter]');
  const searchInput = document.getElementById(searchId);
  let activeFilter  = 'all';
  let query         = '';

  function apply() {
    const cards = grid.querySelectorAll('.project-card');
    let anyVisible = false;
    cards.forEach(card => {
      const cat    = (card.dataset.category || '').toLowerCase();
      const status = (card.dataset.status   || '').toLowerCase();
      const name   = (card.querySelector('.card-title')?.textContent || '').toLowerCase();
      const desc   = (card.querySelector('.card-desc')?.textContent  || '').toLowerCase();
      const matchFilter = activeFilter === 'all' || cat === activeFilter || status === activeFilter;
      const matchSearch = !query || name.includes(query) || desc.includes(query);
      const show = matchFilter && matchSearch;
      card.style.display = show ? '' : 'none';
      if (show) anyVisible = true;
    });
    let noMsg = grid.querySelector('.no-results-msg');
    if (!anyVisible) {
      if (!noMsg) {
        noMsg = document.createElement('p');
        noMsg.className = 'no-content no-results-msg';
        noMsg.style.cssText = 'grid-column:1/-1;text-align:center;color:var(--text-3);padding:40px 0;';
        noMsg.textContent = 'Sem resultados.';
        grid.appendChild(noMsg);
      }
    } else { noMsg?.remove(); }
  }

  filterBtns.forEach(btn=>btn.addEventListener('click',()=>{
    filterBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter=btn.dataset.filter;
    apply();
  }));
  searchInput?.addEventListener('input', e=>{ query=e.target.value.trim(); apply(); });
}

document.addEventListener('DOMContentLoaded', async () => {
  const base = getBasePath();
  const path = window.location.pathname;

  const isHome         = path.endsWith('index.html') || path.endsWith('/') || path === '';
  const isGamesPage    = path.endsWith('/games.html');
  const isNewsPage     = path.endsWith('/news.html');
  const isProjectPage  = !!document.body.dataset.project;
  const isAboutPage    = path.endsWith('/about.html');
  const isContactPage  = path.endsWith('/contact.html');
  const isAppsPage     = path.endsWith('/apps.html');
  const isWebGamesPage = path.endsWith('/web-games.html'); // manter por compatibilidade
  const isProjectsPage = path.endsWith('/projects.html');

  // Footer social dinâmico — corre em TODAS as páginas
  await loadFooterSocial(base);

  if (isHome) {
    await Promise.all([
      loadFeaturedGames(base),
      loadNewsFeed(base),
      loadStats(base),
      loadToolsHomePreview(base),
      loadLabHomePreview(base),
    ]);
  }

  if (isGamesPage)    await loadGamesPage(base);
  if (isNewsPage)     await loadNewsPage(base);
  if (isProjectPage)  await loadProjectPage(base);
  if (isAboutPage)    await loadAboutPage(base);
  if (isContactPage)  await loadContactPage(base);
  if (isAppsPage)     await loadAppsPage(base);
  if (isWebGamesPage) await loadWebGamesPage(base);
  if (isProjectsPage) await loadProjectsPage(base);

  const isToolsPage = path.endsWith('/tools.html');
  const isLabPage   = path.endsWith('/lab.html');
  if (isToolsPage) await loadToolsPage(base);
  if (isLabPage)   await loadLabPage(base);
});
