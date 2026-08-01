/* ============================================================
   CAPESSA STUDIOS — projects.js
   Catálogo genérico de "projetos" (jogos + aplicações num só
   portefólio) usado por pages/projects.html.

   Depende de funções globais definidas em js/loader.js
   (fetchJSON, statusBadge, platformChips) e em js/main.js
   (ScrollReveal), por isso este ficheiro deve ser carregado
   DEPOIS de ambos.
   ============================================================ */

'use strict';

/* ── Link de destino de cada card ─────────────────────────── */
function catalogCardLink(item, base) {
  // Tanto jogos como apps têm página própria em detail.html?id=
  return `${base}projects/detail.html?id=${item.id}`;
}

/* ── Render da grelha de cards ────────────────────────────── */
function renderCatalogGrid(grid, items, base) {
  if (!items.length) {
    grid.innerHTML = '<p class="no-content" style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:40px 0;">Nenhum resultado encontrado.</p>';
    return;
  }

  grid.innerHTML = items.map((item, i) => `
    <article class="project-card reveal reveal-delay-${(i%4)+1}" data-category="${item.category}" data-status="${item.status}" data-kind="${item.__kind}" tabindex="0" aria-label="${item.name}">
      <div class="card-image" style="background:linear-gradient(135deg, ${item.color}18, var(--bg-3));">
        ${cardImageHTML(item.name, item.image, item.color, base)}
      </div>
      <div class="card-body">
        <div class="card-meta">
          ${statusBadge(item.status)}
          <span class="card-badge">${item.category}</span>
          ${item.__kind === 'app' ? '<span class="card-badge"><i class="fas fa-mobile-alt" aria-hidden="true"></i> App</span>' : ''}
        </div>
        <h3 class="card-title">${item.name}</h3>
        <p class="card-desc">${item.shortDesc}</p>
        <div class="card-footer">
          <div class="card-platforms">${platformChips(item.platforms)}</div>
          <a href="${catalogCardLink(item, base)}" class="card-link">
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

/* ── Filtros + pesquisa da grelha ─────────────────────────── */
function initCatalogFilters(items, grid, base, searchInputId) {
  const filterBtns  = document.querySelectorAll('[data-filter]');
  const searchInput = document.getElementById(searchInputId);

  let activeFilter = 'all';
  let searchQuery  = '';

  function applyFilters() {
    let filtered = [...items];
    if (activeFilter !== 'all') {
      filtered = filtered.filter(item =>
        item.category.toLowerCase() === activeFilter ||
        item.status.toLowerCase()   === activeFilter ||
        item.__kind === activeFilter
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    renderCatalogGrid(grid, filtered, base);
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
   PROJECTS PAGE LOADER (games + apps combined portfolio)
   ============================================================ */
async function loadProjectsPage(base) {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  const [gamesData, appsData] = await Promise.all([
    fetchData('games'),
    fetchData('apps'),
  ]);

  const all = [
    ...(gamesData?.games || []).map(g => ({ ...g, __kind: 'game' })),
    ...(appsData?.apps   || []).map(a => ({ ...a, __kind: 'app'  })),
  ];

  if (!all.length) {
    grid.innerHTML = '<p class="no-content">Nenhum projeto disponível ainda.</p>';
    return;
  }

  renderCatalogGrid(grid, all, base);
  initCatalogFilters(all, grid, base, 'projects-search');
}
