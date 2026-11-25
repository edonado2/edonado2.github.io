#!/usr/bin/env node
/* Browser smoke test for the diagram hero: computed visibility, geometry and reduced motion. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = '/Users/ernesto/portfolio';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TMP = '/private/var/folders/nk/5f0zg96s4vjf_k6w_gclm8rc0000gn/T/opencode';
const STATES = [[1440, 900, false], [1440, 900, true], [320, 700, false], [320, 700, true]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

const PROBE = `new Promise((resolve) => setTimeout(async () => { try {
  const d = document.querySelector('.hero-diagram'), hero = document.querySelector('.hero');
  d.classList.add('is-revealed');
  const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  const t = getComputedStyle(d.querySelector('.hero-link')).transform;
  const m = t === 'none' ? { a: 1, b: 0 } : new DOMMatrixReadOnly(t);
  const node = getComputedStyle(d.querySelector('.hero-node'));
  const result = {
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    diagramOpacity: +getComputedStyle(d).opacity,
    nodeOpacity: +node.opacity,
    nodeTransform: node.transform,
    linkScale: Math.hypot(m.a, m.b),
    nodes: [...d.querySelectorAll('.hero-node')].map(box),
    links: [...d.querySelectorAll('.hero-link')].map(box),
    heroBottom: Math.round(hero.getBoundingClientRect().bottom),
    vh: innerHeight,
    overflowX: document.documentElement.scrollWidth > innerWidth,
    gl: document.querySelector('.hero__window')?.dataset.gl ?? 'missing',
    canvasDisplay: document.querySelector('.hero-gl') ? getComputedStyle(document.querySelector('.hero-gl')).display : 'missing',
    canvasWidth: document.querySelector('.hero-gl')?.width ?? 0,
    pause: document.querySelector('.hero-pause') ? box(document.querySelector('.hero-pause')) : null,
    pauseDisplay: document.querySelector('.hero-pause') ? getComputedStyle(document.querySelector('.hero-pause')).display : 'missing'
  };
  scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const rail = getComputedStyle(document.querySelector('.story-rail__fill')).transform;
  result.storyScale = rail === 'none' ? 1 : new DOMMatrixReadOnly(rail).a;
  resolve(JSON.stringify(result));
} catch (error) { resolve(JSON.stringify({ error: String(error) })); } }, 1800))`;

async function run(width, height, reduced) {
  const profile = fs.mkdtempSync(path.join(TMP, 'hero-visual-'));
  const child = spawn(CHROME, ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio',
    '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files',
    `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  try {
    let port = null;
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !port; i++) {
      await sleep(100);
      try { port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) || null; } catch { /* not yet */ }
    }
    if (!port) throw new Error('Chrome did not start');
    const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const ws = new WebSocket(ver.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
    const S = async (method, params) => {
      const r = await send(method, params, sessionId);
      if (r.error) throw new Error(`${method}: ${r.error.message}`);
      return r.result;
    };
    const ev = async (expression) => {
      const r = await S('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };
    await S('Page.enable');
    await S('Runtime.enable');
    await S('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    if (reduced) await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await S('Page.navigate', { url: pathToFileURL(path.join(ROOT, 'index.html')).href });
    await ev(`new Promise((r) => { const t = performance.now(); (function w() {
      if (document.readyState === 'complete' || performance.now() - t > 10000) r(); else setTimeout(w, 50);
    })(); })`);
    return JSON.parse(await ev(PROBE));
  } finally {
    if (child.exitCode === null) {
      try { child.kill('SIGKILL'); } catch { /* gone */ }
      await Promise.race([new Promise((r) => child.once('exit', r)), sleep(1000)]);
    }
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; }
      catch (error) { if (i === 9) throw error; await sleep(100); }
    }
  }
}

for (const [width, height, reduced] of STATES) {
  const d = await run(width, height, reduced);
  const label = `${width} reduced=${reduced}`;
  if (d.error) { check(`${label} probe ran`, false); continue; }
  check(`${label} diagram visible`, d.diagramOpacity > .99);
  check(`${label} nodes visible`, d.nodeOpacity > .99);
  check(`${label} nodes settled`, d.nodeTransform === 'none' || d.nodeTransform === 'matrix(1, 0, 0, 1, 0, 0)');
  check(`${label} connectors drawn`, d.linkScale > .99);
  check(`${label} no horizontal scroll`, !d.overflowX);
  check(`${label} aurora state`, reduced
    ? d.gl === 'fallback' && d.canvasDisplay === 'none'
    : d.gl === 'ready' && d.canvasDisplay !== 'none' && d.canvasWidth > 0);
  check(`${label} story progress follows scroll`, d.storyScale > .9);
  if (width === 320 && !reduced) {
    check(`${label} pause inside fold`,
      d.pauseDisplay !== 'none' && d.pause.y + d.pause.h <= d.vh + 1 && d.pause.y > d.heroBottom - 140);
  }
  if (width === 320) {
    check(`${label} hero inside fold`, d.heroBottom <= d.vh + 1);
    for (const [i, link] of d.links.entries()) {
      check(`${label} connector centred on nodes`, Math.abs(link.x + link.w / 2 - d.nodes[i].x - d.nodes[i].w / 2) < 6);
    }
    const [a, b, c] = d.nodes;
    check(`${label} nodes stack vertically`, a.y < b.y && b.y < c.y);
    for (const [i, link] of d.links.entries()) {
      const above = d.nodes[i], below = d.nodes[i + 1];
      const cx = link.x + link.w / 2, cy = link.y + link.h / 2;
      check(`${label} connector between nodes`,
        above.x - 8 <= cx && cx <= above.x + above.w + 8 &&
        above.y + above.h - 8 <= cy && cy <= below.y + 8);
    }
  }
}

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
console.log(`${checks.length - failed.length}/${checks.length} passed`);
process.exit(failed.length ? 1 : 0);
