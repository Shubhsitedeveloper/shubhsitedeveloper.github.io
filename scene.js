/* Shubhsitedeveloper — "The Projection Room" hero scene (three.js r160)
   A projector beam from the dark throws our client work onto a curved cinema screen.
   Exposes window.__hero = { progress(p), intro(v), ready } */
import * as THREE from 'three';
import { EffectComposer } from './assets/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './assets/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './assets/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './assets/three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('stage');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => innerWidth < 820;
const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || isSmall();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance' });
renderer.setClearColor(0x0b0a09, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b0a09, 0.035);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

/* ---------- textures: slides for the screen ---------- */
const loader = new THREE.TextureLoader();
const titleCard = (() => {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(800, 450, 50, 800, 450, 900);
  grd.addColorStop(0, '#2a120a'); grd.addColorStop(1, '#070605');
  g.fillStyle = grd; g.fillRect(0, 0, 1600, 900);
  g.strokeStyle = 'rgba(239,233,223,.35)'; g.lineWidth = 3;
  g.beginPath(); g.arc(800, 450, 300, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(800, 450, 240, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(0, 450); g.lineTo(1600, 450); g.moveTo(800, 0); g.lineTo(800, 900); g.stroke();
  g.fillStyle = '#efe9df'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 120px Syne, sans-serif'; g.fillText('SHUBH', 800, 380);
  g.fillStyle = '#ff4d1a'; g.fillText('SITE', 800, 500);
  g.fillStyle = 'rgba(239,233,223,.7)'; g.font = '500 34px "JetBrains Mono", monospace';
  g.fillText('P R E S E N T S', 800, 640);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const slideSrc = ['assets/work/wash-hero.jpg', 'assets/work/sphere-hero.jpg', 'assets/work/film3d.jpg'];
const slideNames = ['Shubhsitedeveloper presents', 'Quick Wash Motors', 'Shaikh’s Sphere Enterprises', 'The 3D wash film'];
const slides = [titleCard];
slideSrc.forEach(src => {
  const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; slides.push(t);
});

/* ---------- curved screen ---------- */
const SW = 6.4, SH = 3.6;
const screenGeo = new THREE.PlaneGeometry(SW, SH, 64, 1);
const screenMat = new THREE.ShaderMaterial({
  uniforms: {
    tA: { value: slides[0] }, tB: { value: slides[1] }, uMix: { value: 0 }, uTime: { value: 0 },
    uOn: { value: 0 }, uCurve: { value: 0.09 }
  },
  vertexShader: /* glsl */`
    uniform float uCurve; varying vec2 vUv; varying float vZ;
    void main(){ vUv = uv; vec3 p = position; p.z = -uCurve * p.x * p.x; vZ = p.z;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tA, tB; uniform float uMix, uTime, uOn; varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.1;a*=.5;}return v;}
    vec3 cover(sampler2D t, vec2 uv){ return texture2D(t, uv).rgb; }
    void main(){
      vec2 uv = vUv;
      /* gate weave: the film jitters slightly like a real projector */
      uv += vec2(n(vec2(uTime*7.,0.))-.5, n(vec2(0.,uTime*6.))-.5) * .0025;
      vec3 a = cover(tA, uv), b = cover(tB, uv);
      /* film-burn transition */
      float burn = fbm(uv*vec2(3.,2.) + uTime*.05);
      float edge = uMix*1.25 - .1;
      float m = smoothstep(edge-.06, edge, burn*1.0 + (1.-uv.y)*.05);
      m = 1. - m;
      float ring = smoothstep(edge-.09, edge-.03, burn) - smoothstep(edge-.03, edge, burn);
      vec3 col = mix(a, b, m);
      col += vec3(1.,.45,.12) * ring * 3.0 * step(.001,uMix) * step(uMix,.999);
      /* projected-light falloff + flicker */
      float d = length((vUv-.5)*vec2(1.,1.25));
      col *= 1.32 - d*.95;
      col *= .93 + .07*n(vec2(uTime*14.,3.));
      /* scratches + dust specks */
      float sx = step(.997, h(vec2(floor(vUv.x*400.), floor(uTime*24.))));
      col += sx*.12;
      float dust = step(.9993, h(floor(vUv*vec2(260.,150.)) + floor(uTime*24.)));
      col = mix(col, vec3(0.), dust*.8);
      col *= uOn;
      gl_FragColor = vec4(col, 1.);
    }`
});
const screen = new THREE.Mesh(screenGeo, screenMat);
const screenGroup = new THREE.Group();
screenGroup.add(screen);
/* frame / border glow behind screen */
const frameMat = new THREE.MeshBasicMaterial({ color: 0x120c09 });
const frame = new THREE.Mesh(new THREE.PlaneGeometry(SW + .28, SH + .28, 64, 1), frameMat);
{ const p = frame.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -0.09 * p.getX(i) ** 2 - .02); p.needsUpdate = true; }
screenGroup.add(frame);
scene.add(screenGroup);

/* ---------- projector beam ---------- */
const projector = new THREE.Vector3(-4.6, 3.3, 6.5);
const beamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vV; varying float vL; varying vec2 vUv;
    void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.);
      vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - wp.xyz);
      vL = uv.y; gl_Position = projectionMatrix*viewMatrix*wp; }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uOn; varying vec3 vN; varying vec3 vV; varying float vL; varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    void main(){
      float rim = pow(1. - abs(dot(vN, vV)), 1.1);
      float soft = 1. - rim;               /* brighter through the middle of the cone */
      float along = smoothstep(0., .05, vL) * (1. - vL*.7) * (1. - smoothstep(.55, .97, vL));
      float smoke = .55 + .45*n(vec2(vUv.x*8. + uTime*.2, vL*6. - uTime*.35));
      float flick = .9 + .1*n(vec2(uTime*13.,0.));
      float a = soft * along * smoke * flick * .3 * uOn;
      gl_FragColor = vec4(vec3(1., .72, .48) * a * 1.15, 1.);
    }`
});
const beam = (() => {
  const target = new THREE.Vector3(0, 0, 0);
  const d = new THREE.Vector3().subVectors(target, projector);
  const len = d.length();
  const g = new THREE.CylinderGeometry(SH * .66, 0.06, len, 48, 1, true);
  g.translate(0, len / 2, 0); // narrow end at origin (projector), wide end at +y (screen)
  const m = new THREE.Mesh(g, beamMat);
  m.position.copy(projector);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
})();
screenGroup.add(beam);

/* projector lens glare */
const glareTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,240,220,1)'); r.addColorStop(.15, 'rgba(255,170,100,.6)'); r.addColorStop(1, 'rgba(255,77,26,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); return t;
})();
const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glareTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
glare.position.copy(projector).lerp(new THREE.Vector3(0, 0, 0), .04); glare.scale.set(2.2, 2.2, 1);
screenGroup.add(glare);

/* ---------- dust in the beam ---------- */
const DUST = lowPower ? 700 : 1800;
const dustGeo = new THREE.BufferGeometry();
const dpos = new Float32Array(DUST * 3), dseed = new Float32Array(DUST);
const dir = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), projector);
for (let i = 0; i < DUST; i++) {
  const t = Math.pow(Math.random(), .7);
  const p = projector.clone().addScaledVector(dir, t);
  const r = (0.1 + t * SH * .6) * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
  p.x += Math.cos(a) * r; p.y += Math.sin(a) * r * .8;
  dpos.set([p.x, p.y, p.z], i * 3); dseed[i] = Math.random();
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
dustGeo.setAttribute('seed', new THREE.BufferAttribute(dseed, 1));
const dustMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uPR: { value: 1 }, uOn: { value: 0 } },
  vertexShader: /* glsl */`
    attribute float seed; uniform float uTime, uPR; varying float vA;
    void main(){ vec3 p = position;
      p.x += sin(uTime*.25 + seed*40.)*.18; p.y += sin(uTime*.18 + seed*70.)*.22 + mod(uTime*.04*seed, .6);
      p.z += cos(uTime*.2 + seed*20.)*.15;
      vec4 mv = modelViewMatrix*vec4(p,1.);
      gl_PointSize = (2. + seed*5.) * uPR * (8. / -mv.z);
      vA = .35 + .65*sin(uTime*(1.+seed*2.) + seed*30.)*.5 + .5;
      gl_Position = projectionMatrix*mv; }`,
  fragmentShader: /* glsl */`
    uniform float uOn; varying float vA;
    void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,.0,d) * vA * .55 * uOn;
      gl_FragColor = vec4(vec3(1.,.82,.62)*a, a); }`
});
screenGroup.add(new THREE.Points(dustGeo, dustMat));

/* ---------- floor: glow of the screen spilling on the ground ---------- */
const floorMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uOn: { value: 0 }, uTint: { value: new THREE.Color(1, .45, .2) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} `,
  fragmentShader: `uniform float uOn; uniform vec3 uTint; varying vec2 vUv;
    void main(){ vec2 q=(vUv-vec2(.5,.92))*vec2(1.,2.2); float g=exp(-dot(q,q)*5.);
      float lines = .85 + .15*step(.5, fract(vUv.y*60.));
      gl_FragColor=vec4(uTint*g*.35*uOn*lines, g*.6*uOn); }`
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.set(0, -SH / 2 - .9, 4);
scene.add(floor);

/* rows of cinema seats as dark silhouettes in the foreground */
const seats = new THREE.Group();
const seatMat = new THREE.MeshBasicMaterial({ color: 0x050403 });
const seatGeo = new THREE.CapsuleGeometry(.15, .34, 4, 12);
for (let row = 0; row < 4; row++) {
  for (let i = -13; i <= 13; i++) {
    const s = new THREE.Mesh(seatGeo, seatMat);
    const z = 6.2 - row * .9;
    s.position.set(i * .4 + (row % 2) * .2, -1.62 + row * .05 + Math.sin(i * 1.7 + row) * .025, z);
    seats.add(s);
  }
}
scene.add(seats);

/* ---------- post ---------- */
let composer = null, bloom = null;
if (!lowPower) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.6, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

/* ---------- layout ---------- */
const lookBase = new THREE.Vector2(.35, .4);
const state = { p: 0, intro: 0, mouse: new THREE.Vector2(), sm: new THREE.Vector2(), slide: 0, slideT: 0, visible: true };
function layout() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pr = Math.min(devicePixelRatio || 1, lowPower ? 1.25 : 1.6);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
  composer && composer.setSize(w, h); composer && composer.setPixelRatio(pr);
  dustMat.uniforms.uPR.value = pr * (h / 900);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (isSmall()) { screenGroup.position.set(0, 2.05, 0); screenGroup.scale.setScalar(.42); lookBase.set(0, 0); }
  else { const wide = w / h; screenGroup.position.set(wide > 1.5 ? 3.0 : 2.3, 1.05, 0); screenGroup.scale.setScalar(wide > 1.5 ? .8 : .66); lookBase.set(.3, .3); }
}
layout(); addEventListener('resize', layout);
addEventListener('pointermove', e => { state.mouse.set(e.clientX / innerWidth - .5, e.clientY / innerHeight - .5); }, { passive: true });
new IntersectionObserver(([en]) => { state.visible = en.isIntersecting; }).observe(canvas);

const camBase = new THREE.Vector3(0, .25, 11);
const look = new THREE.Vector3();
const clock = new THREE.Clock();
let t = 0, frames = [], degraded = false;
function tick() {
  requestAnimationFrame(tick);
  if (!state.visible || document.hidden) { clock.getDelta(); return; }
  const rawDt = clock.getDelta(); const dt = Math.min(rawDt, .05);
  if (!degraded && state.intro > .5) { frames.push(rawDt); if (frames.length > 90) { const sorted = frames.slice().sort((a, b) => a - b); if (sorted[45] > .026) { degraded = true; renderer.setPixelRatio(1); if (composer) { composer.setPixelRatio(1); bloom.enabled = false; } } frames = []; degraded = degraded || false; } }
  t += reduce ? 0 : dt;
  state.sm.lerp(state.mouse, .05);

  /* slideshow: hold ~3.2s, burn ~1.1s */
  if (!reduce && state.intro > .9) {
    state.slideT += dt;
    const hold = 3.2, burnDur = 1.1;
    if (state.slideT > hold) {
      const k = Math.min(1, (state.slideT - hold) / burnDur);
      screenMat.uniforms.uMix.value = k;
      if (k >= 1) {
        state.slide = (state.slide + 1) % slides.length;
        window.dispatchEvent(new CustomEvent('hero-slide', { detail: slideNames[state.slide] }));
        screenMat.uniforms.tA.value = slides[state.slide];
        screenMat.uniforms.tB.value = slides[(state.slide + 1) % slides.length];
        screenMat.uniforms.uMix.value = 0; state.slideT = 0;
      }
    }
  }
  const on = state.intro;
  screenMat.uniforms.uTime.value = t; screenMat.uniforms.uOn.value = on;
  beamMat.uniforms.uTime.value = t; beamMat.uniforms.uOn.value = on;
  dustMat.uniforms.uTime.value = t; dustMat.uniforms.uOn.value = on;
  floorMat.uniforms.uOn.value = on; glare.material.opacity = on * .9;

  /* camera: mouse parallax + scroll dolly into the screen */
  const p = state.p;
  const target = screenGroup.position;
  const dolly = THREE.MathUtils.smoothstep(p, 0, 1);
  camera.position.set(
    camBase.x + state.sm.x * .9 + (target.x - camBase.x) * dolly * .9,
    camBase.y - state.sm.y * .5 + (target.y - camBase.y) * dolly * .9,
    THREE.MathUtils.lerp(camBase.z, 3.4, dolly)
  );
  look.set(target.x * (lookBase.x + dolly * (1 - lookBase.x)), target.y * (lookBase.y + dolly * (1 - lookBase.y)), 0);
  camera.lookAt(look);
  camera.rotation.z += Math.sin(t * .3) * .002;
  if (bloom) bloom.strength = .45 + on * .2 + dolly * .3;

  composer ? composer.render() : renderer.render(scene, camera);
}
tick();

window.__hero = {
  progress: v => { state.p = v; },
  intro: v => { state.intro = v; },
  get introValue() { return state.intro; },
  ready: true
};
window.dispatchEvent(new Event('hero-ready'));
