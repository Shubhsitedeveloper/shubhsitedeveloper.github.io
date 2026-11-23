// UNCEASE — WebGL stage. Procedural bottle, cans, labels and rain-glass backdrop.
// Everything is driven by section progress values (P) so the film is deterministic.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const FLAVOURS = [
  { key: 'blueberry', name: 'BLUEBERRY', c1: '#2346b8', c2: '#0f1f63', c3: '#4f74e6', tint: '#1b2f86' },
  { key: 'cranberry', name: 'CRANBERRY', c1: '#c4202b', c2: '#6d0d14', c3: '#ee4a46', tint: '#7d1018' },
  { key: 'peach', name: 'PEACH', c1: '#ee6b2f', c2: '#a7321a', c3: '#ffb27a', tint: '#8f3a14' },
  { key: 'apple', name: 'GREEN APPLE', c1: '#73ad2f', c2: '#365c12', c3: '#a9d65a', tint: '#3d6413' },
  { key: 'five', name: 'FLAVOUR 05', c1: '#cc1f86', c2: '#6a0b45', c3: '#f25bb2', tint: '#6e0e49' },
];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eout = t => 1 - Math.pow(1 - t, 3);
const seg = (v, a, b) => clamp((v - a) / (b - a));

/* ---------------- bottle profile ---------------- */
const PROFILE = [
  [0.0, 0.0], [0.27, 0.0], [0.322, 0.012], [0.341, 0.05], [0.346, 0.13], [0.346, 1.2],
  [0.342, 1.29], [0.326, 1.38], [0.285, 1.49], [0.228, 1.6], [0.172, 1.7], [0.143, 1.79],
  [0.134, 1.92], [0.129, 2.12], [0.13, 2.22], [0.146, 2.245], [0.153, 2.285], [0.147, 2.325],
  [0.12, 2.335], [0.105, 2.33]
];
function profileCurve() {
  const pts = PROFILE.map(p => new THREE.Vector2(p[0] * .9, p[1]));
  const c = new THREE.SplineCurve(pts);
  return c.getPoints(220);
}
const PROFILE_PTS = profileCurve();
function radiusAt(y) {
  // monotonic section between y 0.13 and 2.2
  let best = null;
  for (let i = 1; i < PROFILE_PTS.length; i++) {
    const a = PROFILE_PTS[i - 1], b = PROFILE_PTS[i];
    if ((y >= a.y && y <= b.y) || (y <= a.y && y >= b.y)) {
      if (Math.abs(b.y - a.y) < 1e-6) continue;
      const t = (y - a.y) / (b.y - a.y);
      const r = lerp(a.x, b.x, t);
      if (a.y > 0.1) best = r;
    }
  }
  return best ?? 0.34;
}
function bandPoints(y0, y1, off, n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const y = lerp(y0, y1, i / n);
    pts.push(new THREE.Vector2(radiusAt(y) + off, y));
  }
  return pts;
}

/* ---------------- canvas painters ---------------- */
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}
function textOnEllipse(ctx, str, cx, cy, rx, ry, a0, a1, font, color, inward = true) {
  ctx.save(); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = [...str]; const n = chars.length;
  chars.forEach((ch, i) => {
    const a = lerp(a0, a1, n === 1 ? .5 : i / (n - 1));
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    // tangent
    const tx = -Math.sin(a) * rx, ty = Math.cos(a) * ry;
    let rot = Math.atan2(ty, tx);
    if (!inward) rot += Math.PI;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillText(ch, 0, 0); ctx.restore();
  });
  ctx.restore();
}
function goldGrad(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#8a6220'); g.addColorStop(.25, '#f6dc8a'); g.addColorStop(.5, '#c99a3c');
  g.addColorStop(.75, '#ffe9a6'); g.addColorStop(1, '#9b6f22');
  return g;
}
function fakeLines(ctx, x, y, w, rows, alpha, rng) {
  ctx.save(); ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let i = 0; i < rows; i++) {
    const lw = w * (0.55 + rng() * 0.45);
    ctx.fillRect(x, y + i * 26, lw, 9);
  }
  ctx.restore();
}
function rngFrom(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function paintBody(f, wolf, mode, W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); const k = W / 2048;
  ctx.scale(k, k); const w = 2048, h = H / k;
  const MR = mode === 'mr';
  const GOLD = MR ? 'rgb(0,70,255)' : null;
  if (MR) { ctx.fillStyle = 'rgb(0,150,0)'; ctx.fillRect(0, 0, w, h); }
  else {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, f.c2); g.addColorStop(.3, f.c1); g.addColorStop(.5, f.c1); g.addColorStop(.7, f.c1); g.addColorStop(1, f.c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const rg = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 640);
    rg.addColorStop(0, f.c3 + 'cc'); rg.addColorStop(1, f.c3 + '00');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    // fine diagonal grain
    ctx.save(); ctx.globalAlpha = .06; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    for (let i = -h; i < w; i += 9) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke(); }
    ctx.restore();
  }
  const gfill = GOLD || goldGrad(ctx, 0, 0, w, 0);
  // borders
  ctx.fillStyle = gfill; ctx.fillRect(0, 10, w, 18); ctx.fillRect(0, h - 28, w, 18);
  ctx.fillRect(0, 38, w, 4); ctx.fillRect(0, h - 42, w, 4);
  const cx = w / 2, cy = h / 2, rx = 300, ry = 410;
  // oval
  if (!MR) {
    const og = ctx.createRadialGradient(cx, cy - 60, 30, cx, cy, 470);
    og.addColorStop(0, f.c3); og.addColorStop(.55, f.c1); og.addColorStop(1, f.c2);
    ctx.fillStyle = og; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = GOLD || goldGrad(ctx, cx - rx, cy - ry, cx + rx, cy + ry);
  ctx.lineWidth = 16; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx, cy, rx - 30, ry - 30, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, rx - 92, ry - 92, 0, Math.PI * .08, Math.PI * .92); ctx.stroke();
  // side dashes + stars
  ctx.fillStyle = GOLD || '#f1d27e';
  for (let i = 0; i < 7; i++) {
    const a1 = Math.PI * (1.12 + i * .045), a2 = Math.PI * (1.88 - i * .045);
    star(ctx, cx + Math.cos(a1) * (rx - 58), cy + Math.sin(a1) * (ry - 58), 9);
    star(ctx, cx + Math.cos(a2) * (rx - 58), cy + Math.sin(a2) * (ry - 58), 9);
  }
  if (!MR) {
    textOnEllipse(ctx, 'PREMIUM QUALITY PRODUCT', cx, cy, rx - 62, ry - 62, Math.PI * 1.27, Math.PI * 1.73, '700 34px Cinzel, serif', '#f6dc8a');
    // UNCEASE
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 108px Anton, Impact, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillText('UNCEASE', cx + 4, cy - 228);
    ctx.fillStyle = '#fbf7ef'; ctx.fillText('UNCEASE', cx, cy - 232);
    ctx.restore();
    // wolf
    const ww = 300, wh = ww * wolf.height / wolf.width;
    ctx.drawImage(wolf, cx - ww / 2, cy - 210, ww, wh);
  }
  // flavour banner
  const by = cy + 228;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx - 200, by - 30); ctx.lineTo(cx + 200, by - 30); ctx.lineTo(cx + 180, by); ctx.lineTo(cx + 200, by + 30);
  ctx.lineTo(cx - 200, by + 30); ctx.lineTo(cx - 180, by); ctx.closePath();
  if (!MR) { ctx.fillStyle = f.c2; ctx.fill(); }
  ctx.lineWidth = 4; ctx.strokeStyle = GOLD || '#e9c56b'; ctx.stroke();
  ctx.restore();
  if (!MR) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 34px Cinzel, serif'; ctx.fillStyle = '#fff'; ctx.fillText(f.name, cx, by + 2);
    ctx.font = '700 58px Cinzel, serif'; ctx.fillStyle = '#fff6df'; ctx.fillText('FRUIT BEER', cx, by + 86);
    ctx.font = '700 22px Cinzel, serif'; ctx.fillStyle = '#f6dc8a'; ctx.fillText('NON-ALCOHOLIC', cx, by + 132);
    ctx.restore();
    textOnEllipse(ctx, 'Crafted & Bottled in India', cx, cy, rx - 58, ry - 58, Math.PI * .66, Math.PI * .34, 'italic 600 26px Cinzel, serif', '#fbeec9', false);
    // veg mark
    ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(cx - 360, cy + 200, 46, 46);
    ctx.strokeStyle = '#1f8a2c'; ctx.lineWidth = 4; ctx.strokeRect(cx - 356, cy + 204, 38, 38);
    ctx.fillStyle = '#1f8a2c'; ctx.beginPath(); ctx.arc(cx - 337, cy + 223, 11, 0, 7); ctx.fill(); ctx.restore();
    // side copy blocks (unreadable at bottle scale)
    const r = rngFrom(7);
    fakeLines(ctx, 150, 150, 460, 9, .55, r);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.strokeRect(150, 420, 420, 300);
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(150, 420 + i * 50); ctx.lineTo(570, 420 + i * 50); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(390, 420); ctx.lineTo(390, 720); ctx.stroke(); ctx.restore();
    fakeLines(ctx, 1440, 150, 460, 6, .55, r);
    ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(1440, 330, 300, 140);
    ctx.fillStyle = '#111'; ctx.font = '600 26px Archivo, sans-serif'; ctx.fillText('MRP ₹69.00', 1462, 380);
    ctx.fillRect(1462, 400, 200, 4); ctx.fillRect(1462, 420, 150, 4); ctx.restore();
    fakeLines(ctx, 1440, 520, 470, 8, .55, r);
  }
  return cv;
}

function paintNeck(f, wolf, mode, W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); const k = W / 1024; ctx.scale(k, k);
  const w = 1024, h = H / k; const MR = mode === 'mr';
  if (MR) { ctx.fillStyle = 'rgb(0,150,0)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgb(0,70,255)'; }
  else {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, f.c2); g.addColorStop(.5, f.c1); g.addColorStop(1, f.c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const rg = ctx.createRadialGradient(w / 2, h * .45, 10, w / 2, h * .45, 300);
    rg.addColorStop(0, f.c3 + 'aa'); rg.addColorStop(1, f.c3 + '00'); ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = goldGrad(ctx, 0, 0, w, 0);
  }
  ctx.fillRect(0, h - 14, w, 8); ctx.fillRect(0, 4, w, 5);
  if (!MR) {
    const ww = 170, wh = ww * wolf.height / wolf.width;
    // flipped vertically because lathe v runs bottom->top
    ctx.drawImage(wolf, w / 2 - ww / 2, 26, ww, wh);
    ctx.textAlign = 'center'; ctx.font = '400 74px Anton, Impact, sans-serif'; ctx.fillStyle = '#fbf7ef';
    ctx.fillText('UNCEASE', w / 2, 26 + wh + 66);
    ctx.font = '400 30px Anton, Impact, sans-serif'; ctx.fillText('BEER', w / 2, 26 + wh + 102);
  }
  return cv;
}

function paintCan(c, wolf, W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); const k = W / 2048; ctx.scale(k, k); const w = 2048, h = H / k;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.c2); g.addColorStop(.45, c.c1); g.addColorStop(1, c.c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // diagonal speed slashes
  ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = c.c3;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); const x = i * 260 - 200; ctx.moveTo(x, h); ctx.lineTo(x + 120, h); ctx.lineTo(x + 520, 0); ctx.lineTo(x + 400, 0); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = goldGrad(ctx, 0, 0, w, 0);
  ctx.fillRect(0, 60, w, 14); ctx.fillRect(0, h - 74, w, 14);
  const cx = w / 2;
  const ww = 420, wh = ww * wolf.height / wolf.width;
  ctx.drawImage(wolf, cx - ww / 2, 120, ww, wh);
  ctx.textAlign = 'center';
  ctx.font = '400 150px Anton, Impact, sans-serif'; ctx.fillStyle = '#fbf7ef'; ctx.fillText('UNCEASE', cx, 120 + wh + 140);
  ctx.font = '700 64px Cinzel, serif'; ctx.fillStyle = '#f6dc8a'; ctx.fillText('ENERGY DRINK', cx, 120 + wh + 225);
  // back side repeat, small vertical wordmark
  ctx.save(); ctx.translate(140, h / 2); ctx.rotate(-Math.PI / 2); ctx.font = '400 120px Anton, Impact, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillText('UNCEASE', 0, 40); ctx.restore();
  ctx.save(); ctx.translate(w - 140, h / 2); ctx.rotate(Math.PI / 2); ctx.font = '400 120px Anton, Impact, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillText('UNCEASE', 0, 40); ctx.restore();
  return cv;
}

function dropletNormalMap(size, count, seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = 128; d[i + 1] = 128; d[i + 2] = 255; d[i + 3] = 255; }
  const r = rngFrom(seed);
  for (let n = 0; n < count; n++) {
    const R = 1.5 + Math.pow(r(), 3) * 9, cx = r() * size, cy = r() * size, sy = 1 + r() * .35;
    for (let y = Math.floor(-R * sy); y <= R * sy; y++) for (let x = Math.floor(-R); x <= R; x++) {
      const nx = x / R, ny = y / (R * sy), q = nx * nx + ny * ny; if (q > 1) continue;
      const nz = Math.sqrt(1 - q);
      const px = ((Math.floor(cx + x) % size) + size) % size, py = ((Math.floor(cy + y) % size) + size) % size;
      const o = (py * size + px) * 4;
      d[o] = 128 + nx * 120; d[o + 1] = 128 - ny * 120; d[o + 2] = 128 + nz * 127;
    }
  }
  ctx.putImageData(img, 0, 0); return cv;
}

function letterCanvas(ch) {
  const cv = document.createElement('canvas'); const ctx = cv.getContext('2d');
  ctx.font = '400 400px Anton, Impact, sans-serif';
  const w = Math.ceil(ctx.measureText(ch).width) + 20; cv.width = w; cv.height = 520;
  ctx.font = '400 400px Anton, Impact, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(ch, w / 2, 460); return cv;
}

function canvasTex(cv, renderer, srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.needsUpdate = true; return t;
}

/* ---------------- label material with noise dissolve ---------------- */
function makeLabelMat(mapA, mr, nrm, low) {
  const m = new THREE.MeshStandardMaterial({
    map: mapA, roughnessMap: mr, metalnessMap: mr, roughness: 1, metalness: 1,
    normalMap: low ? null : nrm, normalScale: new THREE.Vector2(.25, .25), envMapIntensity: 1.1
  });
  m.userData.u = { uMap2: { value: mapA }, uMix: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uMap2; uniform float uMix;
        float h12(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(h12(i),h12(i+vec2(1,0)),f.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 cA = texture2D(map, vMapUv);
          vec4 cB = texture2D(uMap2, vMapUv);
          float nz = vn(vMapUv*vec2(14.,6.))*.6 + vn(vMapUv*vec2(40.,18.))*.4;
          float edge = vMapUv.y*.55 + nz*.45;
          float th = uMix*1.25 - .12;
          float t = smoothstep(th-.03, th+.03, edge);
          vec4 cc = mix(cB, cA, t);
          float band = (1.-smoothstep(0., .035, abs(edge-th))) * step(.001,uMix) * step(uMix,.999);
          diffuseColor *= cc;
          totalEmissiveRadiance += vec3(1.,.62,.22) * band * 2.2;
        #endif`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>');
    // emissive needs to be declared before map: move our addition after emissive init
    sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive;');
  };
  return m;
}

/* ---------------- background shader ---------------- */
const BG_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, .9999, 1.); }`;
const BG_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uRain, uDim, uFlash;
uniform vec2 uRes;
uniform vec3 uTint, uBase, uGold;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
vec2 h22(vec2 p){ float n = h21(p); return vec2(n, h21(p+n)); }
vec3 scene(vec2 uv){
  vec2 p = uv - .5; p.x *= uRes.x/uRes.y;
  float r = length(p - vec2(0., -.05));
  vec3 col = mix(uTint*1.15, uBase, smoothstep(0., .95, r));
  // bokeh
  for (int i=0;i<9;i++){
    float fi = float(i);
    vec2 c = vec2(sin(fi*2.3+uTime*.05)*.8, cos(fi*1.7+uTime*.04)*.45);
    float s = .06 + .05*fract(fi*.37);
    float d = length(p - c);
    float b = smoothstep(s, s*.7, d);
    col += mix(uGold, uTint*2.2, fract(fi*.61)) * b * .05;
  }
  return col;
}
vec3 layer(vec2 uv, float t, float sc){
  vec2 asp = vec2(3., 1.);
  vec2 st = uv*sc*asp;
  st.y += t*.22;
  vec2 id = floor(st);
  vec2 gv = fract(st) - .5;
  float n = h21(id);
  float tt = t + n*6.283;
  float w = uv.y*10.;
  float x = (n-.5)*.8 + sin(3.*w)*pow(sin(w), 6.)*.45;
  float y = -sin(tt + sin(tt + sin(tt)*.5))*.45;
  y -= (gv.x - x)*(gv.x - x);
  vec2 dp = (gv - vec2(x, y))/asp;
  float d = length(dp);
  float drop = smoothstep(.05, .03, d);
  vec2 tp = (gv - vec2(x, t*.22))/asp;
  tp.y = (fract(tp.y*8.)-.5)/8.;
  float tr = smoothstep(.03, .02, length(tp));
  float fogT = smoothstep(-.05, .05, dp.y);
  tr *= fogT * smoothstep(.5, y, gv.y);
  return vec3(dp*drop*30. + tp*tr*30., drop + tr);
}
float statics(vec2 uv, out vec2 off){
  vec2 st = uv*vec2(uRes.x/uRes.y, 1.)*26.;
  vec2 id = floor(st); vec2 gv = fract(st)-.5;
  vec2 rp = (h22(id)-.5)*.7;
  float rad = .06 + .2*h21(id+3.1);
  float alive = step(.78, h21(id+7.7));
  vec2 dd = gv - rp;
  float m = smoothstep(rad, rad*.6, length(dd)) * alive;
  off = dd*m*2.;
  return m;
}
void main(){
  vec2 uv = vUv;
  float t = uTime*.35;
  vec3 a = layer(uv, t, 2.2);
  vec3 b = layer(uv*1.6+7.3, t*1.1, 2.2);
  vec2 so; float s = statics(uv, so);
  vec2 off = (a.xy + b.xy)*.6 + so*.9;
  float mask = clamp(a.z + b.z + s, 0., 1.)*uRain;
  vec2 suv = uv + off*.035*uRain;
  vec3 col = scene(suv);
  // drop highlight
  col += mask*.025 + mask*vec3(1.,.9,.75)*.07*smoothstep(.2,.8,-off.y);
  col = mix(scene(uv)*0.85, col, .65 + .35*uRain);
  // vignette & grain
  vec2 q = uv-.5; col *= 1. - dot(q,q)*1.25;
  float g = h21(uv*uRes + fract(uTime)*91.);
  col += (g-.5)*.035;
  col += uGold*uFlash*.35;
  gl_FragColor = vec4(col*uDim, 1.);
  #include <colorspace_fragment>
}`;

/* ---------------- main ---------------- */
export async function createStage(canvas, opts = {}) {
  const lowTier = !!opts.low;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowTier, powerPreference: 'high-performance' });
  const DPR = Math.min(window.devicePixelRatio || 1, lowTier ? 1.5 : 2);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 60);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;

  // fonts + wolf
  await Promise.all([
    document.fonts.load('400 100px Anton'), document.fonts.load('700 40px Cinzel'),
    document.fonts.load('italic 600 26px Cinzel'), document.fonts.load('600 20px Archivo')
  ]).catch(() => {});
  const wolf = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = opts.wolf; });

  const LW = lowTier ? 1024 : 2048;
  const bodyMR = canvasTex(paintBody(FLAVOURS[0], wolf, 'mr', LW, LW * 960 / 2048), renderer, false);
  const neckMR = canvasTex(paintNeck(FLAVOURS[0], wolf, 'mr', LW / 2, LW / 2 * 488 / 1024), renderer, false);
  const bodyTex = FLAVOURS.map(f => canvasTex(paintBody(f, wolf, 'c', LW, LW * 960 / 2048), renderer));
  const neckTex = FLAVOURS.map(f => canvasTex(paintNeck(f, wolf, 'c', LW / 2, LW / 2 * 488 / 1024), renderer));
  const nrm = canvasTex(dropletNormalMap(lowTier ? 512 : 1024, lowTier ? 500 : 1500, 11), renderer, false);
  nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.repeat.set(2, 3);

  /* background */
  const bgU = {
    uTime: { value: 0 }, uRain: { value: 1 }, uDim: { value: 1 }, uFlash: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTint: { value: new THREE.Color('#3a2608') }, uBase: { value: new THREE.Color('#060504') }, uGold: { value: new THREE.Color('#d6a843') }
  };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: bgU, depthWrite: false, depthTest: false
  }));
  bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);

  /* lights */
  const key = new THREE.DirectionalLight('#fff1dc', 2.2); key.position.set(-3, 5, 4); scene.add(key);
  const rimL = new THREE.PointLight('#d6a843', 22, 12, 2); rimL.position.set(-2.2, 2.2, -1.6); scene.add(rimL);
  const rimR = new THREE.PointLight('#4f74e6', 26, 12, 2); rimR.position.set(2.4, 1.4, -1.4); scene.add(rimR);
  const fill = new THREE.PointLight('#ffffff', 4, 10, 2); fill.position.set(0, 1, 4); scene.add(fill);

  /* bottle parts */
  const glassGeo = new THREE.LatheGeometry(PROFILE_PTS, lowTier ? 48 : 96);
  const liquidPts = PROFILE_PTS.filter(p => p.y < 1.98 && p.y > 0.03).map(p => new THREE.Vector2(Math.max(0, p.x - 0.022), p.y));
  liquidPts.unshift(new THREE.Vector2(0, 0.04)); liquidPts.push(new THREE.Vector2(0, liquidPts[liquidPts.length - 1].y));
  const liquidGeo = new THREE.LatheGeometry(liquidPts, lowTier ? 32 : 64);
  const bodyGeo = new THREE.LatheGeometry(bandPoints(0.3, 0.94, 0.005), lowTier ? 48 : 96, -Math.PI * .62, Math.PI * 1.24);
  const neckGeo = new THREE.LatheGeometry(bandPoints(1.66, 2.08, 0.005, 40), lowTier ? 40 : 80, -Math.PI * .9, Math.PI * 1.8);

  // cap
  const capGroupGeo = (() => {
    const g = new THREE.CylinderGeometry(0.138, 0.149, 0.075, 63, 2, true);
    const pos = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const a = Math.atan2(v.x, v.z); const y01 = (v.y + .0375) / .075;
      const crimp = 1 + Math.max(0, Math.cos(a * 21)) * .06 * (1 - y01);
      v.x *= crimp; v.z *= crimp; pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  })();
  const capTopGeo = new THREE.CircleGeometry(0.139, 48); capTopGeo.rotateX(-Math.PI / 2); capTopGeo.translate(0, .0375, 0);

  const glassMat = lowTier
    ? new THREE.MeshPhysicalMaterial({ color: '#3a1606', roughness: .08, metalness: 0, transparent: true, opacity: .55, depthWrite: false, clearcoat: 1, clearcoatRoughness: .1, normalMap: nrm, normalScale: new THREE.Vector2(.5, .5), envMapIntensity: 1.6 })
    : new THREE.MeshPhysicalMaterial({
      color: '#ffffff', transmission: 1, thickness: .55, roughness: .06, ior: 1.5, metalness: 0,
      attenuationColor: new THREE.Color('#4a1a05'), attenuationDistance: .3, clearcoat: 1, clearcoatRoughness: .05,
      normalMap: nrm, normalScale: new THREE.Vector2(.55, .55), clearcoatNormalMap: nrm, clearcoatNormalScale: new THREE.Vector2(.8, .8),
      specularIntensity: 1, envMapIntensity: 1.4
    });
  const liquidMat = new THREE.MeshStandardMaterial({ color: '#1e0a02', roughness: .2, metalness: 0, emissive: '#3a1404', emissiveIntensity: .25 });
  const capMat = new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 1, roughness: .28 });
  const capTopMat = new THREE.MeshStandardMaterial({ color: '#c3141c', metalness: .6, roughness: .32 });

  function makeBottle(fi) {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(glassGeo, glassMat); glass.renderOrder = 2;
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    const bm = makeLabelMat(bodyTex[fi], bodyMR, nrm, lowTier);
    const nm = makeLabelMat(neckTex[fi], neckMR, nrm, lowTier);
    const body = new THREE.Mesh(bodyGeo, bm);
    const neck = new THREE.Mesh(neckGeo, nm);
    const cap = new THREE.Group();
    cap.add(new THREE.Mesh(capGroupGeo, capMat), new THREE.Mesh(capTopGeo, capTopMat));
    cap.position.y = 2.33 + .02;
    const capHome = cap.position.y;
    g.add(liquid, body, neck, glass, cap);
    g.userData = { body, neck, cap, capHome, bm, nm };
    return g;
  }

  const main = makeBottle(0); scene.add(main);
  const line = [0, 1, 2, 3].map(i => { const b = makeBottle(i); scene.add(b); b.visible = false; return b; });

  /* letters UNCEASE */
  const letters = new THREE.Group(); scene.add(letters);
  const word = 'UNCEASE'.split('');
  const letterMeshes = []; let totalW = 0; const gap = .05;
  word.forEach(ch => {
    const cv = letterCanvas(ch); const t = canvasTex(cv, renderer);
    const hgt = 2.9; const wdt = hgt * cv.width / cv.height;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wdt, hgt), new THREE.MeshBasicMaterial({ map: t, transparent: true, color: new THREE.Color('#e9e1d2'), depthWrite: false, toneMapped: false }));
    m.userData.w = wdt; letterMeshes.push(m); letters.add(m); totalW += wdt + gap;
  });
  totalW -= gap; { let x = -totalW / 2; letterMeshes.forEach(m => { m.userData.x = x + m.userData.w / 2; x += m.userData.w + gap; }); }
  letters.position.set(0, 1.25, -2.6);

  /* fruit pearls + ice */
  const pearlMat = new THREE.MeshPhysicalMaterial({ color: '#2346b8', roughness: .32, clearcoat: 1, clearcoatRoughness: .15, sheen: .6, sheenColor: new THREE.Color('#ffffff') });
  const pearlGeo = new THREE.SphereGeometry(1, 32, 24);
  const rnd = rngFrom(42);
  const pearls = []; for (let i = 0; i < 0; i++) {
    const m = new THREE.Mesh(pearlGeo, pearlMat); const s = .05 + rnd() * .07; m.scale.setScalar(s);
    m.userData = { a: rnd() * Math.PI * 2, R: 1.05 + rnd() * .9, y: .2 + rnd() * 2.1, sp: .12 + rnd() * .2, s, ph: rnd() * 6 };
    scene.add(m); pearls.push(m);
  }
  const iceGeo = (() => {
    const g = new THREE.BoxGeometry(1, 1, 1, 8, 8, 8); const p = g.attributes.position; const v = new THREE.Vector3(); const r = .18;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const c = new THREE.Vector3(clamp(v.x, -.5 + r, .5 - r), clamp(v.y, -.5 + r, .5 - r), clamp(v.z, -.5 + r, .5 - r));
      const d = v.clone().sub(c); if (d.lengthSq() > 0) d.setLength(r); v.copy(c.add(d)); p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  })();
  const iceMat = lowTier
    ? new THREE.MeshPhysicalMaterial({ color: '#cfe6ff', roughness: .1, transparent: true, opacity: .35, clearcoat: 1, envMapIntensity: 2, depthWrite: false })
    : new THREE.MeshPhysicalMaterial({ color: '#eef6ff', transmission: 1, thickness: .6, roughness: .14, ior: 1.31, clearcoat: 1, normalMap: nrm, normalScale: new THREE.Vector2(.4, .4), envMapIntensity: 1.6 });
  const ices = []; for (let i = 0; i < (lowTier ? 0 : 5); i++) {
    const m = new THREE.Mesh(iceGeo, iceMat); const s = .2 + rnd() * .16; m.scale.setScalar(s);
    m.userData = { a: rnd() * Math.PI * 2, R: 1.3 + rnd() * .7, y: .3 + rnd() * 2, sp: .08 + rnd() * .12, s, ph: rnd() * 6, rx: rnd() * 3, ry: rnd() * 3 };
    scene.add(m); ices.push(m);
  }

  /* bubbles in bottle (upper zone) + pop spray */
  const bubN = lowTier ? 60 : 140;
  const bubGeo = new THREE.BufferGeometry(); const bubPos = new Float32Array(bubN * 3); const bubSeed = new Float32Array(bubN * 3);
  for (let i = 0; i < bubN; i++) { bubSeed[i * 3] = rnd(); bubSeed[i * 3 + 1] = rnd(); bubSeed[i * 3 + 2] = rnd(); }
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
  const sprite = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,.0)'); g.addColorStop(.6, 'rgba(255,240,210,.25)');
    g.addColorStop(.85, 'rgba(255,250,235,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(24, 22, 5, 0, 7); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const bubMat = new THREE.PointsMaterial({ size: .028, map: sprite, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: true, color: '#ffe8c2', opacity: .9 });
  const bubbles = new THREE.Points(bubGeo, bubMat); bubbles.renderOrder = 5; main.add(bubbles);

  const sprN = lowTier ? 160 : 420;
  const sprGeo = new THREE.BufferGeometry(); const sprPos = new Float32Array(sprN * 3); const sprV = new Float32Array(sprN * 3);
  for (let i = 0; i < sprN; i++) {
    const a = rnd() * Math.PI * 2, up = 1.2 + rnd() * 2.6, out = .3 + rnd() * 1.3;
    sprV[i * 3] = Math.cos(a) * out; sprV[i * 3 + 1] = up; sprV[i * 3 + 2] = Math.sin(a) * out;
  }
  sprGeo.setAttribute('position', new THREE.BufferAttribute(sprPos, 3));
  const sprMat = new THREE.PointsMaterial({ size: .05, map: sprite, transparent: true, depthWrite: false, color: '#fff3d6', opacity: 1, blending: THREE.AdditiveBlending });
  const spray = new THREE.Points(sprGeo, sprMat); spray.frustumCulled = false; scene.add(spray);

  /* cans */
  const canProfile = [[0, 0], [.2, 0], [.27, .02], [.31, .06], [.325, .12], [.325, 1.12], [.31, 1.2], [.27, 1.27], [.262, 1.3], [.27, 1.31], [.26, 1.32], [0, 1.31]].map(p => new THREE.Vector2(p[0], p[1]));
  const canShellGeo = new THREE.LatheGeometry(canProfile, 64);
  const canBodyGeo = new THREE.CylinderGeometry(.327, .327, 1.0, 96, 1, true, Math.PI, Math.PI * 2); canBodyGeo.translate(0, .62, 0);
  const metal = new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 1, roughness: .22 });
  const CANS = [
    { c1: '#c5161f', c2: '#5e0509', c3: '#ff5b3b' },
    { c1: '#6fae1f', c2: '#23430a', c3: '#c8ef62' }
  ];
  const cans = CANS.map(c => {
    const g = new THREE.Group();
    const tex = canvasTex(paintCan(c, wolf, LW, LW / 2), renderer);
    const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: .65, roughness: .3, normalMap: lowTier ? null : nrm, normalScale: new THREE.Vector2(.35, .35), envMapIntensity: 1.3 });
    g.add(new THREE.Mesh(canShellGeo, metal), new THREE.Mesh(canBodyGeo, mat));
    g.visible = false; scene.add(g); return g;
  });

  /* post */
  let composer = null, bloom = null;
  if (!lowTier) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .45, .5, .82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  let W = 1, H = 1, aspect = 1;
  function resize() {
    W = window.innerWidth; H = window.innerHeight; aspect = W / H;
    renderer.setSize(W, H, false);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    bgU.uRes.value.set(W * DPR, H * DPR);
    if (composer) { composer.setSize(W, H); composer.setPixelRatio(DPR); }
  }
  resize();

  const cTint = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();
  const tints = FLAVOURS.map(f => new THREE.Color(f.tint));
  const brights = FLAVOURS.map(f => new THREE.Color(f.c1));
  const heroTint = new THREE.Color('#3a2608');
  const lineTint = new THREE.Color('#2b1d0c');
  const canTintA = new THREE.Color('#5b0b0f'), canTintB = new THREE.Color('#2a4a0b');
  let lastBodyPair = [-1, -1];

  function visW(z) { return 2 * z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect; }

  // P = {hero, flav, line, mom, energy, end}
  function update(P, time) {
    const narrow = aspect < .8;
    const mid = aspect < 1.2;
    const h = P.hero, f = P.flav, l = P.line, m = P.mom, e = P.energy, z = P.end;
    bgU.uTime.value = time;

    /* --- flavour index --- */
    const q = clamp((f - .05) / .9) * 4;
    const qi = Math.min(3, Math.floor(q)), qf = q - qi;
    const mix = q >= 4 ? 1 : sstep(.5, .95, qf);
    const qEff = q >= 4 ? 4 : qi + mix;
    const fromI = q >= 4 ? 3 : qi, toI = Math.min(4, fromI + 1);
    const mixV = q >= 4 ? 1 : mix;

    /* --- main bottle --- */
    const fin = eio(seg(f, 0, .1));
    const fx = narrow ? 0 : (mid ? .55 : .95);
    let bx = lerp(0, fx, fin);
    let by = lerp(-.05, 0, h) + (narrow ? lerp(0, -.55, fin) : 0);
    let rot = -.5 + eio(h) * Math.PI * 2 + qEff * Math.PI * 2 + Math.sin(time * .6) * .08;
    let bs = narrow ? .9 : 1;
    // hero push-in
    let camZ = lerp(8.2, 6.9, sstep(0, .55, h)); let camY = 1.2; let camX = 0;
    camZ = lerp(camZ, 7.6, fin);
    if (narrow) camZ += 2.6;

    // lineup
    const L = eio(seg(l, 0, .55));
    const sp = narrow ? .78 : .95;
    const lineZ = Math.max(9.5, (sp * 4 + 1.2) / (2 * Math.tan(THREE.MathUtils.degToRad(14)) * aspect));
    camZ = lerp(camZ, lineZ, L);
    camY = lerp(camY, 1.85, L);
    const slots = [-2, -1, 0, 1, 2].map(i => i * sp);
    bx = lerp(bx, slots[4], L); by = lerp(by, 0, L);
    rot = lerp(rot, Math.PI * 8 + Math.sin(time * .6) * .08 - .25, L);

    // moments: group orbit + drift up
    const M = eio(seg(m, 0, 1));
    camY = lerp(camY, 1.9, M);
    // exit for energy
    const X = eio(seg(e, 0, .3));
    const groupY = -X * 5.5;

    main.position.set(bx, by + groupY, 0);
    main.rotation.set(0, rot, Math.sin(time * .5) * .02);
    main.scale.setScalar(bs);
    main.visible = groupY > -5.4;

    // labels
    const ud = main.userData;
    if (lastBodyPair[0] !== fromI || lastBodyPair[1] !== toI) {
      ud.bm.map = bodyTex[fromI]; ud.bm.userData.u.uMap2.value = bodyTex[toI];
      ud.nm.map = neckTex[fromI]; ud.nm.userData.u.uMap2.value = neckTex[toI];
      lastBodyPair = [fromI, toI];
    }
    const mixUse = f <= .0001 ? 0 : mixV;
    ud.bm.userData.u.uMix.value = mixUse; ud.nm.userData.u.uMix.value = mixUse;

    // cap pop (hero .5 -> .72), cap returns at flav start
    const pop = seg(h, .5, .74);
    const back = eout(seg(f, .02, .09));
    const cap = ud.cap;
    if (pop <= 0 || back >= 1) { cap.position.set(0, ud.capHome, 0); cap.rotation.set(0, 0, 0); cap.visible = true; }
    else {
      const k = pop * (1 - back);
      cap.position.set(k * .9, ud.capHome + k * 3.2 - k * k * 1.2, k * .6);
      cap.rotation.set(k * 9, k * 4, k * 6);
      cap.visible = true;
    }
    // spray
    const tau = seg(h, .52, .8) * (1 - sstep(.0, .05, f));
    const sprOn = tau > 0 && tau < 1;
    spray.visible = sprOn;
    if (sprOn) {
      const tt = tau * 1.4;
      main.updateMatrixWorld();
      const top = new THREE.Vector3(0, ud.capHome, 0).applyMatrix4(main.matrixWorld);
      for (let i = 0; i < sprN; i++) {
        const d = (i % 7) * .02; const t2 = Math.max(0, tt - d);
        sprPos[i * 3] = top.x + sprV[i * 3] * t2;
        sprPos[i * 3 + 1] = top.y + sprV[i * 3 + 1] * t2 - 3.2 * t2 * t2;
        sprPos[i * 3 + 2] = top.z + sprV[i * 3 + 2] * t2;
      }
      sprGeo.attributes.position.needsUpdate = true;
      sprMat.opacity = (1 - tau) * 1.1;
      bgU.uFlash.value = Math.max(0, 1 - tau * 4) * (tau > 0 ? 1 : 0);
    } else bgU.uFlash.value = 0;

    // bubbles
    const bubOn = h > .45 || f > 0;
    bubbles.visible = bubOn && main.visible;
    if (bubbles.visible) {
      for (let i = 0; i < bubN; i++) {
        const s0 = bubSeed[i * 3], s1 = bubSeed[i * 3 + 1], s2 = bubSeed[i * 3 + 2];
        const yy = .98 + ((s0 + time * (.08 + s1 * .12)) % 1) * .72;
        const r = Math.max(.02, radiusAt(yy) - .05) * Math.sqrt(s2);
        const a = s1 * 40 + time * .3;
        bubPos[i * 3] = Math.cos(a) * r * .8; bubPos[i * 3 + 1] = yy; bubPos[i * 3 + 2] = Math.abs(Math.sin(a)) * r * .9 + .02;
      }
      bubGeo.attributes.position.needsUpdate = true;
    }

    // lineup bottles
    line.forEach((b, i) => {
      const t = eout(seg(l, .08 + i * .07, .5 + i * .07));
      b.visible = t > 0 && groupY > -5.4;
      b.position.set(slots[i], lerp(-4.5, 0, t) + groupY, 0);
      b.rotation.set(0, lerp(Math.PI * 2, 0, t) - .25 + Math.sin(time * .6 + i) * .06, 0);
      b.scale.setScalar(bs);
    });
    // moments orbit look
    camX = lerp(0, Math.sin(M * Math.PI) * 1.2, M);

    // letters (hero)
    const lt = seg(h, .0, .55);
    letters.visible = lt < 1;
    const lw = Math.min(1, (visW(9.5) * .94) / totalW);
    letters.scale.setScalar(lw);
    letterMeshes.forEach((mm, i) => {
      const c = i - 3;
      mm.position.set(mm.userData.x * (1 + eio(lt) * .9), Math.sin(i * 1.7) * eio(lt) * .6, -eio(lt) * 3 * (1 + Math.abs(c) * .2));
      mm.material.opacity = (1 - sstep(.2, .9, lt)) * sstep(0, .02, 1);
    });
    letters.position.y = narrow ? 1.6 : 1.25;

    // tint
    if (f <= 0) cTint.copy(heroTint);
    else {
      cA.copy(tints[fromI]); cB.copy(tints[toI]); cTint.copy(cA).lerp(cB, mixV);
      cTint.lerp(heroTint, 1 - sstep(0, .08, f));
    }
    cTint.lerp(lineTint, L * .85);
    cA.copy(canTintA).lerp(canTintB, sstep(.55, .85, e));
    cTint.lerp(cA, sstep(.15, .4, e));
    bgU.uTint.value.copy(cTint);
    bgU.uRain.value = lerp(1, .4, sstep(0, .1, f)) + L * .25 + sstep(.1, .4, e) * .3;
    bgU.uDim.value = 1 - z * .55;

    // rim colour
    cB.copy(brights[fromI]).lerp(brights[toI], mixV);
    if (f <= 0) cB.set('#d6a843');
    rimR.color.copy(cB).lerp(new THREE.Color('#d6a843'), L * .6);
    rimR.position.set(bx + 2.4, 1.4, -1.4);
    rimL.position.set(bx - 2.2, 2.2, -1.6);

    // cans
    const C = eio(seg(e, .15, .55));
    const out = eio(seg(z, 0, .6));
    const cansX = lerp(4.5, narrow ? 0 : (mid ? .6 : 1.0), C);
    cans.forEach((c, i) => {
      c.visible = C > 0 && out < 1;
      const off = i === 0 ? -.28 : .38;
      c.position.set(cansX + off * (narrow ? .8 : 1), (i === 0 ? .25 : .05) + out * 5 + (narrow ? -.95 : 0), i === 0 ? .25 : -.45);
      c.rotation.set(i === 0 ? .08 : -.06, -1.2 + e * Math.PI * 2.4 + i * .9 + Math.sin(time * .7 + i) * .05, i === 0 ? -.16 : .12);
      c.scale.setScalar(narrow ? 1.05 : 1.25);
    });
    if (e > .15) { camZ = lerp(camZ, narrow ? 10.5 : 7.4, sstep(.15, .5, e)); camY = lerp(camY, .9, sstep(.15, .5, e)); camX = lerp(camX, 0, sstep(.15, .5, e)); }

    // pearls + ice orbit
    const pearlShow = 0;
    pearlMat.color.copy(cB);
    pearls.forEach((p, i) => {
      const u = p.userData; const a = u.a + time * u.sp;
      p.visible = pearlShow > .01;
      p.position.set(bx + Math.cos(a) * u.R * (narrow ? .7 : 1), u.y + Math.sin(time * .8 + u.ph) * .08 + by - (1 - pearlShow) * 3, Math.sin(a) * u.R * .7);
      p.scale.setScalar(u.s * pearlShow);
    });
    const iceShow = (1 - sstep(.55, .8, h) * (1 - sstep(.0, .1, f))) * (1 - sstep(.1, .5, l)) + sstep(.25, .5, e) * (1 - z);
    ices.forEach((c, i) => {
      const u = c.userData; const a = u.a + time * u.sp;
      const cx = e > .25 ? cansX : bx;
      c.visible = iceShow > .02;
      c.position.set(cx + Math.cos(a) * u.R * (narrow ? .7 : 1), u.y + Math.sin(time * .7 + u.ph) * .1 - .1, -.6 - Math.abs(Math.sin(a)) * u.R * .8);
      c.rotation.set(u.rx + time * .2, u.ry + time * .25, 0);
      c.scale.setScalar(u.s * clamp(iceShow));
    });

    camera.position.set(camX, camY + .05, camZ);
    camera.lookAt(camX * .4 + (narrow ? 0 : 0), camY - .02, 0);
  }

  function render() {
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  return { update, render, resize, renderer };
}
