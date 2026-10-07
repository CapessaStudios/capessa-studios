/* ============================================================
   CAPESSA STUDIOS — share.js
   Botão "Partilhar" nas páginas de jogo, app, lab e ferramenta.
   Telemóvel: abre a partilha nativa. Computador: copia o link.
   ============================================================ */
(function () {
  'use strict';

  function toast(msg) {
    let t = document.querySelector('.cs-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'cs-toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) {}
      ta.remove();
      return ok;
    }
  }

  function init() {
    const host = document.querySelector('.project-hero-top');
    if (!host || host.querySelector('.share-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'share-btn';
    btn.setAttribute('aria-label', 'Partilhar este projeto');
    btn.innerHTML = '<i class="fas fa-share-nodes" aria-hidden="true"></i> <span>Partilhar</span>';
    host.appendChild(btn);

    btn.addEventListener('click', async () => {
      const url   = location.href.split('#')[0];
      const title = (document.getElementById('project-name')?.textContent || document.title).trim();
      const text  = (document.getElementById('project-tagline')?.textContent || '').trim();
      if (navigator.share) {
        try { await navigator.share({ title, text, url }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      toast((await copy(url)) ? 'Link copiado!' : 'Não foi possível copiar o link');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
