import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.min.js';

const vertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fragment = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uPointer;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = vUv;
  float t = uTime * 0.055;
  float drift = fbm(vec2(uv.x * 2.4 + uPointer.x * 0.12, uv.y * 1.5 - t));
  float folds = sin((uv.y + drift * 0.42) * 11.0 - uv.x * 2.6 + t * 2.4) * 0.5 + 0.5;
  float veil = smoothstep(0.18, 0.92, folds) * smoothstep(0.0, 0.30, uv.y) * smoothstep(1.0, 0.55, uv.y);
  float fine = fbm(vec2(uv.x * 7.0 + t, uv.y * 3.0 - t * 1.4));
  vec3 base = vec3(0.96, 0.97, 0.95);
  vec3 green = vec3(0.86, 0.92, 0.82);
  vec3 lime = vec3(0.72, 0.86, 0.58);
  vec3 col = mix(base, green, clamp(drift * 0.95, 0.0, 1.0));
  col = mix(col, lime, veil * (0.30 + fine * 0.28));
  col += lime * pow(veil, 3.0) * 0.08;
  float v = 1.0 - 0.32 * length((uv - 0.5) * vec2(1.15, 1.0));
  col *= v;
  col += (hash(uv * 913.0 + uTime) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}`;

export function initHeroScene(canvas, frame) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const uniforms = {
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
  };
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, depthTest: false, depthWrite: false })
  );
  scene.add(mesh);

  const resize = () => {
    const { width, height } = frame.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    renderer.setSize(width, height, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(frame);

  const pointer = (e) => {
    const r = frame.getBoundingClientRect();
    uniforms.uPointer.value.set((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };
  const surface = frame.closest('.hero') || frame;
  surface.addEventListener('pointermove', pointer, { passive: true });

  let visible = true, paused = false, elapsed = 0, last = performance.now();
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.01 });
  io.observe(frame);

  let raf = 0;
  const draw = () => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    if (visible && !paused) {
      elapsed += dt;
      uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(draw);
  };
  draw();

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    frame.dataset.gl = 'fallback';
  });
  return {
    setPaused(value) { paused = value; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); },
  };
}
