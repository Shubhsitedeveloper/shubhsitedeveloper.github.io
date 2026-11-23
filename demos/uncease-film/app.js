import { createFilm, T } from './film.js';

const qs = new URLSearchParams(location.search);
const FILM = qs.has('film');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const low = !qs.has('hi') && (qs.has('low') || (coarse && innerWidth < 900) || (navigator.hardwareConcurrency || 8) <= 2);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (v, a, b) => clamp((v - a) / (b - a));
const sstep = (a, b, v) => { const t = seg(v, a, b); return t * t * (3 - 2 * t); };

gsap.registerPlugin(ScrollTrigger);

/* ---------- copy ---------- */
const CHAPTERS = [
  'Deep berry colour, lively fizz.',
  'Tart red berry. Wide awake.',
  'Soft orchard fruit, golden light.',
  'Crisp, green, a little bit loud.',
  'The pink label. Name coming soon.'
];
const SUBS = [
  [.005, .03, 'Every bottle has a wolf inside.'],
  [.045, .1, '[ the cap hisses ]'],
  [.125, .17, 'Chalo, andar chalte hain.'],
  [.19, .23, '[ bubbles rising ]'],
  [.62, .66, '[ fizz getting louder ]'],
  [.8, .84, 'Almost at the top.'],
  [.845, .875, 'Hold your breath.'],
  [.886, .905, '[ POP ]'],
  [.93, .97, '[ fireworks over Delhi ]'],
];

/* ---------- loader: chill the bottle from 30°C to 4°C ---------- */
const loader = $('.loader'), degEl = $('.loader__deg b');
let lp = 0, ltarget = .2;
const ltick = () => { lp += (ltarget - lp) * .07; degEl.textContent = Math.round(30 - lp * 26); };
if (!FILM) gsap.ticker.add(ltick);
document.fonts.ready.then(() => { ltarget = Math.max(ltarget, .5); });

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduce && !FILM && window.Lenis) {
  lenis = new Lenis({ duration: 1.2, smoothWheel: true, wheelMultiplier: .85 });
  lenis.stop(); lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
}
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href'); if (id.length < 2) return;
  const el = id === '#top' ? null : $(id); e.preventDefault();
  if (lenis) lenis.scrollTo(el || 0, { duration: id === '#top' ? 2.4 : 1.6 }); else (el ? el.scrollIntoView() : scrollTo(0, 0));
}));

/* ---------- film progress ---------- */
const filmEl = $('#film'); let fTop = 0, fLen = 1;
const measure = () => { fTop = filmEl.offsetTop; fLen = Math.max(1, filmEl.offsetHeight - innerHeight); };
measure();
let tTarget = 0, tShown = 0, intro = FILM ? 1 : 0, mx = 0, my = 0, tmx = 0, tmy = 0, time = 0;
const readT = y => clamp((y - fTop) / fLen);
addEventListener('pointermove', e => { tmx = (e.clientX / innerWidth - .5) * 2; tmy = -(e.clientY / innerHeight - .5) * 2; }, { passive: true });

/* ---------- DOM refs ---------- */
const D = {
  bars: $('.bars'), fade: $('.fade'), tc: $('.tc'), intro: $('.intro'), chap: $('.chap'), chapN: $('.chap__n b'), chapT: $$('.chap__t'), chapD: $('.chap__d'),
  gauge: $('.gauge'), gv: $('.gauge__v'), gfill: $('.gauge__fill'), sub: $('.sub'), outro: $('.outro'), root: document.documentElement, wa: $('.wa')
};
let lastSub = -1, lastChap = -1, lastPop = false;
function dom(t, info) {
  // letterbox in the film, gone after
  const inFilm = t < .999;
  const barH = inFilm ? Math.round(Math.min(innerHeight * .085, 76) * (1 - sstep(.975, 1, t))) : 0;
  D.root.style.setProperty('--bar', barH + 'px');
  // timecode, the whole film is 1 min 30 s at 24 fps
  const secs = t * 90; const f = Math.floor((secs % 1) * 24);
  D.tc.textContent = `00:${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(Math.floor(secs % 60)).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  // fades: amber dive cut + white pop cut
  const dive = 1 - Math.abs(t - T.cutIn) / .022; const pop = 1 - Math.abs(t - T.cutOut) / .02;
  if (dive > 0) { D.fade.style.background = '#c98a2c'; D.fade.style.opacity = clamp(dive * 1.3).toFixed(3); }
  else if (pop > 0) { D.fade.style.background = '#fff4dc'; D.fade.style.opacity = clamp(pop * 1.4).toFixed(3); }
  else D.fade.style.opacity = 0;
  // intro
  const io = clamp(intro * 1.4 - .3) * (1 - sstep(.012, .04, t));
  D.intro.style.opacity = io.toFixed(3); D.intro.style.transform = `translateY(${((1 - clamp(intro * 1.4 - .3)) * 24).toFixed(1)}px)`;
  D.intro.style.visibility = io < .01 ? 'hidden' : 'visible';
  // chapters (only inside the liquid)
  const zf = info.liquid ? (info.zoneF ?? 0) - .5 : -1;
  const cOn = info.liquid ? sstep(T.climb[0] - .01, T.climb[0] + .02, t) * (1 - sstep(T.neck[0] + .01, T.neck[0] + .04, t)) : 0;
  D.chap.style.opacity = cOn.toFixed(3);
  const z = clamp(zf, 0, 4);
  D.chapT.forEach((el, i) => { const d = i - z; el.style.transform = `translate3d(0,${(d * 105).toFixed(1)}%,0)`; el.style.opacity = clamp(1 - Math.abs(d) * 1.2).toFixed(3); });
  const ci = Math.round(z);
  if (ci !== lastChap) { lastChap = ci; D.chapN.textContent = String(ci + 1).padStart(2, '0'); D.chapD.textContent = CHAPTERS[ci]; gsap.fromTo(D.chapD, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .5, ease: 'power2.out' }); }
  // depth gauge: real bottle is about 23 cm tall
  const gOn = info.liquid ? sstep(T.dive[0], T.dive[1], t) * (1 - sstep(T.pop[0], T.pop[1], t)) : 0;
  D.gauge.style.opacity = gOn.toFixed(3);
  if (info.liquid) { const cm = Math.max(0, (46.7 - info.y) / 2.03); D.gv.textContent = cm.toFixed(1); D.gfill.style.height = (clamp(info.y / 46.7) * 100).toFixed(1) + '%'; }
  // subtitles
  let si = -1; SUBS.forEach((s, i) => { if (t >= s[0] && t <= s[1]) si = i; });
  if (si !== lastSub) { lastSub = si; if (si >= 0) { D.sub.textContent = SUBS[si][2]; D.sub.classList.add('on'); } else D.sub.classList.remove('on'); }
  // outro
  const oo = sstep(.94, .975, t);
  D.outro.style.opacity = oo.toFixed(3); D.outro.style.visibility = oo < .01 ? 'hidden' : 'visible';
  D.outro.style.transform = `translateY(${((1 - oo) * 30).toFixed(1)}px)`;
  // sound hooks
  if (info.popped && !lastPop) audio.pop(); lastPop = info.popped;
  audio.mood(info.scene, t);
}

/* ---------- sound (synthesised, off by default) ---------- */
const audio = (() => {
  let ctx = null, on = false, bed = null, bedGain = null, rumble = null, crackT = 0, lastScene = '';
  const btn = $('.snd'), lab = $('.snd__l');
  function noiseBuf(sec, brown) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate); const d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  function start() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(3, false); src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = .6;
    bedGain = ctx.createGain(); bedGain.gain.value = 0; src.connect(bp).connect(bedGain).connect(ctx.destination); src.start();
    const rs = ctx.createBufferSource(); rs.buffer = noiseBuf(4, true); rs.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    rumble = ctx.createGain(); rumble.gain.value = 0; rs.connect(lp).connect(rumble).connect(ctx.destination); rs.start();
    bed = src;
  }
  function click(vol, freq) {
    if (!ctx) return; const o = ctx.createBufferSource(); o.buffer = noiseBuf(.03, false);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq; const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .03);
    o.connect(f).connect(g).connect(ctx.destination); o.start();
  }
  btn.addEventListener('click', () => {
    on = !on; if (on && !ctx) start(); if (ctx) ctx[on ? 'resume' : 'suspend']();
    btn.setAttribute('aria-pressed', String(on)); lab.textContent = on ? 'Sound on' : 'Sound off';
  });
  return {
    mood(scene, t) {
      if (!ctx || !on) return; const now = ctx.currentTime;
      const liquid = scene === 'liquid';
      bedGain.gain.setTargetAtTime(liquid ? .05 + .05 * seg(t, .2, .85) : (scene === 'intro' ? .015 : .01), now, .3);
      rumble.gain.setTargetAtTime(liquid ? .35 : 0, now, .4);
      if (performance.now() > crackT) { crackT = performance.now() + (liquid ? 30 + Math.random() * 90 : 160 + Math.random() * 400); click(liquid ? .05 + Math.random() * .05 : (scene === 'outro' ? .12 : .02), liquid ? 3000 : 1500); }
      lastScene = scene;
    },
    pop() {
      if (!ctx || !on) return; const now = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(180, now); o.frequency.exponentialRampToValueAtTime(50, now + .25);
      const g = ctx.createGain(); g.gain.setValueAtTime(.6, now); g.gain.exponentialRampToValueAtTime(.001, now + .3); o.connect(g).connect(ctx.destination); o.start(); o.stop(now + .35);
      const n = ctx.createBufferSource(); n.buffer = noiseBuf(.6, false); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(.35, now); g2.gain.exponentialRampToValueAtTime(.001, now + .55); n.connect(f).connect(g2).connect(ctx.destination); n.start();
    }
  };
})();

/* ---------- WebGL ---------- */
const canvas = $('#gl'); let film = null; const t0 = performance.now();
createFilm(canvas, { low, wolf: 'assets/wolf-sm.webp' }).then(f => {
  film = f; window.__filmStage = f; ltarget = 1;
  const wait = FILM ? 0 : Math.max(0, 1900 - (performance.now() - t0));
  setTimeout(reveal, wait);
}).catch(err => { console.error(err); canvas.style.display = 'none'; ltarget = 1; setTimeout(reveal, 500); });

function reveal() {
  if (FILM) { loader.remove(); document.body.classList.remove('is-loading'); measure(); return; }
  degEl.textContent = '4';
  setTimeout(() => {
    loader.classList.add('is-out'); document.body.classList.remove('is-loading'); gsap.ticker.remove(ltick);
    measure(); ScrollTrigger.refresh(); lenis && lenis.start();
    gsap.to({ v: 0 }, { v: 1, duration: 3, ease: 'power2.inOut', onUpdate() { intro = this.targets()[0].v; } });
    setTimeout(() => loader.remove(), 1000);
  }, 380);
}

let last = performance.now();
function frame(dt, y) {
  time += dt;
  tTarget = readT(y);
  const k = FILM ? 1 : 1 - Math.exp(-dt * 7);
  tShown += (tTarget - tShown) * k;
  mx += (tmx - mx) * (1 - Math.exp(-dt * 3)); my += (tmy - my) * (1 - Math.exp(-dt * 3));
  if (!film) return;
  const info = film.update({ t: tShown, intro, mx: coarse ? 0 : mx, my: coarse ? 0 : my, time });
  dom(tShown, info);
  // keep the GPU idle once the film is fully scrolled past
  if (tShown < .9995 || y < fTop + fLen + innerHeight) film.render();
}
if (!FILM) gsap.ticker.add(() => { const now = performance.now(); const dt = Math.min(.05, (now - last) / 1000); last = now; frame(dt, lenis ? lenis.scroll : scrollY); });
addEventListener('resize', () => { measure(); film && film.resize(); });

window.__film = {
  ready: () => !!film,
  frame(dt, y) { scrollTo(0, y); frame(dt, y); },
  geo: () => (measure(), { top: fTop, len: fLen }),
  setIntro: v => { intro = v; }
};

/* ---------- after-film sections ---------- */
const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -10% 0px' });
$$('.rv').forEach(el => io.observe(el));
// canvas fades out once the film is over
ScrollTrigger.create({ trigger: '#showing', start: 'top bottom', end: 'top 30%', scrub: true, onUpdate: s => { canvas.style.opacity = (1 - s.progress * .85).toFixed(3); } });

// poster tilt
if (!coarse && !reduce) $$('.poster').forEach(p => {
  p.addEventListener('pointermove', e => { const r = p.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; p.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg'); p.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg'); });
  p.addEventListener('pointerleave', () => { p.style.setProperty('--ry', '0deg'); p.style.setProperty('--rx', '0deg'); });
});

// WhatsApp float hides near the ticket
const form = $('#ticketForm');
new IntersectionObserver(([en]) => D.wa.classList.toggle('is-hidden', en.isIntersecting), { threshold: .15 }).observe(form);
form.addEventListener('submit', e => {
  e.preventDefault(); const fd = new FormData(form);
  const name = (fd.get('name') || '').trim(), city = (fd.get('city') || '').trim(); const err = $('.form__err');
  $('#t-name').setAttribute('aria-invalid', String(!name)); $('#t-city').setAttribute('aria-invalid', String(!city));
  if (!name || !city) { err.hidden = false; (!name ? $('#t-name') : $('#t-city')).focus(); return; }
  err.hidden = true;
  const msg = ['Hello IKP Beverages, I want to stock UNCEASE.', `Name: ${name}`, fd.get('shop') ? `Shop / company: ${fd.get('shop').trim()}` : null, `City / area: ${city}`, `I am a: ${fd.get('type')}`, fd.get('need') ? `Need: ${fd.get('need').trim()}` : null].filter(Boolean).join('\n');
  window.open('https://wa.me/919711162288?text=' + encodeURIComponent(msg), '_blank', 'noopener');
});
