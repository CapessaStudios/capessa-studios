/* ============================================================
   CAPESSA STUDIOS — search.js
   Pesquisa global: jogos, aplicações e notícias.
   Funciona em qualquer página (usa getBasePath de loader.js).
   ============================================================ */

'use strict';

const GlobalSearch = (() => {
  let index = null;       // cached, flattened search index
  let indexPromise = null;

  /* ── Build a flat, searchable index from the JSON sources ── */
  async function buildIndex(base) {
    const [games, apps, news] = await Promise.all([
      fetchJSON(`${base}data/games.json`),
      fetchJSON(`${base}data/apps.json`),   // may not exist yet — fetchJSON handles the 404
      fetchJSON(`${base}data/news.json`),
    ]);

    const items = [];

    (games?.games || []).forEach(g => {
      items.push({
        type: 'Jogo',
        icon: 'fas fa-gamepad',
        title: g.name,
        sub: g.category,
        url: `${base}projects/${g.id}/index.html`,
        haystack: [g.name, g.category, g.description, g.shortDesc, ...(g.tags || [])]
          .filter(Boolean).join(' ').toLowerCase(),
      });
    });

    (apps?.apps || []).forEach(a => {
      items.push({
        type: 'Aplicação',
        icon: 'fas fa-mobile-alt',
        title: a.name,
        sub: a.category,
        url: a.url || `${base}pages/apps.html`,
        haystack: [a.name, a.category, a.description, ...(a.tags || [])]
          .filter(Boolean).join(' ').toLowerCase(),
      });
    });

    (news?.news || []).forEach(n => {
      items.push({
        type: 'Notícia',
        icon: n.categoryIcon || 'fas fa-newspaper',
        title: n.title,
        sub: n.category,
        url: `${base}pages/news.html`,
        haystack: [n.title, n.summary, n.category, ...(n.tags || [])]
          .filter(Boolean).join(' ').toLowerCase(),
      });
    });

    return items;
  }

  async function getIndex(base) {
    if (index) return index;
    if (!indexPromise) indexPromise = buildIndex(base);
    index = await indexPromise;
    return index;
  }

  function search(query, items, limit = 8) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(item => item.haystack.includes(q))
      .sort((a, b) => a.haystack.indexOf(q) - b.haystack.indexOf(q))
      .slice(0, limit);
  }

  function groupByType(results) {
    const groups = {};
    results.forEach(r => {
      groups[r.type] = groups[r.type] || [];
      groups[r.type].push(r);
    });
    return groups;
  }

  function renderResults(panel, results, query) {
    if (!query.trim()) {
      panel.innerHTML = `<div class="search-results-hint"><i class="fas fa-keyboard" aria-hidden="true"></i> Escreve para pesquisar jogos, apps e notícias</div>`;
      return;
    }
    if (!results.length) {
      panel.innerHTML = `<div class="search-results-empty">Sem resultados para "<strong>${escapeHtml(query)}</strong>"</div>`;
      return;
    }

    const groups = groupByType(results);
    let html = '';
    Object.entries(groups).forEach(([type, items]) => {
      html += `<div class="search-results-group-label">${type}</div>`;
      html += items.map(item => `
        <a class="search-result-item" href="${item.url}" data-url="${item.url}">
          <div class="search-result-icon" aria-hidden="true"><i class="${item.icon}"></i></div>
          <div>
            <div class="search-result-title">${escapeHtml(item.title)}</div>
            <div class="search-result-sub">${escapeHtml(item.sub || '')}</div>
          </div>
        </a>
      `).join('');
    });
    html += `<div class="search-results-footer">${results.length} resultado${results.length !== 1 ? 's' : ''}</div>`;
    panel.innerHTML = html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── Wire up a single search input + its results panel ───── */
  function wireInput(input, base) {
    if (!input || input.dataset.searchWired) return;
    input.dataset.searchWired = 'true';

    const wrapper = input.closest('.nav-search, .mobile-search');
    if (!wrapper) return;

    const panel = document.createElement('div');
    panel.className = 'search-results';
    panel.setAttribute('role', 'listbox');
    wrapper.appendChild(panel);

    let debounceTimer = null;
    let activeIndex = -1;

    async function runSearch() {
      const items = await getIndex(base);
      const results = search(input.value, items);
      renderResults(panel, results, input.value);
      activeIndex = -1;
    }

    input.addEventListener('input', () => {
      panel.classList.add('open');
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 160);
    });

    input.addEventListener('focus', () => {
      panel.classList.add('open');
      if (!panel.innerHTML) runSearch();
    });

    input.addEventListener('keydown', e => {
      const options = panel.querySelectorAll('.search-result-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, options.length - 1);
        updateActive(options);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActive(options);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && options[activeIndex]) {
          window.location.href = options[activeIndex].dataset.url;
        } else if (options.length === 1) {
          window.location.href = options[0].dataset.url;
        }
      } else if (e.key === 'Escape') {
        panel.classList.remove('open');
        input.blur();
      }
    });

    function updateActive(options) {
      options.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
      options[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('click', e => {
      if (!wrapper.contains(e.target)) panel.classList.remove('open');
    });
  }

  function init() {
    const base = typeof getBasePath === 'function' ? getBasePath() : './';
    document.querySelectorAll('.nav-search input, .mobile-search input').forEach(input => {
      wireInput(input, base);
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => GlobalSearch.init());
