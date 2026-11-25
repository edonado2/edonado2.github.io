"""Assertions for the Apple-style redesign (extend per task, run before and after each change)."""
from pathlib import Path
import sys

ROOT = Path('/Users/ernesto/portfolio')

def read(path):
    return (ROOT / path).read_text(errors='replace')

checks = []

def check(name, condition):
    checks.append((name, bool(condition)))

html = read('index.html')
css = read('styles.css')

hero_js = read('src/hero-scene.js')
poster = read('assets/aurora-poster.svg')

# Task 1: tokens, shell, chrome
check('ground token', '--p-bg: #f5f5f7' in html)
check('theme color', 'name="theme-color" content="#f5f5f7"' in html)
check('system font', '-apple-system, BlinkMacSystemFont' in html)
check('accent tokens', '--ap-ground' in css and '--ap-ink' in css and '--ap-line' in css)
check('single translucent header', 'backdrop-filter: blur(20px) saturate(180%)' in css and 'border-radius: var(--r-md, 12px)' not in css)
check('focus ring', ':focus-visible' in css)
check('press feedback', '.btn:active' in css and 'scale(.97)' in css)
check('old dark ground gone', '--p-bg: #0f1f10' not in html)

# Task 2: hero light field
check('shader light base', 'vec3(0.96, 0.97, 0.95)' in hero_js)
check('poster light ground', 'stop-color="#f5f5f7"' in poster)
check('hero light background', '.hero--centred .hero__window {' in css and 'background: var(--ap-ground) url("assets/aurora-poster.svg")' in css)
check('no dark hero colors', '#0b170c' not in css and '#08150a' not in css and '#0b170c' not in poster)
check('no film grain overlay', 'feTurbulence' not in css)

# Task 3: case studies as light source cards
check('light code tokens', css.count('--fx-bg: #ffffff') >= 2)
check('no dark code tokens', '#f3f7ef' not in css and '#e7eee1' not in css and '#122012' not in css)
check('neutral case hairline', '.section.case > .wrap::before' in css and 'rgba(29, 29, 31, .12)' in css)
check('no card hover lift', 'translateY(-3px)' not in css)

# Task 4: motion system
js = read('src/main.js')
check('reveal targets in html', html.count('data-reveal') >= 12)
check('reveal CSS', 'html.mo-js [data-reveal]' in css and '.is-revealed' in css)
check('one observer', 'IntersectionObserver' in js and 'data-reveal' in js)
check('reduced-motion JS branch', 'prefers-reduced-motion: reduce' in js)
check('reduced-motion has no transform', '@media (prefers-reduced-motion: reduce)' in css and 'transform: none !important' in css)

# Task 5: links and content truth
import re
hrefs = re.findall(r'<a [^>]*href="([^"]+)"', html)
def allowed(h):
    return h.startswith('#') or h == 'mailto:ernestodonado18@gmail.com' or h.startswith('https://github.com/edonado2')
check('links allowed', all(allowed(h) for h in hrefs))
required = [
    'Full-stack developer, interface to database',
    'TouchyOS', 'Ride expense tracker', 'Document summarizer', 'Corporate landing page',
    'Work together', 'Venezuela · Open to remote', 'gpt-4o-mini', 'Gemini 2.0 Flash',
]
check('verified copy intact', all(s in html for s in required))
check('agent-lint section', 'agent-lint' in html)
check('agent-lint truthful line', 'stale paths, renamed scripts and broken links' in html)

# Mechanical detector fixes
check('taller nav', '--nav: 72px' in css and '--nav: 64px' in css)
check('graphite mark', '.nav .mark { background: var(--ap-ink); }' in css)
check('phone bar logo + menu only', '.nav:not(.is-open) .nav__actions { display: none; }' in css)
check('menu button at right edge', '.nav:not(.is-open) .nav__actions + .nav__toggle { margin-left: auto; }' in css)
check('pill inset', '.pill { padding: 8px 14px; }' in css)
check('source frame inset', 'background: #ffffff; border: 1px solid var(--ap-line); border-radius: var(--u-r); padding: 8px;' in css)
check('compact hero window under 360px', '@media (max-width: 359px)' in css and 'min-height: 220px' in css)
# Hero redesign, Task 1: full-bleed aurora and diagram markup
check('hero diagram class', 'hero hero--centred hero--diagram' in html)
check('diagram hidden from AT', '<div class="hero-diagram" aria-hidden="true"' in html)
check('diagram nouns', all(s in html for s in ('hero-node', 'interface', 'API', 'database', 'React', 'TypeScript', 'Node.js')))
check('aurora is hero layer', 'hero--diagram' in html and html.index('hero__window') < html.index('hero__c'))
check('aurora is direct hero child', '<section class="hero hero--centred hero--diagram" data-enter aria-labelledby="hero-h">\n    <div class="hero__window"' in html)
# Hero redesign, Task 2: diagram styling and one-shot draw-on reveal
check('diagram reveal', 'html.mo-js .hero-diagram .hero-link' in css and 'scaleX(0)' in css)
check('diagram drawn revealed', '.hero-diagram.is-revealed .hero-link' in css and 'scaleX(1)' in css)
check('diagram reduced motion', 'html.mo-js .hero-diagram .hero-link { transform: rotate(var(--turn, 0deg)) scaleX(1); transition: none; }' in css and 'html.mo-js .hero-diagram .hero-node { opacity: 1; transform: none; transition: none; }' in css)
# Hero redesign, Task 3: pointer drift reaches the full-bleed hero layer
check('pointer over full-bleed hero', "frame.closest('.hero') || frame" in hero_js)
check('pause pinned to hero', '.hero__window .hero-pause {\n  position: absolute;' in css)

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(('PASS ' if ok else 'FAIL ') + name)
print(f'{len(checks) - len(failed)}/{len(checks)} passed')
sys.exit(1 if failed else 0)
