// UNCEASE: "Inside the Bottle" — one continuous shot, driven by a single film progress t (0..1).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FLAVOURS, paintBody } from '../uncease/scene.js';

export { FLAVOURS };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (v, a, b) => clamp((v - a) / (b - a));
const sstep = (a, b, v) => { const t = seg(v, a, b); return t * t * (3 - 2 * t); };
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eout = t => 1 - Math.pow(1 - t, 3);
function rngFrom(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/* ---------- film timeline (t) ---------- */
export const T = {
  explode: [.035, .115], cutIn: .112, dive: [.112, .18], climb: [.18, .8], neck: [.8, .885], pop: [.885, .905], cutOut: .9, sky: [.905, 1]
};

/* ---------- the bottle, 20x scale, seen from inside ---------- */
const S = 20;
const PROFILE = [
  [0.0, 0.0], [0.27, 0.0], [0.322, 0.012], [0.341, 0.05], [0.346, 0.13], [0.346, 1.2],
  [0.342, 1.29], [0.326, 1.38], [0.285, 1.49], [0.228, 1.6], [0.172, 1.7], [0.143, 1.79],
  [0.134, 1.92], [0.129, 2.12], [0.13, 2.22], [0.146, 2.245], [0.153, 2.285], [0.147, 2.325],
  [0.12, 2.335], [0.0, 2.335]
];
const PTS = new THREE.SplineCurve(PROFILE.map(p => new THREE.Vector2(p[0] * .9 * S, p[1] * S))).getPoints(260);
function radiusAt(y) {
  let r = PTS[5].x;
  for (let i = 1; i < PTS.length; i++) {
    const a = PTS[i - 1], b = PTS[i];
    if (a.y > 1 && ((y >= a.y && y <= b.y) || (y <= a.y && y >= b.y)) && Math.abs(b.y - a.y) > 1e-6) { r = lerp(a.x, b.x, (y - a.y) / (b.y - a.y)); break; }
  }
  return r;
}
const Y_LIQ = 1.95 * S, Y_CAP = 2.33 * S, Y0 = 3, ZONE_H = 5.4;
const zoneY = k => Y0 + (k + .5) * ZONE_H;

function camY(t) {
  if (t < T.dive[0]) return 1;
  if (t < T.dive[1]) return lerp(.6, Y0, eout(seg(t, T.dive[0], T.dive[1])));
  if (t < T.climb[1]) return lerp(Y0, Y0 + ZONE_H * 5, seg(t, T.climb[0], T.climb[1]));
  if (t < T.neck[1]) return lerp(Y0 + ZONE_H * 5, Y_CAP - 3.2, eio(seg(t, T.neck[0], T.neck[1])));
  return lerp(Y_CAP - 3.2, Y_CAP - .6, eout(seg(t, T.pop[0], T.pop[1])));
}

/* ---------- shaders ---------- */
const NOISE = `
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
`;
const WALL_V = `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const WALL_F = `
uniform float uTime, uFogD; uniform vec3 uTint, uFog, uLight;
varying vec3 vW;
float caus(vec2 p){ float v = 0.; for(int k=0;k<3;k++){ p = p*1.6 + vec2(sin(p.y*1.3 + uTime*.45), cos(p.x*1.1 - uTime*.38)); v += abs(sin(p.x)+sin(p.y))*.5; } return pow(1. - clamp(v/3., 0., 1.), 3.5); }
void main(){
  float ang = atan(vW.z, vW.x);
  float y = vW.y;
  float c = caus(vec2(ang*5., y*.45));
  vec3 col = uTint*.3 + uLight*c*.28;
  float st = pow(max(0., sin(ang*2. + 1.3)), 60.)*.9 + pow(max(0., sin(ang*5. + 2.)), 120.)*.5;
  col += vec3(1., .88, .66)*st*.16;
  // ribs of light near the top (neck), the exit
  col += uLight*smoothstep(${(1.75 * S).toFixed(1)}, ${(2.33 * S).toFixed(1)}, y)*.45;
  float d = length(vW - cameraPosition);
  float f = 1. - exp(-uFogD*uFogD*d*d);
  col = mix(col, uFog, f);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
const BUB_V = `
attribute vec4 aData; attribute vec2 aSp;
uniform float uTime, uCamY, uLiq;
varying vec3 vN; varying vec3 vV; varying float vFog; varying float vA;
uniform float uFogD;
void main(){
  float span = 46.;
  float y = mod(aData.y + uTime*aSp.x - uCamY + span*.5, span) + uCamY - span*.5;
  vec3 c = vec3(aData.x + sin(uTime*2. + aSp.y)*.06, y, aData.z + cos(uTime*1.7 + aSp.y)*.06);
  float s = aData.w * (1. + .08*sin(uTime*6. + aSp.y));
  vec3 p = position*s + c;
  vec4 w = modelMatrix*vec4(p, 1.);
  vN = normalize(normal); vV = normalize(cameraPosition - w.xyz);
  float d = length(cameraPosition - w.xyz);
  vFog = 1. - exp(-uFogD*uFogD*d*d);
  vA = step(y, uLiq - .15);
  gl_Position = projectionMatrix*viewMatrix*w;
}`;
const BUB_F = `
uniform vec3 uTint, uFog;
varying vec3 vN; varying vec3 vV; varying float vFog; varying float vA;
void main(){
  if (vA < .5) discard;
  float fr = pow(1. - abs(dot(vN, vV)), 2.2);
  vec3 col = mix(uTint*1.4, vec3(1., .97, .9), fr);
  float spec = pow(max(0., dot(reflect(-vV, vN), normalize(vec3(.3, 1., .4)))), 40.);
  col += spec*1.6;
  float a = clamp(fr*.95 + spec, 0., 1.)*(1. - vFog);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;
const WOLF_V = `
attribute vec3 aStart; attribute vec3 aCol; attribute vec4 aR;
uniform float uAssemble, uExplode, uTime, uSize, uGold;
varying vec3 vC; varying float vA;
void main(){
  float d = aR.x*.45;
  float a = clamp((uAssemble - d)/.55, 0., 1.);
  a = 1. - pow(1. - a, 3.);
  vec3 p = mix(aStart, position, a);
  p.x += sin(uTime*1.3 + aR.y*6.28)*.012*a; p.y += cos(uTime*1.1 + aR.z*6.28)*.012*a;
  vec3 dir = normalize(vec3(position.xy*.6, 0.) + (aR.xyz - .5)*1.4 + vec3(0., 0., 1.8));
  float e = uExplode*uExplode;
  p += dir*e*(5. + aR.w*12.);
  p.y += e*aR.y*3.;
  vec4 mv = modelViewMatrix*vec4(p, 1.);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = uSize*(.55 + aR.w*.9)*(1. + uExplode*2.2)/-mv.z;
  vC = mix(aCol, vec3(1., .78, .36)*1.4, uGold*(1. - step(1.5, aCol.r - aCol.g)));
  vA = smoothstep(0., .35, a + .02) * (1. - smoothstep(.55, 1., uExplode));
}`;
const WOLF_F = `
varying vec3 vC; varying float vA;
void main(){
  vec2 q = gl_PointCoord - .5; float r = length(q);
  float m = smoothstep(.5, .18, r);
  if (m*vA < .01) discard;
  gl_FragColor = vec4(vC, m*vA);
  #include <colorspace_fragment>
}`;
const SKY_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, .9999, 1.); }`;
const SKY_F = `
precision highp float;
varying vec2 vUv; uniform float uTime, uSky, uGlow; uniform vec2 uRes;
${NOISE}
void main(){
  vec2 uv = vUv; float asp = uRes.x/uRes.y; float x = (uv.x - .5)*asp;
  vec3 col = mix(vec3(.30,.12,.05), vec3(.06,.035,.09), smoothstep(0., .38, uv.y));
  col = mix(col, vec3(.008,.01,.03), smoothstep(.3, 1., uv.y));
  col = mix(vec3(.004,.004,.006) + col*.12, col, uSky);
  // stars
  vec2 sp = uv*vec2(asp, 1.)*80.; vec2 id = floor(sp); vec2 gv = fract(sp) - .5; float r = h21(id);
  vec2 o = (vec2(h21(id + 1.7), h21(id + 2.9)) - .5)*.6;
  float star = step(.982, r)*smoothstep(.09, .0, length(gv - o))*(.55 + .45*sin(uTime*1.7 + r*60.));
  col += star*smoothstep(.2, .7, uv.y)*(.35 + .65*uSky);
  // skyline: blocks + Qutub Minar + India Gate
  float bx = floor(x*16.);
  float bh = .05 + .085*pow(h21(vec2(bx, 1.3)), 2.) + .02*h21(vec2(floor(x*60.), 4.1));
  float b = step(uv.y, bh);
  float xq = .3*asp; float yq = uv.y;
  float wq = mix(.024, .009, clamp(yq/.4, 0., 1.));
  float q = step(abs(x - xq), wq)*step(yq, .4);
  q = max(q, step(abs(x - xq), wq + .007)*(step(abs(yq - .13), .005) + step(abs(yq - .23), .005) + step(abs(yq - .31), .005)));
  q = max(q, step(length(vec2(x - xq, (yq - .405)*1.4)), .011));
  float gx = x + .27*asp;
  float gate = step(abs(gx), .075)*step(uv.y, .17);
  float hole = clamp(step(length(vec2(gx, (uv.y - .085)*.9)), .034) + step(abs(gx), .034)*step(uv.y, .085), 0., 1.);
  gate = max(gate*(1. - hole), step(abs(gx), .058)*step(abs(uv.y - .18), .012));
  gate = max(gate, step(abs(gx), .03)*step(abs(uv.y - .2), .01));
  float sil = clamp(b + q + gate, 0., 1.)*uSky;
  vec2 wg = vec2(x*110., uv.y*150.);
  float win = step(.86, h21(floor(wg)))*step(.25, fract(wg.x))*step(.35, fract(wg.y))*b*(1. - q)*(1. - gate)*(.6 + .4*sin(uTime*.5 + h21(floor(wg))*30.));
  col = mix(col, vec3(.012, .01, .016) + vec3(1., .72, .36)*win*.75, sil);
  col += vec3(.95, .45, .15)*exp(-uv.y*8.)*.22*uSky;
  col += vec3(1., .85, .6)*uGlow;
  vec2 v = uv - .5; col *= 1. - dot(v, v)*.9;
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
const SURF_F = `
uniform float uTime, uOp; varying vec2 vUv;
void main(){
  vec2 p = vUv - .5; float r = length(p);
  float w = sin(r*80. - uTime*3.)*.5 + .5; w = pow(w, 6.);
  float edge = smoothstep(.5, .3, r);
  vec3 col = mix(vec3(1., .82, .55), vec3(1.), w)*(.55 + w*.8);
  gl_FragColor = vec4(col, edge*uOp*(.45 + w*.4));
  #include <colorspace_fragment>
}`;

/* ---------- fruit geometry ---------- */
function wedge(rad, ang, depth) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.absarc(0, 0, rad, -ang, ang, false); s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 3, curveSegments: 24 });
  g.translate(-rad * .5, 0, -depth / 2); return g;
}

export async function createFilm(canvas, opts = {}) {
  const low = !!opts.low;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
  const DPR = Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(52, 1, .05, 200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;

  await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('700 40px Cinzel'), document.fonts.load('italic 600 26px Cinzel')]).catch(() => {});
  const wolfImg = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = opts.wolf; });

  /* ================= SKY scene (intro + outro) ================= */
  const sky = new THREE.Scene();
  const skyU = { uTime: { value: 0 }, uSky: { value: 0 }, uGlow: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
  const skyBg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, uniforms: skyU, depthWrite: false, depthTest: false }));
  skyBg.frustumCulled = false; skyBg.renderOrder = -10; sky.add(skyBg);

  // particle wolf, sampled from the real logo
  const wolfGeo = (() => {
    const step = low ? 5 : 3;
    const cv = document.createElement('canvas'); cv.width = wolfImg.width; cv.height = wolfImg.height;
    const x = cv.getContext('2d'); x.drawImage(wolfImg, 0, 0); const d = x.getImageData(0, 0, cv.width, cv.height).data;
    const pos = [], st = [], col = [], rr = []; const r = rngFrom(9); const H = 3.7, W = H * cv.width / cv.height; const c = new THREE.Color();
    for (let py = 0; py < cv.height; py += step) for (let px = 0; px < cv.width; px += step) {
      const o = (py * cv.width + px) * 4; if (d[o + 3] < 140) continue;
      const R = d[o] / 255, G = d[o + 1] / 255, B = d[o + 2] / 255;
      const lum = R * .3 + G * .59 + B * .11;
      pos.push((px / cv.width - .5) * W + (r() - .5) * .02, (.5 - py / cv.height) * H + (r() - .5) * .02, (lum - .4) * .25 + (r() - .5) * .06);
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rad = 5 + r() * 7;
      st.push(Math.sin(ph) * Math.cos(th) * rad, Math.sin(ph) * Math.sin(th) * rad * .7, Math.cos(ph) * rad * .6 - 2);
      c.setRGB(R, G, B, THREE.SRGBColorSpace);
      const eye = R > .55 && G < .3 && B < .3;
      if (eye) c.multiplyScalar(4.5); else c.multiplyScalar(.62);
      col.push(c.r, c.g, c.b); rr.push(r(), r(), r(), r());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aStart', new THREE.Float32BufferAttribute(st, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aR', new THREE.Float32BufferAttribute(rr, 4));
    return g;
  })();
  const wolfU = { uAssemble: { value: 0 }, uExplode: { value: 0 }, uTime: { value: 0 }, uSize: { value: low ? 70 : 52 }, uGold: { value: 0 } };
  const wolf = new THREE.Points(wolfGeo, new THREE.ShaderMaterial({ vertexShader: WOLF_V, fragmentShader: WOLF_F, uniforms: wolfU, transparent: true, depthWrite: false, blending: THREE.NormalBlending }));
  wolf.frustumCulled = false; sky.add(wolf);

  // fireworks
  const FW_B = low ? 5 : 8, FW_N = low ? 110 : 160;
  const fwPos = new Float32Array(FW_B * FW_N * 3), fwCol = new Float32Array(FW_B * FW_N * 3), fwDir = new Float32Array(FW_B * FW_N * 3);
  const fwBursts = []; { const r = rngFrom(77); const cols = ['#ffd27a', ...FLAVOURS.map(f => f.c3), '#ffffff', '#f6dc8a'];
    for (let b = 0; b < FW_B; b++) {
      fwBursts.push({ o: new THREE.Vector3((r() - .5) * 14, 2.6 + r() * 3.4, -5 - r() * 5), t0: .02 + b * (.62 / FW_B) + r() * .04, sp: 1.8 + r() * 1.4 });
      const c = new THREE.Color(cols[b % cols.length]).multiplyScalar(2.2);
      for (let i = 0; i < FW_N; i++) {
        const k = (b * FW_N + i) * 3; const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), m = .75 + r() * .25;
        fwDir[k] = Math.sin(ph) * Math.cos(th) * m; fwDir[k + 1] = Math.cos(ph) * m; fwDir[k + 2] = Math.sin(ph) * Math.sin(th) * m;
        fwCol[k] = c.r; fwCol[k + 1] = c.g; fwCol[k + 2] = c.b;
      }
    } }
  const fwGeo = new THREE.BufferGeometry();
  fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3)); fwGeo.setAttribute('color', new THREE.BufferAttribute(fwCol, 3));
  const spark = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  const fwBase = fwCol.slice();
  const fwMat = new THREE.PointsMaterial({ size: .13, map: spark, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1 });
  const fireworks = new THREE.Points(fwGeo, fwMat); fireworks.frustumCulled = false; sky.add(fireworks);
  const trPos = new Float32Array(FW_B * FW_N * 6), trCol = new Float32Array(FW_B * FW_N * 6);
  const trGeo = new THREE.BufferGeometry(); trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3)); trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3));
  const trails = new THREE.LineSegments(trGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  trails.frustumCulled = false; sky.add(trails);

  /* ================= LIQUID scene (inside the bottle) ================= */
  const liq = new THREE.Scene();
  liq.environment = env;
  const fogCol = new THREE.Color('#1a0b04');
  liq.background = fogCol; liq.fog = new THREE.FogExp2(fogCol, .06);
  const hemi = new THREE.HemisphereLight('#ffcf8a', '#1a0804', 1.4); liq.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.6); sun.position.set(.3, 1, .2); liq.add(sun);
  const headLamp = new THREE.PointLight('#fff0d8', 18, 14, 1.6); liq.add(headLamp);

  const wallU = { uTime: { value: 0 }, uFogD: { value: .06 }, uTint: { value: new THREE.Color() }, uFog: { value: fogCol }, uLight: { value: new THREE.Color('#ffc46b') } };
  const wall = new THREE.Mesh(new THREE.LatheGeometry(PTS, low ? 64 : 128), new THREE.ShaderMaterial({ vertexShader: WALL_V, fragmentShader: WALL_F, uniforms: wallU, side: THREE.BackSide }));
  liq.add(wall);

  // label bands, one per flavour, readable from inside
  const LW = low ? 1024 : 2048;
  const camAng = y => y * .07;
  const labels = FLAVOURS.map((f, k) => {
    const cv = paintBody(f, wolfImg, 'c', LW, LW * 960 / 2048);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1;
    const yc = zoneY(k), h = 4.2, phiLen = (h * 2048 / 960) / radiusAt(yc);
    const pts = []; for (let i = 0; i <= 24; i++) { const y = yc - h / 2 + h * i / 24; pts.push(new THREE.Vector2(radiusAt(y) - .06, y)); }
    const look = camAng(yc) + Math.PI; const phi = Math.PI / 2 - look;
    const g = new THREE.LatheGeometry(pts, 64, phi - phiLen / 2, phiLen);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, color: new THREE.Color(.78, .74, .7), fog: true }));
    liq.add(m); return m;
  });

  // bubbles (GPU-driven)
  const BN = low ? 380 : 1100;
  const bubGeo = new THREE.InstancedBufferGeometry().copy(new THREE.SphereGeometry(1, 18, 12));
  { const a = new Float32Array(BN * 4), sp = new Float32Array(BN * 2); const r = rngFrom(5);
    for (let i = 0; i < BN; i++) {
      const th = r() * Math.PI * 2; let rad = Math.sqrt(r()) * 5.2; if (rad > 1.5 && rad < 3.3) rad = 3.3 + (rad - 1.5) * .9;
      a[i * 4] = Math.cos(th) * rad; a[i * 4 + 1] = r() * 46; a[i * 4 + 2] = Math.sin(th) * rad;
      a[i * 4 + 3] = .02 + Math.pow(r(), 3) * .13;
      sp[i * 2] = .8 + r() * 1.8 + a[i * 4 + 3] * 6; sp[i * 2 + 1] = r() * 6.28;
    }
    bubGeo.setAttribute('aData', new THREE.InstancedBufferAttribute(a, 4)); bubGeo.setAttribute('aSp', new THREE.InstancedBufferAttribute(sp, 2));
    bubGeo.instanceCount = BN; }
  const bubU = { uTime: { value: 0 }, uCamY: { value: 0 }, uLiq: { value: Y_LIQ }, uFogD: { value: .06 }, uTint: { value: new THREE.Color() }, uFog: { value: fogCol } };
  const bubbles = new THREE.Mesh(bubGeo, new THREE.ShaderMaterial({ vertexShader: BUB_V, fragmentShader: BUB_F, uniforms: bubU, transparent: true, depthWrite: false }));
  bubbles.frustumCulled = false; liq.add(bubbles);

  // god rays
  const rayTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 256); x.globalCompositeOperation = 'destination-in';
    const v = x.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = v; x.fillRect(0, 0, 64, 256);
    return new THREE.CanvasTexture(c); })();
  const rays = new THREE.Group(); liq.add(rays);
  { const r = rngFrom(3); for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.8 + r() * 1.6, 34), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color('#ffcf8a'), opacity: .07 + r() * .07, fog: false }));
    const th = r() * Math.PI * 2, rad = .5 + r() * 4; m.userData = { x: Math.cos(th) * rad, z: Math.sin(th) * rad, tilt: (r() - .5) * .25, ph: r() * 6 };
    rays.add(m); } }

  // micro specks
  const SPN = low ? 1200 : 3200;
  const spGeo = new THREE.BufferGeometry(); { const p = new Float32Array(SPN * 3); const r = rngFrom(12);
    for (let i = 0; i < SPN; i++) { const th = r() * 6.283, rad = Math.sqrt(r()) * 5.8; p[i * 3] = Math.cos(th) * rad; p[i * 3 + 1] = r() * Y_LIQ; p[i * 3 + 2] = Math.sin(th) * rad; }
    spGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); }
  const specks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: .035, map: spark, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffd9a0', opacity: .6 }));
  liq.add(specks);

  // fruit, one kind per zone
  const blueberry = mergeGeometries([new THREE.SphereGeometry(.24, 24, 16), new THREE.CylinderGeometry(.1, .05, .07, 5).translate(0, .235, 0)]);
  const cran = new THREE.SphereGeometry(.21, 24, 16).scale(1, .9, 1);
  const peach = wedge(.6, .36, .16), apple = wedge(.66, .5, .16), gem = new THREE.OctahedronGeometry(.17, 0);
  const mats = {
    blue: new THREE.MeshPhysicalMaterial({ color: '#2c3a8c', roughness: .55, sheen: 1, sheenColor: new THREE.Color('#a9b6ef'), sheenRoughness: .5 }),
    cran: new THREE.MeshPhysicalMaterial({ color: '#a8101c', roughness: .22, clearcoat: 1, clearcoatRoughness: .1 }),
    peachFlesh: new THREE.MeshStandardMaterial({ color: '#ffae5c', roughness: .45 }), peachSkin: new THREE.MeshStandardMaterial({ color: '#e04a22', roughness: .5 }),
    appleFlesh: new THREE.MeshStandardMaterial({ color: '#f3eec2', roughness: .4 }), appleSkin: new THREE.MeshStandardMaterial({ color: '#5fa524', roughness: .35 }),
    gem: new THREE.MeshPhysicalMaterial({ color: '#ff4fb0', roughness: .1, metalness: .3, clearcoat: 1, emissive: '#5a0630', emissiveIntensity: .6 })
  };
  const fruitDefs = [[blueberry, mats.blue], [cran, mats.cran], [peach, [mats.peachFlesh, mats.peachSkin]], [apple, [mats.appleFlesh, mats.appleSkin]], [gem, mats.gem]];
  const FN = low ? 10 : 18;
  const fruits = fruitDefs.map(([g, m], k) => {
    const im = new THREE.InstancedMesh(g, m, FN); const r = rngFrom(100 + k); const data = [];
    for (let i = 0; i < FN; i++) {
      const inner = r() < .25; const yc = zoneY(k) + (r() - .5) * ZONE_H * .9;
      const rad = inner ? r() * 1.1 : 3.3 + r() * Math.max(.3, radiusAt(yc) - 4.2);
      const th = r() * 6.283;
      data.push({ x: Math.cos(th) * rad, y: yc, z: Math.sin(th) * rad, rx: r() * 6, ry: r() * 6, sp: .2 + r() * .5, s: .8 + r() * .7 });
    }
    im.userData.data = data; im.frustumCulled = false; liq.add(im); return im;
  });

  // liquid surface + cap
  const nr = radiusAt(Y_LIQ);
  const surfU = { uTime: { value: 0 }, uOp: { value: 1 } };
  const surface = new THREE.Mesh(new THREE.CircleGeometry(nr - .02, 64), new THREE.ShaderMaterial({ vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`, fragmentShader: SURF_F, uniforms: surfU, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  surface.rotation.x = -Math.PI / 2; surface.position.y = Y_LIQ; liq.add(surface);
  const cap = new THREE.Group();
  { const cr = radiusAt(Y_CAP - .3) + .5;
    const under = new THREE.Mesh(new THREE.CircleGeometry(cr, 48), new THREE.MeshStandardMaterial({ color: '#d9d9de', metalness: .9, roughness: .35, side: THREE.DoubleSide }));
    under.rotation.x = Math.PI / 2;
    const liner = new THREE.Mesh(new THREE.CircleGeometry(cr * .82, 48), new THREE.MeshStandardMaterial({ color: '#b0121b', metalness: .3, roughness: .5, side: THREE.DoubleSide }));
    liner.rotation.x = Math.PI / 2; liner.position.y = -.01;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(cr, cr * 1.05, .9, 42, 1, true), new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 1, roughness: .25, side: THREE.DoubleSide }));
    skirt.position.y = -.45;
    cap.add(under, liner, skirt); cap.position.y = Y_CAP + .05; liq.add(cap); }

  /* ================= post ================= */
  let composer = null, rp = null, bloom = null;
  if (!low) {
    composer = new EffectComposer(renderer);
    rp = new RenderPass(sky, camera); composer.addPass(rp);
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .7, .45, .72); composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  let aspect = 1;
  function resize() {
    const W = innerWidth, H = innerHeight; aspect = W / H;
    renderer.setSize(W, H, false); camera.aspect = aspect; camera.updateProjectionMatrix();
    skyU.uRes.value.set(W * DPR, H * DPR);
    if (composer) { composer.setSize(W, H); composer.setPixelRatio(DPR); }
  }
  resize();

  const tints = FLAVOURS.map(f => new THREE.Color(f.c2).lerp(new THREE.Color('#2a1206'), .35));
  const lights = FLAVOURS.map(f => new THREE.Color(f.c3).lerp(new THREE.Color('#ffc46b'), .45));
  const tmpC = new THREE.Color(), tmpL = new THREE.Color(), dummy = new THREE.Object3D();
  let active = sky;

  // P: { t, intro, mx, my, time }
  function update(P) {
    const { t, intro = 1, mx = 0, my = 0, time } = P;
    const narrow = aspect < .8;
    skyU.uTime.value = time; wolfU.uTime.value = time; wallU.uTime.value = time; bubU.uTime.value = time; surfU.uTime.value = time;
    const out = { scene: 'sky', zone: 0, zoneF: 0, y: 0, popped: t >= T.pop[0] + .006, liquid: false };

    if (t < T.cutIn || t >= T.cutOut) {
      active = sky;
      const outro = t >= T.cutOut;
      const u = outro ? seg(t, T.sky[0], 1) : 0;
      skyU.uSky.value = outro ? sstep(0, .25, u) : 0;
      skyU.uGlow.value = outro ? (1 - sstep(0, .15, u)) * .6 : 0;
      wolf.visible = true;
      if (!outro) {
        wolfU.uAssemble.value = intro; wolfU.uExplode.value = eio(seg(t, T.explode[0], T.explode[1])); wolfU.uGold.value = 0;
        wolf.position.set(0, narrow ? 1.25 : 1.0, 0);
        if (bloom) bloom.strength = .3;
        const push = eio(seg(t, T.explode[0], T.explode[1]));
        camera.position.set(mx * .35, my * .2 + .1, lerp(narrow ? 12.5 : 10, 2.5, push));
        camera.lookAt(0, .25, 0);
        fireworks.visible = false; trails.visible = false;
      } else {
        wolfU.uAssemble.value = eio(seg(u, .3, .82)); wolfU.uExplode.value = 0; wolfU.uGold.value = .3;
        wolf.position.set(0, narrow ? 1.9 : 1.75, -1.5); wolf.scale.setScalar(narrow ? .7 : .78);
        if (bloom) bloom.strength = .35;
        camera.position.set(mx * .4, .9 + my * .2, narrow ? 12.5 : 9.5); camera.lookAt(0, 1.4, -1);
        fireworks.visible = true; trails.visible = true;
        let k = 0;
        fwBursts.forEach((b, bi) => {
          const tau = (u - b.t0) / .24;
          for (let i = 0; i < FW_N; i++, k += 3) {
            const k2 = k * 2;
            if (tau <= 0 || tau >= 1) { fwPos[k] = 0; fwPos[k + 1] = -99; fwPos[k + 2] = 0; for (let j = 0; j < 6; j++) { trPos[k2 + j] = 0; trCol[k2 + j] = 0; } continue; }
            const fade = Math.pow(1 - tau, 1.6) * (.7 + .3 * Math.sin(time * 25 + i));
            fwCol[k] = fwBase[k] * fade; fwCol[k + 1] = fwBase[k + 1] * fade; fwCol[k + 2] = fwBase[k + 2] * fade;
            const e = eout(tau) * b.sp * 1.6;
            fwPos[k] = b.o.x + fwDir[k] * e; fwPos[k + 1] = b.o.y + fwDir[k + 1] * e - tau * tau * 1.3; fwPos[k + 2] = b.o.z + fwDir[k + 2] * e;
            const tb = Math.max(0, tau - .12), eb = eout(tb) * b.sp * 1.6;
            trPos[k2] = fwPos[k]; trPos[k2 + 1] = fwPos[k + 1]; trPos[k2 + 2] = fwPos[k + 2];
            trPos[k2 + 3] = b.o.x + fwDir[k] * eb; trPos[k2 + 4] = b.o.y + fwDir[k + 1] * eb - tb * tb * 1.3; trPos[k2 + 5] = b.o.z + fwDir[k + 2] * eb;
            trCol[k2] = fwCol[k] * .7; trCol[k2 + 1] = fwCol[k + 1] * .7; trCol[k2 + 2] = fwCol[k + 2] * .7; trCol[k2 + 3] = 0; trCol[k2 + 4] = 0; trCol[k2 + 5] = 0;
          }
        });
        fwGeo.attributes.position.needsUpdate = true; fwGeo.attributes.color.needsUpdate = true; trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
      }
      if (!outro) wolf.scale.setScalar(1);
      out.scene = outro ? 'outro' : 'intro';
    } else {
      active = liq; out.liquid = true;
      const y = camY(t);
      const z = clamp((y - Y0) / ZONE_H - .5, 0, 4);
      const zi = Math.min(3, Math.floor(z)), zf = z - zi;
      const m = sstep(.25, .75, zf);
      out.zone = Math.round(clamp((y - Y0) / ZONE_H - .5 + .5, 0, 4.4)) ; out.zoneF = (y - Y0) / ZONE_H; out.y = y;
      tmpC.copy(tints[zi]).lerp(tints[Math.min(4, zi + 1)], m);
      tmpL.copy(lights[zi]).lerp(lights[Math.min(4, zi + 1)], m);
      // above the surface the world turns to warm air, near the cap it brightens
      const air = sstep(Y_LIQ - .3, Y_LIQ + .6, y);
      const nearTop = sstep(Y_LIQ, Y_CAP - .5, y);
      fogCol.copy(tmpC).lerp(new THREE.Color('#4a2e14'), air * .6).lerp(new THREE.Color('#a8722e'), nearTop * .35);
      const dive = sstep(T.dive[0], T.dive[1], t);
      const fd = lerp(.14, .075, dive) * (1 - air * .45);
      liq.fog.density = fd; wallU.uFogD.value = fd; bubU.uFogD.value = fd;
      wallU.uTint.value.copy(tmpC).multiplyScalar(1.6); wallU.uLight.value.copy(tmpL);
      bubU.uTint.value.copy(tmpL); bubU.uCamY.value = y;
      hemi.color.copy(tmpL); sun.color.copy(tmpL).lerp(new THREE.Color('#ffffff'), .4);

      // camera on a slow spiral
      const ang = camAng(y);
      const rc = Math.min(2.4, radiusAt(y) * .42);
      const shakeK = sstep(T.pop[0], T.pop[1], t) * (1 - sstep(T.pop[1] - .004, T.pop[1], t));
      const sh = shakeK * .25;
      camera.position.set(Math.cos(ang) * rc + mx * .25 + Math.sin(time * 40) * sh, y + my * .15 + Math.cos(time * 37) * sh, Math.sin(ang) * rc);
      const ty = Math.min(Y_CAP + 2, y + 9), tr = Math.min(3, radiusAt(Math.min(ty, Y_CAP - .3)) * .5);
      const lookUp = sstep(T.neck[0] + .02, T.neck[1], t);
      camera.lookAt(lerp(-Math.cos(ang) * tr, 0, lookUp), lerp(ty, y + 20, lookUp), lerp(-Math.sin(ang) * tr, 0, lookUp));
      headLamp.position.set(camera.position.x, y + 1.5, camera.position.z);

      rays.position.set(0, y + 13, 0);
      rays.children.forEach((r, i) => { const u = r.userData; r.position.set(u.x + Math.sin(time * .2 + u.ph) * .3, 0, u.z); r.lookAt(camera.position.x, r.position.y + rays.position.y, camera.position.z); r.rotation.z += u.tilt; r.material.opacity = (.05 + .06 * (.5 + .5 * Math.sin(time * .4 + u.ph))) * (1 - air); });

      // fruit
      fruits.forEach((im, k) => {
        const vis = Math.abs(zoneY(k) - y) < 16; im.visible = vis; if (!vis) return;
        im.userData.data.forEach((d, i) => {
          dummy.position.set(d.x + Math.sin(time * d.sp + i) * .15, d.y + Math.sin(time * d.sp * .7 + i) * .25, d.z);
          dummy.rotation.set(d.rx + time * d.sp, d.ry + time * d.sp * .8, 0); dummy.scale.setScalar(d.s);
          dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
        });
        im.instanceMatrix.needsUpdate = true;
      });
      specks.visible = y < Y_LIQ + .5;
      surfU.uOp.value = (1 - sstep(Y_LIQ + 1, Y_LIQ + 4, y) * .7) * (.25 + .75 * sstep(.4, 4, Math.abs(y - Y_LIQ)));

      // cap pops off
      const pk = eout(seg(t, T.pop[0] + .006, T.pop[1]));
      cap.position.set(pk * 2, Y_CAP + .05 + pk * 14, pk * -1); cap.rotation.set(pk * 3, pk * 2, pk * 4);
      wallU.uLight.value.lerp(new THREE.Color('#ffffff'), pk * .6);
      if (bloom) bloom.strength = .5;
      out.scene = 'liquid';
    }
    return out;
  }

  function render() {
    if (composer) { rp.scene = active; composer.render(); }
    else renderer.render(active, camera);
  }
  return { update, render, resize, renderer, zoneY, ZONE_H, Y0 };
}
