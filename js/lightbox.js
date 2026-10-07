/* ============================================================
   CAPESSA STUDIOS — lightbox.js
   Ao clicar numa imagem (galeria de screenshots ou qualquer <img>
   com o atributo data-lightbox) abre-a em ecrã inteiro.
   Setas / deslizar para navegar, Esc ou clicar fora para fechar.
   Usa delegação de eventos, por isso funciona com imagens
   criadas depois do carregamento da página.
   ============================================================ */
(function () {
  'use strict';

  const SELECTOR = '.gallery-item img, img[data-lightbox]';
  let root, imgEl, countEl, prevBtn, nextBtn;
  let items = [], index = 0, lastFocus = null, touchX = null;

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'cs-lb';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Imagem em ecrã inteiro');
    root.innerHTML = `
      <div class="cs-lb-count" hidden></div>
      <button type="button" class="cs-lb-btn cs-lb-close" aria-label="Fechar"><i class="fas fa-xmark" aria-hidden="true"></i></button>
      <button type="button" class="cs-lb-btn cs-lb-prev" aria-label="Anterior"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
      <button type="button" class="cs-lb-btn cs-lb-next" aria-label="Seguinte"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
      <div class="cs-lb-stage"><img class="cs-lb-img" alt="" draggable="false" /></div>`;
    document.body.appendChild(root);

    imgEl   = root.querySelector('.cs-lb-img');
    countEl = root.querySelector('.cs-lb-count');
    prevBtn = root.querySelector('.cs-lb-prev');
    nextBtn = root.querySelector('.cs-lb-next');

    root.querySelector('.cs-lb-close').addEventListener('click', close);
    prevBtn.addEventListener('click', e => { e.stopPropagation(); go(-1); });
    nextBtn.addEventListener('click', e => { e.stopPropagation(); go(1); });
    // clicar no fundo (fora da imagem) fecha
    root.addEventListener('click', e => { if (e.target === root || e.target.classList.contains('cs-lb-stage')) close(); });

    root.addEventListener('touchstart', e => { touchX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    root.addEventListener('touchend', e => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function show() {
    const it = items[index];
    imgEl.classList.add('loading');
    imgEl.onload = imgEl.onerror = () => imgEl.classList.remove('loading');
    imgEl.src = it.src;
    imgEl.alt = it.alt;
    const multi = items.length > 1;
    prevBtn.hidden = nextBtn.hidden = countEl.hidden = !multi;
    countEl.textContent = `${index + 1} / ${items.length}`;
    // pré-carrega vizinhas
    if (multi) [index - 1, index + 1].forEach(i => {
      const n = items[(i + items.length) % items.length];
      if (n) new Image().src = n.src;
    });
  }

  function go(step) {
    if (items.length < 2) return;
    index = (index + step + items.length) % items.length;
    show();
  }

  function open(list, start) {
    build();
    items = list; index = start;
    lastFocus = document.activeElement;
    document.documentElement.style.overflow = 'hidden';
    root.classList.add('open');
    show();
    root.querySelector('.cs-lb-close').focus({ preventScroll: true });
  }

  function close() {
    if (!root || !root.classList.contains('open')) return;
    root.classList.remove('open');
    imgEl.removeAttribute('src');
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  document.addEventListener('click', e => {
    const img = e.target.closest && e.target.closest(SELECTOR);
    if (!img) return;
    e.preventDefault();
    // grupo = imagens da mesma galeria; imagem solta = grupo de 1
    const group = img.closest('.gallery-grid');
    const nodes = group ? Array.from(group.querySelectorAll(SELECTOR)) : [img];
    const list = nodes.map(n => ({ src: n.currentSrc || n.src, alt: n.alt || '' }));
    open(list, Math.max(0, nodes.indexOf(img)));
  });

  document.addEventListener('keydown', e => {
    if (!root || !root.classList.contains('open')) return;
    if (e.key === 'Escape')      close();
    else if (e.key === 'ArrowLeft')  go(-1);
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'Tab') { e.preventDefault(); root.querySelector('.cs-lb-close').focus(); }
  });
})();
