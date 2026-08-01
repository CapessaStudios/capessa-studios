/* ============================================================
   CAPESSA STUDIOS — main.js
   Theme · Nav · Mobile menu · Scroll reveal · Search
   ============================================================ */

'use strict';

/* ── Theme ─────────────────────────────────────────────────── */
/* ThemeManager agora vive em js/theme.js (carregado antes deste
   ficheiro em todas as páginas). Mantido global para que o boot
   abaixo continue a chamar ThemeManager.init() sem alterações. */

/* ── Navbar scroll behaviour ───────────────────────────────── */
const NavScroll = (() => {
  const nav = document.getElementById('navbar');

  function init() {
    if (!nav) return;
    const update = () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  return { init };
})();

/* ── Active nav link ───────────────────────────────────────── */
const NavActive = (() => {
  function init() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (
        (path === '/' || path.endsWith('index.html')) && (href === '/' || href === 'index.html' || href === '#')
      ) {
        a.classList.add('active');
      } else if (href !== '/' && href !== 'index.html' && href !== '#' && path.includes(href)) {
        a.classList.add('active');
      }
    });
  }
  return { init };
})();

/* ── Mobile menu ───────────────────────────────────────────── */
const MobileMenu = (() => {
  const ham  = document.getElementById('hamburger');
  const menu = document.getElementById('mobile-menu');

  function close() {
    ham?.classList.remove('open');
    menu?.classList.remove('open');
    document.body.style.overflow = '';
  }

  function init() {
    if (!ham || !menu) return;

    ham.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      ham.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));

    document.addEventListener('click', e => {
      if (!menu.contains(e.target) && !ham.contains(e.target)) close();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) close();
    });
  }

  return { init };
})();

/* ── Scroll reveal ─────────────────────────────────────────── */
const ScrollReveal = (() => {
  let observer;

  function init() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
      return;
    }

    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  // Call again after dynamic content loads
  function observe(el) {
    if (observer) observer.observe(el);
    else el.classList.add('visible');
  }

  return { init, observe };
})();

/* ── Search ────────────────────────────────────────────────── */
/* Global search UI now lives in js/search.js (Part 3) */

/* ── Smooth anchor scroll ─────────────────────────────────── */
const AnchorScroll = (() => {
  function init() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target) {
          e.preventDefault();
          const offset = 80;
          const top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      });
    });
  }
  return { init };
})();

/* ── Animated counter (hero stats) ─────────────────────────── */
const CounterAnimation = (() => {
  function animateCounter(el, target, duration = 1500) {
    let start = null;
    const suffix = el.dataset.suffix || '';
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.floor(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function init() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          animateCounter(el, parseInt(el.dataset.count), 1200);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(el => observer.observe(el));
  }

  return { init };
})();


/* ── 2. Tilt 3D nos cards ─────────────────────────────────── */
const CardTilt = (() => {
  const MAX_TILT = 8; // graus máximos de inclinação

  function applyTilt(card, e) {
    const rect   = card.getBoundingClientRect();
    const cx     = rect.left + rect.width  / 2;
    const cy     = rect.top  + rect.height / 2;
    const dx     = (e.clientX - cx) / (rect.width  / 2);
    const dy     = (e.clientY - cy) / (rect.height / 2);
    const rotX   = -dy * MAX_TILT;
    const rotY   =  dx * MAX_TILT;
    const gx     = 50 + dx * 20;
    const gy     = 50 + dy * 20;

    card.style.transform =
      `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(6px)`;
    card.style.setProperty('--gx', gx + '%');
    card.style.setProperty('--gy', gy + '%');
    card.classList.add('tilt-active');
  }

  function resetTilt(card) {
    card.style.transform = '';
    card.classList.remove('tilt-active');
  }

  function bindCard(card) {
    card.addEventListener('mousemove', e => applyTilt(card, e));
    card.addEventListener('mouseleave', () => resetTilt(card));
    card.addEventListener('touchstart', () => {}, { passive: true });
  }

  function init() {
    // Bind existing cards
    document.querySelectorAll('.project-card').forEach(bindCard);

    // Watch for cards added dynamically (loader.js)
    const mo = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.classList?.contains('project-card')) bindCard(node);
          node.querySelectorAll?.('.project-card').forEach(bindCard);
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  return { init };
})();

/* ── 3. Typewriter no hero ────────────────────────────────── */
const Typewriter = (() => {
  const phrases = [
    'Transformando ideias em experiências digitais.',
    'Jogos que desafiam. Apps que encantam.',
    'Criatividade encontra tecnologia.',
    'Feito com paixão, lançado com propósito.',
  ];

  function init() {
    const el = document.querySelector('.hero-tagline');
    if (!el) return;

    // Preserve any <br> by targeting only first text
    const originalHTML = el.innerHTML;
    const firstLine    = phrases[0];

    // Only run on home page
    if (!document.getElementById('hero')) return;

    let phraseIdx = 0, charIdx = 0, deleting = false;

    // Create cursor
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    cursor.setAttribute('aria-hidden', 'true');

    el.textContent = '';
    el.appendChild(cursor);

    function tick() {
      const current = phrases[phraseIdx];

      if (!deleting) {
        charIdx++;
        el.firstChild?.nodeType === 3
          ? (el.firstChild.textContent = current.slice(0, charIdx))
          : el.insertBefore(document.createTextNode(current.slice(0, charIdx)), cursor);

        if (charIdx === current.length) {
          // Pause before deleting
          setTimeout(() => { deleting = true; loop(); }, 2800);
          return;
        }
      } else {
        charIdx--;
        const textNode = [...el.childNodes].find(n => n.nodeType === 3);
        if (textNode) textNode.textContent = current.slice(0, charIdx);

        if (charIdx === 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % phrases.length;
          setTimeout(loop, 400);
          return;
        }
      }
      loop();
    }

    function loop() {
      const delay = deleting ? 38 : (charIdx === 0 ? 80 : 58);
      setTimeout(tick, delay);
    }

    // Start after hero entrance animation
    setTimeout(loop, 1400);
  }

  return { init };
})();

/* ── 4. Partículas no hero (canvas) ──────────────────────── */
const HeroParticles = (() => {
  let canvas, ctx, particles = [], animId, W, H;
  const COUNT = 55;
  const GOLD  = [212, 175, 55];
  const BLUE  = [36,  113, 163];

  function randBetween(a, b) { return a + Math.random() * (b - a); }

  function createParticle() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      r:  randBetween(0.6, 2.2),
      vx: randBetween(-0.18, 0.18),
      vy: randBetween(-0.18, 0.18),
      alpha: randBetween(0.2, 0.7),
      color: Math.random() > 0.6 ? GOLD : BLUE,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    particles.forEach(p => {
      // Move
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      // Draw dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color.join(',')},${p.alpha})`;
      ctx.fill();
    });

    // Draw connecting lines for nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${GOLD.join(',')},${0.08 * (1 - dist/100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    animId = requestAnimationFrame(draw);
  }

  function resize() {
    const hero = document.getElementById('hero');
    if (!hero || !canvas) return;
    W = hero.offsetWidth;
    H = hero.offsetHeight;
    canvas.width  = W;
    canvas.height = H;
  }

  function init() {
    const hero = document.getElementById('hero');
    if (!hero) return;

    canvas = document.createElement('canvas');
    canvas.id = 'hero-particles';
    canvas.setAttribute('aria-hidden', 'true');
    hero.querySelector('.hero-bg')?.appendChild(canvas) || hero.prepend(canvas);

    ctx = canvas.getContext('2d');
    resize();
    particles = Array.from({ length: COUNT }, createParticle);
    draw();
    window.addEventListener('resize', resize, { passive: true });
  }

  return { init };
})();

/* ── 5. Cursor personalizado ──────────────────────────────── */
const CustomCursor = (() => {
  let dot, ring, mouseX = -100, mouseY = -100;
  let ringX = -100, ringY = -100;

  function init() {
    // Only on desktop hover devices
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    dot  = document.createElement('div');
    ring = document.createElement('div');
    dot.id  = 'cs-cursor';
    ring.id = 'cs-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    document.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = mouseX + 'px';
      dot.style.top  = mouseY + 'px';
    });

    document.addEventListener('mousedown', () => {
      dot.classList.add('clicking');
      ring.classList.add('clicking');
    });
    document.addEventListener('mouseup', () => {
      dot.classList.remove('clicking');
      ring.classList.remove('clicking');
    });

    // Hover on interactive elements
    const INTERACTIVE = 'a, button, [role="button"], input, textarea, select, label, .project-card, .nav-btn, .filter-btn';
    document.addEventListener('mouseover', e => {
      if (e.target.closest(INTERACTIVE)) {
        dot.classList.add('hovering');
        ring.classList.add('hovering');
      }
    });
    document.addEventListener('mouseout', e => {
      if (e.target.closest(INTERACTIVE)) {
        dot.classList.remove('hovering');
        ring.classList.remove('hovering');
      }
    });

    // Ring follows with lag
    function animateRing() {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ring.style.left = ringX + 'px';
      ring.style.top  = ringY + 'px';
      requestAnimationFrame(animateRing);
    }
    animateRing();
  }

  return { init };
})();

/* ── 6. Transição entre páginas ──────────────────────────── */
const PageTransition = (() => {
  let overlay;

  function init() {
    overlay = document.createElement('div');
    overlay.id = 'page-transition';
    document.body.appendChild(overlay);

    // Slide out on load (page just arrived)
    overlay.classList.add('slide-out');
    overlay.addEventListener('animationend', () => {
      overlay.className = '';
    }, { once: true });

    // Intercept internal links
    document.addEventListener('click', e => {
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') ||
          href.startsWith('mailto') || href.startsWith('tel') ||
          link.target === '_blank') return;

      e.preventDefault();
      overlay.className = '';
      void overlay.offsetWidth; // force reflow
      overlay.classList.add('slide-in');

      overlay.addEventListener('animationend', () => {
        window.location.href = href;
      }, { once: true });
    });
  }

  return { init };
})();

/* ── 7. Parallax no hero ──────────────────────────────────── */
const HeroParallax = (() => {
  function init() {
    const hero    = document.getElementById('hero');
    const content = hero?.querySelector('.hero-content');
    const bg      = hero?.querySelector('.hero-bg');
    if (!hero || !content || !bg) return;

    // Pause if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        if (scrollY < hero.offsetHeight * 1.2) {
          content.style.transform = `translateY(${scrollY * 0.22}px)`;
          bg.style.transform      = `translateY(${scrollY * 0.40}px)`;
        }
        ticking = false;
      });
      ticking = true;
    }, { passive: true });
  }

  return { init };
})();

/* ── Boot ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (window.ThemeManager) {
    ThemeManager.init();
  } else {
    console.warn('[main.js] ThemeManager não encontrado — confirma que js/theme.js está a ser carregado ANTES de js/main.js no HTML.');
  }
  NavScroll.init();
  NavActive.init();
  MobileMenu.init();
  ScrollReveal.init();
  AnchorScroll.init();
  CounterAnimation.init();
  CardTilt.init();
  Typewriter.init();
  HeroParticles.init();
  CustomCursor.init();
  PageTransition.init();
  HeroParallax.init();

  console.log('%c CAPESSA STUDIOS ', 'background:#D4AF37;color:#0A0D14;font-weight:bold;padding:4px 8px;border-radius:4px;');
});
