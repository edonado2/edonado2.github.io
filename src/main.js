const frame = document.querySelector('[data-gl="aurora"]');
const pause = frame?.querySelector('.hero-pause');
let scene = null;

if (frame) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) {
    frame.dataset.gl = 'fallback';
  } else {
    try {
      const { initHeroScene } = await import('./hero-scene.js');
      scene = initHeroScene(frame.querySelector('canvas'), frame);
      frame.dataset.gl = 'ready';
    } catch (error) {
      console.warn('Three.js hero unavailable; keeping the still poster.', error);
      frame.dataset.gl = 'fallback';
    }
  }
}

pause?.addEventListener('click', () => {
  const wasPaused = pause.getAttribute('aria-pressed') === 'true';
  pause.setAttribute('aria-pressed', String(!wasPaused));
  pause.textContent = wasPaused ? 'Pause' : 'Play';
  pause.setAttribute('aria-label', wasPaused ? 'Pause background motion' : 'Play background motion');
  scene?.setPaused(!wasPaused);
});

const revealables = [...document.querySelectorAll('[data-reveal]')];
if (revealables.length) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('is-revealed'));
  } else {
    revealables.forEach((el) => {
      const siblings = [...el.parentElement.querySelectorAll(':scope > [data-reveal]')];
      el.style.setProperty('--i', String(siblings.indexOf(el)));
    });
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach((el) => revealObserver.observe(el));
  }
}
