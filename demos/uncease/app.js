import { createStage } from './scene.js';

const qs = new URLSearchParams(location.search);
const FILM = qs.has('film');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const low = qs.has('low') || (coarse && innerWidth < 900) || (navigator.hardwareConcurrency || 8) <= 4;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (v, a, b) => clamp((v - a) / (b - a));
const sstep = (a, b, v) => { const t = seg(v, a, b); return t * t * (3 - 2 * t); };
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

gsap.registerPlugin(ScrollTrigger);

/* ---------- loader ---------- */
const loader = $('.loader'), nEl = $('.loader__n'), bar = $('.loader__bar');
let shown = 0, target = .15;
const loaderTick = () => {
  shown += (target - shown) * .08;
  nEl.textContent = String(Math.round(shown * 100)).padStart(2, '0');
  bar.style.setProperty('--p', shown.toFixed(3));
};
if (!FILM) { gsap.ticker.add(loaderTick); setTimeout(() => loader.classList.add('is-lit'), 150); }
document.fonts.ready.then(() => { target = Math.max(target, .45); });

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduce && !FILM && window.Lenis) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: .9 });
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href'); if (id.length < 2) return;
  const el = id === '#top' ? document.body : $(id); if (!el) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(id === '#top' ? 0 : el, { offset: 0, duration: 1.6 }); else (id === '#top' ? scrollTo(0, 0) : el.scrollIntoView());
}));

/* ---------- section progress ---------- */
const secs = { hero: $('#hero'), flav: $('#flavours'), line: $('#lineup'), mom: $('#moments'), energy: $('#energy') };
const about = $('#about');
let geo = {};
function measure() {
  const vh = innerHeight;
  for (const k in secs) { const el = secs[k]; geo[k] = { top: el.offsetTop, len: Math.max(1, el.offsetHeight - vh) }; }
  geo.about = about.offsetTop;
}
const Pt = { hero: 0, flav: 0, line: 0, mom: 0, energy: 0, end: 0 };
const Pd = { ...Pt };
function readScroll(y) {
  for (const k in secs) Pt[k] = clamp((y - geo[k].top) / geo[k].len);
  Pt.end = clamp((y + innerHeight - geo.about) / (innerHeight * .9));
}

/* ---------- DOM choreography (driven by the same progress) ---------- */
const D = {
  kick: $('.hero__kick'), hindi: $('.hindi'), bl: $('.hero__bl'), br: $('.hero__br'), stamp: $('.stamp'), pop: $('.hero__pop'), cue: $('.hero__cue'),
  titles: $$('.flav__t'), descs: $$('.flav__d'), rail: $$('.flav__rail li'), idx: $('.flav__idx'),
  lineHead: $('.line__head'), lineNames: $('.line__names'), rows: $$('.mom__row'), momList: $('.mom__list'), energy: $('.energy__col'), nav: $('.nav'), wa: $('.wa')
};
let intro = FILM ? 1 : 0; // hero entrance 0..1
const setO = (el, o, y = 0, s = 1) => { el.style.opacity = o.toFixed(3); el.style.transform = `translate3d(0,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})`; el.style.visibility = o < .005 ? 'hidden' : 'visible'; };
function domUpdate(P) {
  const h = P.hero, f = P.flav, l = P.line, m = P.mom, e = P.energy;
  const out = 1 - sstep(.38, .52, h);
  const I = (d) => eio(clamp(intro * 1.6 - d));
  setO(D.kick, out * I(.1), (1 - I(.1)) * 14);
  setO(D.hindi, out * I(.2) * .9, (1 - I(.2)) * 14);
  setO(D.bl, out * I(.3), (1 - I(.3)) * 24);
  setO(D.br, out * I(.4), (1 - I(.4)) * 24);
  setO(D.cue, out * I(.6) * (1 - sstep(.02, .08, h)));
  D.stamp.style.opacity = (out * I(.5)).toFixed(3);
  D.stamp.style.transform = `rotate(${(h * 300 + intro * 40).toFixed(1)}deg)`;
  const pop = sstep(.56, .66, h) * (1 - sstep(.86, .99, h));
  D.pop.style.opacity = pop.toFixed(3);
  D.pop.style.transform = `translateY(-50%) scale(${(0.86 + sstep(.56, 1, h) * .2).toFixed(4)})`;
  D.pop.style.letterSpacing = `${((1 - sstep(.56, .72, h)) * .12).toFixed(3)}em`;

  // flavours
  const q = clamp((f - .05) / .9) * 4;
  const qi = Math.min(3, Math.floor(q)); const qf = q - qi;
  const qEff = q >= 4 ? 4 : qi + sstep(.5, .95, qf);
  const fIn = sstep(0, .05, f) * (1 - sstep(.97, 1, f) * 0);
  D.titles.forEach((t, i) => {
    const d = i - qEff; const o = clamp(1 - Math.abs(d) * 1.8) * fIn;
    t.style.opacity = o.toFixed(3);
    t.style.transform = `translate3d(0,${(d * 55).toFixed(1)}%,0)`;
    t.style.clipPath = `inset(${Math.max(0, d * 100).toFixed(1)}% 0 ${Math.max(0, -d * 100).toFixed(1)}% 0)`;
    t.style.color = i === Math.round(qEff) ? 'var(--bone)' : 'var(--bone)';
  });
  D.descs.forEach((t, i) => { const d = i - qEff; t.style.opacity = (clamp(1 - Math.abs(d) * 2.6) * fIn).toFixed(3); t.style.transform = `translate3d(0,${(d * 16).toFixed(1)}px,0)`; });
  const cur = Math.round(qEff);
  D.idx.textContent = String(cur + 1).padStart(2, '0');
  D.rail.forEach((li, i) => { li.style.setProperty('--f', clamp(f * 5 - i).toFixed(3)); li.classList.toggle('is-on', i === cur); });

  // lineup
  const lo = sstep(.2, .45, l) * (1 - sstep(.0, .25, m));
  setO(D.lineHead, lo, (1 - sstep(.2, .45, l)) * 40);
  setO(D.lineNames, sstep(.45, .65, l) * (1 - sstep(0, .2, m)));
  // moments
  D.rows[0].style.transform = `translate3d(${(-m * 45 + 5).toFixed(2)}%,0,0)`;
  D.rows[1].style.transform = `translate3d(${(m * 45 - 40).toFixed(2)}%,0,0)`;
  setO(D.momList, sstep(.25, .45, m) * (1 - sstep(.85, 1, m)));
  // energy
  setO(D.energy, sstep(.3, .5, e), (1 - sstep(.3, .5, e)) * 40);
  D.nav.classList.toggle('is-solid', h > .02 || Pt.end > 0);
}

/* ---------- WebGL ---------- */
const canvas = $('#gl');
let stage = null, time = 0;
const startedAt = performance.now();
measure(); readScroll(scrollY); Object.assign(Pd, Pt); domUpdate(Pd);

createStage(canvas, { low, wolf: 'assets/wolf-sm.webp' }).then(s => {
  stage = s; target = 1;
  stage.update(Pd, 0); stage.render();
  const wait = FILM ? 0 : Math.max(0, 1700 - (performance.now() - startedAt));
  setTimeout(reveal, wait);
}).catch(err => { console.error(err); canvas.style.display = 'none'; target = 1; setTimeout(reveal, 600); });

function reveal() {
  if (FILM) { loader.remove(); document.body.classList.remove('is-loading'); measure(); return; }
  setTimeout(() => {
    loader.classList.add('is-out');
    document.body.classList.remove('is-loading');
    gsap.ticker.remove(loaderTick);
    measure(); ScrollTrigger.refresh();
    lenis && lenis.start();
    gsap.to({ v: 0 }, { v: 1, duration: 2.2, ease: 'power2.out', onUpdate() { intro = this.targets()[0].v; } });
    setTimeout(() => loader.remove(), 1400);
  }, 450);
}

let last = performance.now();
function loop() {
  const now = performance.now(); const dt = Math.min(.05, (now - last) / 1000); last = now;
  time += dt;
  readScroll(lenis ? lenis.scroll : scrollY);
  const k = 1 - Math.exp(-dt * 9);
  for (const key in Pd) Pd[key] += (Pt[key] - Pd[key]) * k;
  domUpdate(Pd);
  if (stage) { stage.update(Pd, time); stage.render(); }
}
if (!FILM) gsap.ticker.add(loop);

addEventListener('resize', () => { measure(); stage && stage.resize(); });

// film hook: deterministic frames for the preview video
window.__film = {
  frame(dt, y) {
    time += dt; if (y != null) { scrollTo(0, y); }
    readScroll(y ?? scrollY); Object.assign(Pd, Pt);
    domUpdate(Pd); if (stage) { stage.update(Pd, time); stage.render(); }
  },
  ready: () => !!stage,
  height: () => document.documentElement.scrollHeight - innerHeight,
  geo: () => (measure(), geo)
};

/* ---------- reveals for normal sections ---------- */
const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -12% 0px' });
$$('.rv').forEach(el => io.observe(el));

/* count-up on facts */
$$('.facts__grid dt').forEach(dt => {
  const raw = dt.firstChild.textContent; const num = parseInt(raw.replace(/\D/g, ''), 10); const pre = raw.match(/^\D*/)[0];
  const pad = raw.replace(/\D/g, '').length;
  ScrollTrigger.create({ trigger: dt, start: 'top 85%', once: true, onEnter: () => {
    if (reduce) return;
    const o = { v: 0 }; gsap.to(o, { v: num, duration: 1.4, ease: 'power3.out', onUpdate: () => { dt.firstChild.textContent = pre + String(Math.round(o.v)).padStart(pad, '0'); } });
  } });
});

/* ---------- WhatsApp: hide floating button near the form ---------- */
const formEl = $('#tradeForm');
new IntersectionObserver(([en]) => D.wa.classList.toggle('is-hidden', en.isIntersecting), { threshold: .15 }).observe(formEl);

/* ---------- trade form ---------- */
formEl.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(formEl);
  const name = (fd.get('name') || '').trim(), city = (fd.get('city') || '').trim();
  const err = $('.form__err');
  $('#f-name').setAttribute('aria-invalid', String(!name)); $('#f-city').setAttribute('aria-invalid', String(!city));
  if (!name || !city) { err.hidden = false; (!name ? $('#f-name') : $('#f-city')).focus(); return; }
  err.hidden = true;
  const lines = [
    'Hello IKP Beverages, I want to stock UNCEASE.',
    `Name: ${name}`,
    fd.get('shop') ? `Shop / company: ${fd.get('shop').trim()}` : null,
    `City / area: ${city}`,
    `I am a: ${fd.get('type')}`,
    fd.get('need') ? `Need: ${fd.get('need').trim()}` : null,
  ].filter(Boolean).join('\n');
  window.open('https://wa.me/919711162288?text=' + encodeURIComponent(lines), '_blank', 'noopener');
});

/* ---------- carbonation cursor ---------- */
(() => {
  if (coarse || reduce || FILM) return;
  const c = $('#bubbles'); const x = c.getContext('2d'); let W, H; const B = [];
  const dpr = Math.min(2, devicePixelRatio || 1);
  const size = () => { W = c.width = innerWidth * dpr; H = c.height = innerHeight * dpr; c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'; };
  size(); addEventListener('resize', size);
  let lx = 0, ly = 0;
  addEventListener('pointermove', e => {
    const dx = e.clientX - lx, dy = e.clientY - ly; const sp = Math.hypot(dx, dy); lx = e.clientX; ly = e.clientY;
    const n = Math.min(3, Math.floor(sp / 14));
    for (let i = 0; i < n; i++) B.push({ x: e.clientX + (Math.random() - .5) * 10, y: e.clientY + (Math.random() - .5) * 10, r: 1.5 + Math.random() * 4, vy: -(.4 + Math.random() * 1.1), ph: Math.random() * 6, life: 1 });
    if (B.length > 120) B.splice(0, B.length - 120);
  }, { passive: true });
  gsap.ticker.add(() => {
    x.clearRect(0, 0, W, H);
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.life -= .012; b.y += b.vy; b.ph += .08; b.x += Math.sin(b.ph) * .35;
      if (b.life <= 0) { B.splice(i, 1); continue; }
      x.beginPath(); x.arc(b.x * dpr, b.y * dpr, b.r * dpr, 0, 7);
      x.strokeStyle = `rgba(246,220,138,${(b.life * .7).toFixed(3)})`; x.lineWidth = dpr; x.stroke();
      x.beginPath(); x.arc((b.x - b.r * .35) * dpr, (b.y - b.r * .35) * dpr, b.r * .28 * dpr, 0, 7);
      x.fillStyle = `rgba(255,255,255,${(b.life * .6).toFixed(3)})`; x.fill();
    }
  });
})();
