/* ============================================================
   CAPESSA STUDIOS — search.js
   Pesquisa global: jogos, apps, tools, lab e notícias.
   Lê do Firebase Realtime Database — mesma fonte que o site.
   ============================================================ */

'use strict';

const GlobalSearch = (() => {
  const FB  = 'https://capessa-studios-default-rtdb.europe-west1.firebasedatabase.app';
  const SITE = 'https://capessastudios.github.io/capessa-studios';

  let index        = null;
  let indexPromise = null;

  /* ── Fetch JSON do Firebase ─────────────────────────────── */
  async function fbFetch(path) {
    try {
      const res = await fetch(`${FB}/${path}.json`);
      if (!res.ok) return null;
      const raw = await res.json();
      if (!raw || typeof raw !== 'object') return [];
      return Array.isArray(raw) ? raw.filter(Boolean) : Object.values(raw).filter(Boolean);
    } catch { return []; }
  }

  /* ── Construir índice flat a partir do Firebase ─────────── */
  async function buildIndex() {
    const [games, apps, news, tools, lab] = await Promise.all([
      fbFetch('games'),
      fbFetch('apps'),
      fbFetch('news'),
      fbFetch('tools'),
      fbFetch('lab'),
    ]);

    const items = [];

    games.forEach(g => items.push({
      type:     'Jogo',
      icon:     'fas fa-gamepad',
      color:    g.color || '#D4AF37',
      title:    g.name  || '',
      sub:      g.category || '',
      url:      `${SITE}/projects/${g.id}/index.html`,
      haystack: [g.name, g.category, g.shortDesc, g.description, ...(g.tags||[])]
                  .filter(Boolean).join(' ').toLowerCase(),
    }));

    apps.forEach(a => items.push({
      type:     'Aplicação',
      icon:     'fas fa-mobile-alt',
      color:    a.color || '#2471A3',
      title:    a.name  || '',
      sub:      a.category || '',
      url:      `${SITE}/pages/apps.html`,
      haystack: [a.name, a.category, a.shortDesc, a.description, ...(a.tags||[])]
                  .filter(Boolean).join(' ').toLowerCase(),
    }));

    tools.forEach(t => items.push({
      type:     'Tool',
      icon:     t.icon || 'fas fa-wrench',
      color:    t.color || '#4ADE80',
      title:    t.name  || '',
      sub:      t.category || '',
      url:      t.url && t.url !== '#' ? t.url : `${SITE}/pages/tools.html`,
      haystack: [t.name, t.category, t.shortDesc, t.description, ...(t.tags||[])]
                  .filter(Boolean).join(' ').toLowerCase(),
    }));

    lab.forEach(l => items.push({
      type:     'Lab',
      icon:     l.icon || 'fas fa-flask',
      color:    l.color || '#A78BFA',
      title:    l.name  || '',
      sub:      l.category || '',
      url:      l.url && l.url !== '#' ? l.url : `${SITE}/pages/lab.html`,
      haystack: [l.name, l.category, l.shortDesc, l.description, ...(l.tags||[])]
                  .filter(Boolean).join(' ').toLowerCase(),
    }));

    news.forEach(n => items.push({
      type:     'Notícia',
      icon:     n.categoryIcon || 'fas fa-newspaper',
      color:    '#60A5FA',
      title:    n.title || '',
      sub:      n.category || '',
      url:      `${SITE}/pages/news.html`,
      haystack: [n.title, n.summary, n.content, n.category, ...(n.tags||[])]
                  .filter(Boolean).join(' ').toLowerCase(),
    }));

    return items;
  }

  async function getIndex() {
    if (index) return index;
    if (!indexPromise) indexPromise = buildIndex();
    index = await indexPromise;
    return index;
  }

  /* ── Pesquisa com suporte a múltiplas palavras ──────────── */
  function search(query, items, limit = 10) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    return items
      .filter(item => words.every(w => item.haystack.includes(w)))
      .sort((a, b) => {
        // Priorizar título exacto
        const aTitle = a.title.toLowerCase().includes(q) ? 0 : 1;
        const bTitle = b.title.toLowerCase().includes(q) ? 0 : 1;
        return aTitle - bTitle || a.haystack.indexOf(q) - b.haystack.indexOf(q);
      })
      .slice(0, limit);
  }

  /* ── Renderizar resultados agrupados por tipo ───────────── */
  function renderResults(panel, results, query) {
    if (!query.trim()) {
      panel.innerHTML = `
        <div class="search-results-hint">
          <i class="fas fa-keyboard" aria-hidden="true"></i>
          Escreve para pesquisar jogos, apps, tools e notícias
        </div>`;
      return;
    }
    if (!results.length) {
      panel.innerHTML = `
        <div class="search-results-empty">
          Sem resultados para "<strong>${esc(query)}</strong>"
        </div>`;
      return;
    }

    const groups = {};
    results.forEach(r => { (groups[r.type] = groups[r.type] || []).push(r); });

    let html = '';
    Object.entries(groups).forEach(([type, list]) => {
      html += `<div class="search-results-group-label">${type}</div>`;
      html += list.map(item => `
        <a class="search-result-item" href="${item.url}">
          <div class="search-result-icon" style="color:${item.color}" aria-hidden="true">
            <i class="${item.icon}"></i>
          </div>
          <div>
            <div class="search-result-title">${esc(item.title)}</div>
            <div class="search-result-sub">${esc(item.sub)}</div>
          </div>
        </a>`).join('');
    });
    html += `<div class="search-results-footer">${results.length} resultado${results.length !== 1 ? 's' : ''}</div>`;
    panel.innerHTML = html;
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /* ── Ligar cada input de pesquisa ───────────────────────── */
  function wireInput(input) {
    if (!input || input.dataset.searchWired) return;
    input.dataset.searchWired = 'true';

    const wrapper = input.closest('.nav-search, .mobile-search');
    if (!wrapper) return;

    const panel = document.createElement('div');
    panel.className = 'search-results';
    panel.setAttribute('role', 'listbox');
    wrapper.appendChild(panel);

    let timer = null;
    let activeIdx = -1;

    async function runSearch() {
      const items   = await getIndex();
      const results = search(input.value, items);
      renderResults(panel, results, input.value);
      activeIdx = -1;
    }

    input.addEventListener('input', () => {
      panel.classList.add('open');
      clearTimeout(timer);
      timer = setTimeout(runSearch, 180);
    });

    input.addEventListener('focus', () => {
      panel.classList.add('open');
      if (!panel.innerHTML) runSearch();
    });

    input.addEventListener('keydown', e => {
      const opts = [...panel.querySelectorAll('.search-result-item')];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, opts.length - 1);
        opts.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
        opts[activeIdx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        opts.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
        opts[activeIdx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        const target = activeIdx >= 0 ? opts[activeIdx] : opts[0];
        if (target) window.location.href = target.href;
      } else if (e.key === 'Escape') {
        panel.classList.remove('open');
        input.blur();
      }
    });

    document.addEventListener('click', e => {
      if (!wrapper.contains(e.target)) panel.classList.remove('open');
    });
  }

  function init() {
    document.querySelectorAll('.nav-search input, .mobile-search input')
      .forEach(input => wireInput(input));
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => GlobalSearch.init());
               
