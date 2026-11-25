/* The scroll film's only instrument: a progress line that reads the reader's position. */
const fill = document.querySelector('.story-rail__fill');

if (fill) {
  let queued = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    fill.style.transform = `scaleX(${progress})`;
    queued = false;
  };
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
}
