/* ============================================================
   CAPESSA STUDIOS — theme.js
   Gestão do tema claro/escuro (toggle + persistência).

   Carregado ANTES de main.js em todas as páginas, para que
   ThemeManager já exista globalmente quando main.js faz o boot
   e chama ThemeManager.init().

   Nota: a prevenção de FOUC (aplicar o tema guardado antes do
   primeiro paint) continua a viver num pequeno <script> inline
   no <head> de cada página — esse script tem de correr antes do
   CSS carregar, por isso não pode depender de um ficheiro
   externo como este.
   ============================================================ */

'use strict';

const ThemeManager = (() => {
  const KEY = 'cs_theme';
  const root = document.documentElement;

  function getToggleEls() {
    const btn  = document.getElementById('theme-toggle');
    const icon = btn?.querySelector('i');
    return { btn, icon };
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    const { icon } = getToggleEls();
    if (icon) {
      icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }

  function current() {
    return root.getAttribute('data-theme') || 'dark';
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark');
  }

  function init() {
    const saved   = localStorage.getItem(KEY);
    const prefers = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    apply(saved || prefers);

    const { btn } = getToggleEls();
    btn?.addEventListener('click', toggle);
  }

  return { init, apply, toggle, current };
})();

// Garante disponibilidade global mesmo que este script seja carregado
// como module, com defer/async, ou em qualquer ordem inesperada.
window.ThemeManager = ThemeManager;
