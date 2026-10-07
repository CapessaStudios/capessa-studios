/* ============================================================
   CAPESSA STUDIOS — reviews.js
   Avaliações (1–5 estrelas) e comentários nas páginas de app/jogo.
   Dados em: reviews/{projectId}/{reviewId} no Firebase RTDB (REST).
   ============================================================ */
(function () {
  'use strict';

  const DB_URL    = 'https://capessa-studios-default-rtdb.europe-west1.firebasedatabase.app';
  const PAGE_SIZE = 10;
  const MAX_NAME  = 40;
  const MAX_TEXT  = 1000;

  let projectId = '';
  let reviews   = [];     // [{ id, name, rating, comment, createdAt, reply }]
  let shown     = PAGE_SIZE;
  let rating    = 0;
  const openedAt = Date.now();

  /* ── Helpers ─────────────────────────────────────────────── */
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const multiline = s => esc(s).replace(/\n/g, '<br>');

  function fmtDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function starsHTML(value) {
    const r = Math.round(value);
    let out = '<span class="rv-stars" aria-hidden="true">';
    for (let i = 1; i <= 5; i++) out += `<i class="fas fa-star${i <= r ? '' : ' off'}"></i>`;
    return out + '</span>';
  }

  const lsKey = () => `cs_reviewed_${projectId}`;

  /* ── Dados ───────────────────────────────────────────────── */
  async function fetchReviews() {
    const res = await fetch(`${DB_URL}/reviews/${encodeURIComponent(projectId)}.json`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    if (!raw || typeof raw !== 'object') return [];
    return Object.entries(raw)
      .map(([id, r]) => ({ id, ...r }))
      .filter(r => r && typeof r.rating === 'number')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async function postReview(payload) {
    const res = await fetch(`${DB_URL}/reviews/${encodeURIComponent(projectId)}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json(); // { name: "<pushId>" }
  }

  /* ── Render ──────────────────────────────────────────────── */
  function renderChip() {
    const el = document.getElementById('project-rating');
    if (!el) return;
    if (!reviews.length) {
      el.innerHTML = `<a class="rating-chip" href="#avaliacoes"><i class="far fa-star"></i> Sem avaliações ainda</a>`;
      return;
    }
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    el.innerHTML = `<a class="rating-chip" href="#avaliacoes">
      <i class="fas fa-star"></i> ${avg.toFixed(1).replace('.', ',')}
      <small>(${reviews.length})</small></a>`;
  }

  function renderSummary() {
    const box = document.getElementById('rv-summary');
    if (!box) return;
    if (!reviews.length) { box.innerHTML = ''; return; }
    const total = reviews.length;
    const avg   = reviews.reduce((s, r) => s + r.rating, 0) / total;
    const dist  = [0, 0, 0, 0, 0, 0];
    reviews.forEach(r => { dist[Math.min(5, Math.max(1, Math.round(r.rating)))]++; });

    const bars = [5, 4, 3, 2, 1].map(n => `
      <div class="rv-bar-row">
        <span>${n}★</span>
        <div class="rv-bar-track"><div class="rv-bar-fill" style="width:${(dist[n] / total * 100).toFixed(0)}%"></div></div>
        <span class="rv-bar-n">${dist[n]}</span>
      </div>`).join('');

    box.innerHTML = `
      <div class="rv-summary">
        <div class="rv-avg">
          <div class="rv-avg-num">${avg.toFixed(1).replace('.', ',')}</div>
          ${starsHTML(avg)}
          <div class="rv-avg-count">${total} ${total === 1 ? 'avaliação' : 'avaliações'}</div>
        </div>
        <div class="rv-bars">${bars}</div>
      </div>`;
  }

  function renderList() {
    const box = document.getElementById('rv-list');
    if (!box) return;
    if (!reviews.length) {
      box.innerHTML = '<div class="rv-empty">Ainda ninguém avaliou. Sê o primeiro!</div>';
      return;
    }
    const slice = reviews.slice(0, shown);
    box.innerHTML = `<div class="rv-list">${slice.map(r => {
      const name = r.name || 'Anónimo';
      const reply = r.reply && r.reply.text ? `
        <div class="rv-reply">
          <div class="rv-reply-head"><i class="fas fa-reply" aria-hidden="true"></i> Resposta da Capessa Studios
            <time>${esc(fmtDate(r.reply.createdAt))}</time></div>
          <p>${multiline(r.reply.text)}</p>
        </div>` : '';
      return `
        <article class="rv-item">
          <div class="rv-item-head">
            <div class="rv-avatar" aria-hidden="true">${esc(name.trim().charAt(0).toUpperCase() || '?')}</div>
            <div>
              <div class="rv-name">${esc(name)}</div>
              ${starsHTML(r.rating)}
            </div>
            <time class="rv-date">${esc(fmtDate(r.createdAt))}</time>
          </div>
          ${r.comment ? `<p class="rv-text">${multiline(r.comment)}</p>` : ''}
          ${reply}
        </article>`;
    }).join('')}</div>
    ${reviews.length > shown
      ? `<button type="button" class="btn btn-secondary rv-more" id="rv-more">Ver mais avaliações</button>` : ''}`;

    const more = document.getElementById('rv-more');
    if (more) more.addEventListener('click', () => { shown += PAGE_SIZE; renderList(); });
  }

  function renderForm() {
    const box = document.getElementById('rv-form-wrap');
    if (!box) return;

    if (localStorage.getItem(lsKey())) {
      box.innerHTML = `<div class="rv-done"><i class="fas fa-circle-check"></i>Obrigado pela tua avaliação!</div>`;
      return;
    }

    box.innerHTML = `
      <form class="rv-form" id="rv-form" novalidate>
        <h3>Deixa a tua avaliação</h3>
        <div class="rv-field">
          <label id="rv-rating-label">A tua classificação</label>
          <div class="rv-star-input" id="rv-star-input" role="radiogroup" aria-labelledby="rv-rating-label">
            ${[1, 2, 3, 4, 5].map(n =>
              `<button type="button" role="radio" aria-checked="false" aria-label="${n} ${n === 1 ? 'estrela' : 'estrelas'}" data-v="${n}"><i class="fas fa-star"></i></button>`
            ).join('')}
          </div>
        </div>
        <div class="rv-field">
          <label for="rv-name">Nome</label>
          <input type="text" id="rv-name" maxlength="${MAX_NAME}" placeholder="Como te chamas? (opcional)" autocomplete="nickname" />
        </div>
        <div class="rv-field">
          <label for="rv-comment">Comentário</label>
          <textarea id="rv-comment" maxlength="${MAX_TEXT}" placeholder="Conta-nos o que achaste… (opcional)"></textarea>
          <div class="rv-count"><span id="rv-count">0</span>/${MAX_TEXT}</div>
        </div>
        <input type="text" class="rv-hp" id="rv-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <div class="rv-submit-row">
          <button type="submit" class="btn btn-primary" id="rv-submit"><i class="fas fa-paper-plane" aria-hidden="true"></i> Enviar avaliação</button>
          <span class="rv-msg" id="rv-msg" role="status"></span>
        </div>
      </form>`;

    const starBtns = box.querySelectorAll('#rv-star-input button');
    const paint = v => starBtns.forEach(b => {
      const on = Number(b.dataset.v) <= v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', Number(b.dataset.v) === rating ? 'true' : 'false');
    });
    rating = 0;
    starBtns.forEach(b => {
      b.addEventListener('click', () => { rating = Number(b.dataset.v); paint(rating); });
      b.addEventListener('mouseenter', () => paint(Number(b.dataset.v)));
    });
    box.querySelector('#rv-star-input').addEventListener('mouseleave', () => paint(rating));

    const ta = box.querySelector('#rv-comment');
    ta.addEventListener('input', () => { box.querySelector('#rv-count').textContent = ta.value.length; });

    box.querySelector('#rv-form').addEventListener('submit', onSubmit);
  }

  /* ── Submissão ───────────────────────────────────────────── */
  async function onSubmit(e) {
    e.preventDefault();
    const msg = document.getElementById('rv-msg');
    const btn = document.getElementById('rv-submit');
    const say = (t, cls) => { msg.textContent = t; msg.className = 'rv-msg ' + (cls || ''); };

    if (document.getElementById('rv-hp').value) return;            // honeypot
    if (Date.now() - openedAt < 3000) { say('Aguarda um segundo e tenta de novo.', 'err'); return; }
    if (rating < 1 || rating > 5) { say('Escolhe uma classificação de 1 a 5 estrelas.', 'err'); return; }

    const name    = document.getElementById('rv-name').value.trim().slice(0, MAX_NAME) || 'Anónimo';
    const comment = document.getElementById('rv-comment').value.trim().slice(0, MAX_TEXT);

    const payload = { name, rating, createdAt: { '.sv': 'timestamp' } };
    if (comment) payload.comment = comment;

    btn.disabled = true;
    say('A enviar…');
    try {
      const out = await postReview(payload);
      localStorage.setItem(lsKey(), out && out.name ? out.name : '1');
      reviews.unshift({ id: out && out.name, name, rating, comment, createdAt: Date.now() });
      renderChip(); renderSummary(); renderList(); renderForm();
    } catch (err) {
      btn.disabled = false;
      say('Não foi possível enviar a avaliação. Tenta novamente mais tarde.', 'err');
      console.warn('[Reviews] Falha ao enviar:', err.message);
    }
  }

  /* ── Init ────────────────────────────────────────────────── */
  async function init() {
    if (!document.getElementById('project-reviews')) return;
    projectId = new URLSearchParams(window.location.search).get('id') || '';
    if (!projectId) return;

    renderForm();
    try {
      reviews = await fetchReviews();
    } catch (err) {
      console.warn('[Reviews] Falha ao carregar:', err.message);
      const box = document.getElementById('rv-list');
      if (box) box.innerHTML = '<div class="rv-empty">Não foi possível carregar as avaliações.</div>';
      return;
    }
    renderChip(); renderSummary(); renderList();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
