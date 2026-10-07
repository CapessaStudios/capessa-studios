/* ============================================================
   CAPESSA STUDIOS — readmore.js
   Descrições longas ficam encolhidas (3 linhas) com um botão
   "Ler mais". Funciona em #project-description e em qualquer
   elemento com o atributo data-readmore.
   ============================================================ */
(function () {
  'use strict';

  const SELECTOR = '#project-description, [data-readmore]';
  const LINES = 3.5;   // 3 linhas inteiras + meia linha a esbater

  function lineHeightOf(el) {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight);
    return isNaN(lh) ? parseFloat(cs.fontSize) * 1.6 : lh;
  }

  function setup(el) {
    if (el.dataset.rmDone || !el.textContent.trim()) return;
    const lh = lineHeightOf(el);
    const collapsedH = Math.round(lh * LINES);
    // texto curto (cabe em ~4 linhas): não faz nada
    if (el.scrollHeight <= collapsedH + lh * 1.1) return;

    el.dataset.rmDone = '1';
    if (!el.id) el.id = 'rm-' + Math.random().toString(36).slice(2, 8);
    el.classList.add('rm-box', 'rm-collapsed');
    el.style.maxHeight = collapsedH + 'px';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rm-toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', el.id);
    btn.innerHTML = '<span>Ler mais</span> <i class="fas fa-chevron-down" aria-hidden="true"></i>';
    el.insertAdjacentElement('afterend', btn);

    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      if (open) {
        // fechar: parte da altura atual para animar
        el.style.maxHeight = el.scrollHeight + 'px';
        void el.offsetHeight;
        el.classList.add('rm-collapsed');
        el.style.maxHeight = collapsedH + 'px';
        btn.setAttribute('aria-expanded', 'false');
        btn.firstElementChild.textContent = 'Ler mais';
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        el.classList.remove('rm-collapsed');
        el.style.maxHeight = el.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
        btn.firstElementChild.textContent = 'Ler menos';
        setTimeout(() => {
          if (btn.getAttribute('aria-expanded') === 'true') el.style.maxHeight = 'none';
        }, 400);
      }
    });
  }

  function scan() { document.querySelectorAll(SELECTOR).forEach(setup); }

  function init() {
    scan();
    // o conteúdo chega depois (Firebase) — observa alterações
    document.querySelectorAll(SELECTOR).forEach(el => {
      new MutationObserver(() => requestAnimationFrame(() => setup(el)))
        .observe(el, { childList: true, characterData: true, subtree: true });
    });
    window.addEventListener('load', scan);
    window.addEventListener('resize', scan);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
