/* Shubhsitedeveloper v2 — cinematic agency site */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  const lowTier = reduce || saveData || mem <= 2 || (innerWidth < 820 && (cores < 6 || mem < 4));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);
  const WA = '919935270943';
  const wa = text => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const openWA = text => window.open(wa(text), '_blank', 'noopener');

  /* ---------------- smooth scroll ---------------- */
  let lenis = null, velocity = 0;
  if (!reduce && typeof Lenis !== 'undefined' && hasGSAP) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', e => { ScrollTrigger.update(); velocity = e.velocity || 0; });
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollToEl = el => {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };

  /* ---------------- mobile menu ---------------- */
  const menuBtn = $('#menuBtn'), menu = $('#mobileMenu');
  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false');
    lenis && lenis.start(); document.body.style.overflow = '';
    $$('main, footer, .wa-fab').forEach(x => x.inert = false); menuBtn.focus();
  }
  menuBtn.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      lenis && lenis.stop(); document.body.style.overflow = 'hidden';
      $$('main, footer, .wa-fab').forEach(x => x.inert = true);
      setTimeout(() => { const f = $('a', menu); f && f.focus(); }, 60);
    } else { menu.classList.add('is-open'); closeMenu(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
    if (e.key === 'Tab' && menu.classList.contains('is-open')) {
      const f = [menuBtn, ...$$('a', menu)], i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (!id || !id.startsWith('#')) return;
    const el = id === '#top' || id === '#' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    if (a.dataset.plan) { const sel = $('#fPlan'); if (sel) sel.value = a.dataset.plan; }
    scrollToEl(el);
    const target = a.dataset.plan ? $('#fName') : el;
    if (target && target !== document.body) {
      if (!target.matches('a,button,input,select,textarea,[tabindex]')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  }));

  /* ---------------- HUD + timecode ---------------- */
  const hud = $('.hud'), fab = $('.wa-fab'), tc = $('#timecode');
  const onScroll = () => {
    const y = scrollY, past = y > 200;
    hud.classList.toggle('is-scrolled', y > 40);
    fab.classList.toggle('is-on', past && !inForm);
  };
  let inForm = false; // the contact section already has big WhatsApp buttons, so the floating one steps aside there
  const zones = new Set();
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(ens => {
      ens.forEach(en => en.isIntersecting ? zones.add(en.target) : zones.delete(en.target));
      inForm = zones.size > 0 && innerWidth < 820; onScroll();
    }, { threshold: .05 });
    ['#contact', '#revForm', '#calc'].forEach(s => { const z = $(s); z && io.observe(z); });
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const t0 = performance.now(), pad = n => String(n).padStart(2, '0');
  setInterval(() => {
    const ms = performance.now() - t0, f = Math.floor(ms / (1000 / 24)) % 24, s = Math.floor(ms / 1000);
    tc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
  }, 1000 / 24);
  $('#yr').textContent = new Date().getFullYear();

  /* ---------------- text scramble ---------------- */
  const GLYPHS = '!<>-_\\/[]{}—=+*^?#01ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function scramble(el, finalText, dur = 700) {
    if (reduce) { el.textContent = finalText; return; }
    const from = el.textContent, len = Math.max(from.length, finalText.length), start = performance.now();
    cancelAnimationFrame(el.__scr);
    const step = now => {
      const p = Math.min(1, (now - start) / dur);
      let out = '';
      for (let i = 0; i < len; i++) {
        const ch = finalText[i] || '';
        out += i / len < p ? ch : (ch === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]);
      }
      el.textContent = out;
      if (p < 1) el.__scr = requestAnimationFrame(step); else el.textContent = finalText;
    };
    el.__scr = requestAnimationFrame(step);
  }

  /* ---------------- cursor + magnetic ---------------- */
  const cursor = $('#cursor'), cLabel = $('#cursorLabel');
  if (finePointer && !reduce) {
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; cursor.style.opacity = 1; }, { passive: true });
    const loop = () => { cx += (mx - cx) * .22; cy += (my - cy) * .22; cursor.style.transform = `translate3d(${cx}px,${cy}px,0)`; requestAnimationFrame(loop); };
    loop();
    $$('[data-cursor]').forEach(el => {
      el.addEventListener('pointerenter', () => { cLabel.textContent = el.dataset.cursor; cursor.classList.add('is-big'); });
      el.addEventListener('pointerleave', () => cursor.classList.remove('is-big'));
    });
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .35}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------------- projector sound (Web Audio, no files) ---------------- */
  const soundBtn = $('#soundBtn');
  let audio = null;
  function buildAudio() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 220; bp.Q.value = .8;
    const motor = ctx.createGain(); motor.gain.value = .55;
    noise.connect(bp).connect(motor).connect(master);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
    const gate = ctx.createGain(); gate.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 24;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = .09;
    lfo.connect(lfoAmt).connect(gate.gain);
    noise.connect(hp).connect(gate).connect(master);
    const hum = ctx.createOscillator(); hum.frequency.value = 50; const humG = ctx.createGain(); humG.gain.value = .05;
    hum.connect(humG).connect(master);
    noise.start(); lfo.start(); hum.start();
    return { ctx, master };
  }
  soundBtn.addEventListener('click', () => {
    const on = soundBtn.getAttribute('aria-pressed') !== 'true';
    soundBtn.setAttribute('aria-pressed', String(on));
    if (!audio) audio = buildAudio();
    if (!audio) return;
    const { ctx, master } = audio;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    if (on) { ctx.resume(); master.gain.linearRampToValueAtTime(.16, ctx.currentTime + .8); }
    else master.gain.linearRampToValueAtTime(0, ctx.currentTime + .4);
  });
  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden) audio.ctx.suspend(); else if (soundBtn.getAttribute('aria-pressed') === 'true') audio.ctx.resume();
  });

  /* ---------------- hero: 3D projection room, with 2D shader fallback ---------------- */
  let introV = 0;
  const hero = { intro: () => {}, progress: () => {} };
  const glState = { mouse: [0.5, 0.5], target: [0.5, 0.5], visible: true, intro: 0 };
  function initFallbackGL() {
    document.body.classList.add('use-gl');
    const canvas = $('#gl');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) { canvas.style.background = 'radial-gradient(80% 60% at 70% 30%,#5a1a08,#0b0a09 70%)'; return; }
    const vs = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
    const fs = `precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;uniform float k;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 R=mat2(.8,.6,-.6,.8);for(int i=0;i<4;i++){v+=a*n(p);p=R*p*2.03+3.1;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=(gl_FragCoord.xy-.5*r)/r.y;vec2 mm=(m-.5)*vec2(r.x/r.y,1.);float T=t*.06;
vec2 w=q+vec2(fbm(q*1.6+T),fbm(q*1.6-T+4.))*.55;float smoke=fbm(w*2.2+vec2(T*1.4,-T));
vec2 c=vec2(.42,.18)+mm*.35;float d=length((q-c)*vec2(.75,1.));float bloom=exp(-d*d*3.2)*(.65+.55*smoke);
float streak=exp(-abs(q.y-c.y)*26.)*exp(-abs(q.x-c.x)*.9)*.55;
vec3 col=vec3(.043,.039,.035)+vec3(1.,.30,.10)*bloom*1.05+vec3(1.,.62,.32)*pow(bloom,3.)*.9+vec3(1.,.55,.35)*streak;
col*=.94+.06*n(vec2(t*9.,0.));col*=k;col*=1.-.55*pow(length(uv-.5)*1.25,2.2);gl_FragColor=vec4(col,1.);}`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return;
    const prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uM = gl.getUniformLocation(prog, 'm'), uK = gl.getUniformLocation(prog, 'k');
    const resize = () => { const dpr = innerWidth < 820 ? .6 : .75; canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr); gl.viewport(0, 0, canvas.width, canvas.height); };
    resize(); addEventListener('resize', resize);
    addEventListener('pointermove', e => { glState.target = [e.clientX / innerWidth, 1 - e.clientY / innerHeight]; }, { passive: true });
    new IntersectionObserver(([en]) => { glState.visible = en.isIntersecting; }).observe(canvas);
    const start = performance.now();
    const frame = () => {
      requestAnimationFrame(frame); if (!glState.visible) return;
      glState.mouse[0] += (glState.target[0] - glState.mouse[0]) * .04; glState.mouse[1] += (glState.target[1] - glState.mouse[1]) * .04;
      gl.uniform2f(uR, canvas.width, canvas.height); gl.uniform1f(uT, reduce ? 20 : (performance.now() - start) / 1000 + 20);
      gl.uniform2f(uM, glState.mouse[0], glState.mouse[1]); gl.uniform1f(uK, glState.intro); gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    frame();
    hero.intro = v => { glState.intro = v; };
  }
  const nowShowing = $('#nowShowing');
  addEventListener('hero-slide', e => scramble(nowShowing, e.detail, 650));
  const heroReady = new Promise(resolve => {
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    if (lowTier) { initFallbackGL(); resolve(); return; }
    Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))])
      .then(() => import('./scene.js'))
      .then(() => {
        if (window.__hero) { hero.intro = window.__hero.intro; hero.progress = window.__hero.progress; hero.intro(introV); hero.progress(Math.min(1, scrollY / innerHeight)); }
        else initFallbackGL();
        resolve();
      })
      .catch(err => { console.warn('3D hero unavailable, using fallback', err); initFallbackGL(); resolve(); });
    setTimeout(resolve, 6000); // never hold the curtain forever
  });

  /* ---------------- manifesto word split ---------------- */
  const mText = $('#manifestoText');
  const hot = new Set(['cheap,', 'slow', 'empty,', 'first', 'five', 'seconds']);
  mText.innerHTML = mText.textContent.trim().split(/\s+/).map(w => `<span class="mw${hot.has(w) ? ' hot' : ''}">${w}</span>`).join(' ');

  /* ---------------- split headings into masked words ---------------- */
  $$('.split').forEach(el => {
    const walk = node => {
      [...node.childNodes].forEach(ch => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const m = document.createElement('span'); m.className = 'wm';
            const i = document.createElement('span'); i.className = 'wi'; i.textContent = part;
            m.appendChild(i); frag.appendChild(m);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1) walk(ch);
      });
    };
    walk(el);
  });

  /* ---------------- industries ---------------- */
  $$('.ind').forEach(btn => {
    const nm = $('.ind__name', btn), cta = $('.ind__cta', btn);
    if (nm && cta) cta.setAttribute('aria-label', `Get my free demo for ${nm.textContent.trim()}`);
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', `${e.clientX - r.left}px`); btn.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
    btn.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      openWA(`Hi Shubhsitedeveloper! I run a ${btn.dataset.biz} and I’d like a free website demo.`);
    });
  });

  /* ---------------- brief form → WhatsApp ---------------- */
  $('#brief').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#fName'), biz = $('#fBiz'), err = $('#briefErr');
    [name, biz].forEach(i => i.setAttribute('aria-invalid', String(!i.value.trim())));
    if (!name.value.trim() || !biz.value.trim()) { err.textContent = 'Please add your name and business so we can prepare your demo.'; (name.value.trim() ? biz : name).focus(); return; }
    err.textContent = '';
    const needs = $$('input[name="need"]:checked').map(i => i.value).join(', ') || 'Not sure yet';
    const plan = $('#fPlan').value || 'Not sure yet', msg = $('#fMsg').value.trim();
    openWA(`Hi Shubhsitedeveloper! 👋\n\nName: ${name.value.trim()}\nBusiness: ${biz.value.trim()}\nNeed: ${needs}\nPackage: ${plan}${msg ? `\nNote: ${msg}` : ''}\n\nPlease send me a free demo idea.`);
  });

  /* ---------------- speed check ---------------- */
  $('#speed').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#speedUrl'), msg = $('#speedMsg');
    let v = input.value.trim();
    if (!v || !/\.[a-z]{2,}/i.test(v)) { msg.textContent = 'Type your website address, like yourbusiness.com'; input.focus(); return; }
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    window.open(`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(v)}&form_factor=mobile`, '_blank', 'noopener');
    msg.innerHTML = '';
    msg.append('Test opened in a new tab. Got your score? ');
    const a = document.createElement('a');
    a.href = wa(`Hi! I just ran a speed test on my website ${v}. Could you explain the score and send me a free audit?`);
    a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Send it to us on WhatsApp →';
    msg.append(a);
  });

  /* ---------------- price calculator ---------------- */
  const CALC = {
    web: { label: 'Website', tiers: [
      { n: 'Launch', p: 14999, f: 11999, time: '10 working days', pay: '50% · 50%', meta: 'Up to 7 pages' },
      { n: 'Business', p: 34999, f: 27999, time: '15 working days', pay: '50% · 50%', meta: 'Up to 15 pages' },
      { n: 'E-commerce', p: 69999, f: 55999, time: '25 working days', pay: '40% · 30% · 30%', meta: '50 products' }],
      addons: [], note: 'Includes 7 days of marketing free.' },
    '3d': { label: '3D website', tiers: [
      { n: 'Cinematic Landing', p: 99999, time: '3–4 weeks', pay: '50% · 30% · 20%', meta: '1 page, 1 custom 3D model' },
      { n: 'Immersive Brand Site', p: 279999, time: '6–8 weeks', pay: '50% · 30% · 20%', meta: '5–8 pages, 3–4 3D scenes' },
      { n: '3D Experience', p: 549999, from: true, time: '8–12 weeks', pay: '50% · 30% · 20%', meta: 'Configurator or unit explorer' }],
      addons: [{ n: 'Extra 3D model', p: 14999, from: true }, { n: 'Extra animated section', p: 14999 }, { n: 'AR “view in your room”', p: 24999 }, { n: 'Sound design', p: 19999 }],
      note: 'Phones get a lighter version so the site stays fast.' },
    app: { label: 'Mobile app', tiers: [
      { n: 'Starter App', p: 74999, f: 59999, time: '4–5 weeks', pay: '50% · 50%', meta: '10 screens, Android + web' },
      { n: 'Business App', p: 299999, f: 239999, time: '9–11 weeks', pay: '30 · 30 · 30 · 10%', meta: '20 screens, Android + iPhone' },
      { n: 'Advanced App', p: 799999, from: true, time: '14–20 weeks', pay: '30 · 30 · 30 · 10%', meta: 'Marketplace or delivery platform' }],
      addons: [], note: 'Full source code is yours.' }
  };
  const calc = { cat: 'web', tier: 1, addons: new Set(), mkt: false };
  const tiersEl = $('#calcTiers'), addonsEl = $('#calcAddons');
  function renderCalcControls() {
    const c = CALC[calc.cat];
    tiersEl.setAttribute('aria-label', 'Package'); tiersEl.innerHTML = c.tiers.map((t, i) => `<button type="button" class="tier" role="radio" aria-checked="${i === calc.tier}" tabindex="${i === calc.tier ? 0 : -1}" data-i="${i}"><span class="tier__name">${t.n}</span><span class="tier__price">${t.from ? 'from ' : ''}${inr(t.f || t.p)}</span><span class="tier__meta">${t.meta}</span></button>`).join('');
    addonsEl.innerHTML = c.addons.map((a, i) => `<button type="button" class="addon" aria-pressed="${calc.addons.has(i)}" data-i="${i}">+ ${a.n} <small>${a.from ? 'from ' : ''}${inr(a.p)}</small></button>`).join('');
  }
  function updateCalc(animate = true) {
    const c = CALC[calc.cat], t = c.tiers[calc.tier];
    let total = t.f || t.p, was = t.f ? t.p : 0;
    c.addons.forEach((a, i) => { if (calc.addons.has(i)) { total += a.p; if (was) was += a.p; } });
    const anyFrom = t.from || c.addons.some((a, i) => a.from && calc.addons.has(i));
    const totalEl = $('#calcTotal'), prefix = anyFrom ? 'from ' : '', txt = prefix + inr(total);
    if (animate && hasGSAP && !reduce) {
      const cur = parseInt(totalEl.textContent.replace(/[^\d]/g, ''), 10) || 0, o = { v: cur };
      gsap.killTweensOf(totalEl);
      gsap.to(o, { v: total, duration: .6, ease: 'power3.out', onUpdate: () => { totalEl.textContent = prefix + inr(o.v); }, onComplete: () => { totalEl.textContent = txt; } });
    } else totalEl.textContent = txt;
    const wasEl = $('#calcWas'); wasEl.textContent = was ? inr(was) : ''; wasEl.hidden = !was;
    $('#calcMonthly').hidden = !calc.mkt;
    $('#calcTime').textContent = t.time; $('#calcPay').textContent = t.pay; $('#calcNote').textContent = (t.f ? 'Founding price for the first 5 clients, till 31 Dec 2026. ' : '') + c.note;
    const picked = c.addons.filter((a, i) => calc.addons.has(i)).map(a => a.n);
    const text = `Hi Shubhsitedeveloper! I’d like a quote for:\n\n${c.label}: ${t.n} (${t.from ? 'from ' : ''}${inr(t.f || t.p)})${picked.length ? `\nAdd-ons: ${picked.join(', ')}` : ''}${calc.mkt ? '\nMonthly marketing: Local Starter (₹9,999/mo)' : ''}\nEstimate: ${txt} + taxes\n\nCan we discuss this?`;
    $('#calcSend').href = wa(text);
    clearTimeout(updateCalc.t); updateCalc.t = setTimeout(() => { $('#calcLive').textContent = `Estimate ${txt} plus taxes`; }, 700);
  }
  $('#calcTabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-cat]'); if (!b) return;
    $$('#calcTabs button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    calc.cat = b.dataset.cat; calc.tier = calc.cat === 'web' ? 1 : 0; calc.addons.clear();
    renderCalcControls(); updateCalc();
  });
  tiersEl.addEventListener('keydown', e => {
    const k = e.key; if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(k)) return;
    e.preventDefault(); const n = CALC[calc.cat].tiers.length;
    calc.tier = (calc.tier + (k === 'ArrowRight' || k === 'ArrowDown' ? 1 : n - 1)) % n;
    $$('.tier', tiersEl).forEach((x, i) => { x.setAttribute('aria-checked', String(i === calc.tier)); x.tabIndex = i === calc.tier ? 0 : -1; });
    $$('.tier', tiersEl)[calc.tier].focus(); updateCalc();
  });
  tiersEl.addEventListener('click', e => { const b = e.target.closest('.tier'); if (!b) return; calc.tier = +b.dataset.i; $$('.tier', tiersEl).forEach(x => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; }); updateCalc(); });
  addonsEl.addEventListener('click', e => { const b = e.target.closest('.addon'); if (!b) return; const i = +b.dataset.i; calc.addons.has(i) ? calc.addons.delete(i) : calc.addons.add(i); b.setAttribute('aria-pressed', String(calc.addons.has(i))); updateCalc(); });
  $('#calcMkt').addEventListener('change', e => { calc.mkt = e.target.checked; updateCalc(false); });
  renderCalcControls(); updateCalc(false);

  /* ---------------- ticket tilt ---------------- */
  if (finePointer && !reduce) $$('.tilt').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.transform = `rotateY(${(x - .5) * 10}deg) rotateX(${(.5 - y) * 8}deg) translateZ(0)`;
      el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`);
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  /* ---------------- services floating preview ---------------- */
  const float = $('#svcFloat'), floatImg = $('#svcFloatImg');
  if (finePointer) {
    let fx = 0, fy = 0, tx = 0, ty = 0;
    $$('.svc__row').forEach(row => {
      row.addEventListener('pointerenter', () => { floatImg.src = row.dataset.img; float.classList.add('is-on'); });
      row.addEventListener('pointerleave', () => float.classList.remove('is-on'));
      row.addEventListener('pointermove', e => { tx = Math.min(innerWidth - 220, Math.max(e.clientX + 260, innerWidth * .72)); ty = e.clientY; });
    });
    const fl = () => { fx += (tx - fx) * .12; fy += (ty - fy) * .12; float.style.left = fx + 'px'; float.style.top = fy + 'px'; requestAnimationFrame(fl); };
    fl();
  }

  /* ---------------- reel videos ---------------- */
  $$('.reel video').forEach(vid => {
    if (lowTier || reduce) return; // keep the poster on low-end phones
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting) { vid.preload = 'auto'; if (!reduce) vid.play().catch(() => {}); } else vid.pause();
    }, { threshold: .35 }).observe(vid);
  });

  /* ---------------- WhatsApp chat in the phone ---------------- */
  const chat = $('#chat'), msgs = $$('.msg', chat), status = $('#phoneStatus');
  const typing = document.createElement('div'); typing.className = 'typing'; typing.innerHTML = '<i></i><i></i><i></i>';
  chat.appendChild(typing);
  let chatAct = -1, chatTimers = [];
  function showChatUpTo(act) {
    if (act === chatAct) return;
    chatTimers.forEach(clearTimeout); chatTimers = [];
    typing.classList.remove('is-on'); status.textContent = 'online';
    const prev = chatAct; chatAct = act;
    msgs.forEach(m => { if (+m.dataset.act > act) m.classList.remove('is-shown', 'is-on'); });
    let delay = 0;
    msgs.filter(m => +m.dataset.act <= act).forEach(m => {
      if (m.classList.contains('is-on')) return;
      if (+m.dataset.act <= prev || reduce) { m.classList.add('is-shown', 'is-on'); return; }
      const out = m.classList.contains('msg--out');
      if (out) chatTimers.push(setTimeout(() => { typing.classList.add('is-on'); chat.insertBefore(typing, m); status.textContent = 'typing…'; }, delay));
      delay += out ? 700 : 250;
      chatTimers.push(setTimeout(() => {
        typing.classList.remove('is-on'); status.textContent = 'online';
        m.classList.add('is-shown'); requestAnimationFrame(() => m.classList.add('is-on'));
      }, delay));
      delay += 450;
    });
  }

  /* ---------------- reviews: approved ones from reviews.json, new ones via WhatsApp ---------------- */
  const starStr = n => '★'.repeat(n) + '<s>' + '★'.repeat(5 - n) + '</s>';
  function renderReviews(list) {
    const valid = (Array.isArray(list) ? list : []).filter(r => r && r.name && r.text && r.rating >= 1 && r.rating <= 5);
    if (!valid.length) return;
    const box = $('#revList'); box.innerHTML = '';
    valid.forEach((r, i) => {
      const card = document.createElement('article');
      card.className = 'rev' + (valid.length % 2 === 1 && i === 0 ? ' rev--wide' : '');
      const stars = document.createElement('span'); stars.className = 'stars'; stars.innerHTML = starStr(Math.round(r.rating));
      stars.setAttribute('aria-label', `${r.rating} out of 5 stars`);
      const q = document.createElement('p'); q.className = 'rev__text'; q.textContent = `“${r.text}”`;
      const who = document.createElement('div'); who.className = 'rev__who';
      const av = document.createElement('span'); av.className = 'rev__avatar'; av.textContent = r.name.trim()[0].toUpperCase();
      const nm = document.createElement('div'); const b = document.createElement('b'); b.textContent = r.name; const sm = document.createElement('small'); sm.textContent = r.business || '';
      nm.append(b, sm); who.append(av, nm);
      const meta = document.createElement('div'); meta.className = 'rev__meta';
      const v = document.createElement('span'); v.className = 'rev__verified'; v.textContent = '✓ Verified client';
      const right = document.createElement('span');
      if (r.url) { const a = document.createElement('a'); a.className = 'rev__link'; a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = (r.project || 'See the project') + ' ↗'; right.append(a); }
      else right.textContent = r.date || '';
      meta.append(v, right);
      card.append(stars, q, who, meta); box.append(card);
    });
    const avg = valid.reduce((a, r) => a + +r.rating, 0) / valid.length;
    $('#revAvg').textContent = avg.toFixed(1);
    $('#revAvgStars').innerHTML = starStr(Math.round(avg));
    $('#revCount').textContent = `from ${valid.length} review${valid.length > 1 ? 's' : ''}`;
    $('#revScore').hidden = false;
    if (hasGSAP && !reduce) gsap.from('.rev', { y: 50, opacity: 0, duration: 1, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: '#revList', start: 'top 85%', once: true } });
    if (hasGSAP) ScrollTrigger.refresh();
  }
  fetch('reviews.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).then(renderReviews).catch(() => {});

  const STAR_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
  let rating = 5;
  const starBtns = $$('#starPick button'), starLabel = $('#starLabel');
  const paintStars = n => starBtns.forEach(b => b.classList.toggle('is-lit', +b.dataset.v <= n));
  const setRating = n => { rating = n; starBtns.forEach(b => { const on = +b.dataset.v === n; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }); paintStars(n); starLabel.textContent = STAR_WORDS[n]; };
  starBtns.forEach(b => {
    b.addEventListener('click', () => setRating(+b.dataset.v));
    b.addEventListener('pointerenter', () => { paintStars(+b.dataset.v); starLabel.textContent = STAR_WORDS[+b.dataset.v]; });
    b.addEventListener('pointerleave', () => { paintStars(rating); starLabel.textContent = STAR_WORDS[rating]; });
    b.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); const n = Math.min(5, rating + 1); setRating(n); starBtns[n - 1].focus(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); const n = Math.max(1, rating - 1); setRating(n); starBtns[n - 1].focus(); }
    });
  });
  setRating(5);
  const rText = $('#rText');
  rText.addEventListener('input', () => { $('#rCount').textContent = rText.value.length; });
  $('#revForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#rName'), biz = $('#rBiz'), err = $('#revErr');
    const fields = [name, biz, rText];
    fields.forEach(i => i.setAttribute('aria-invalid', String(!i.value.trim())));
    const missing = fields.find(i => !i.value.trim());
    if (missing) { err.textContent = 'Please fill your name, business and a few words about your experience.'; missing.focus(); return; }
    err.textContent = '';
    openWA(`⭐ NEW REVIEW for Shubhsitedeveloper\n\nRating: ${'⭐'.repeat(rating)} (${rating}/5)\nName: ${name.value.trim()}\nBusiness: ${biz.value.trim()}\n\n"${rText.value.trim()}"\n\nI'm happy for this review to appear on your website.`);
    const thanks = $('#revThanks'), form = $('#revForm');
    thanks.hidden = false;
    [...form.children].forEach(ch => { if (ch !== thanks) ch.inert = true; });
    thanks.focus();
  });
  $('#revAgain').addEventListener('click', () => {
    const form = $('#revForm'); form.reset(); $('#rCount').textContent = '0'; setRating(5);
    [...form.children].forEach(ch => { ch.inert = false; });
    $('#revThanks').hidden = true; $('#rName').focus();
  });

  /* ================= GSAP choreography ================= */
  const words = $$('.hero__title .w');
  function introHero() {
    document.body.classList.remove('is-loading');
    lenis && lenis.start();
    if (!hasGSAP || reduce) { introV = 1; hero.intro(1); return; }
    const st = { v: 0 };
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to(st, { v: 1, duration: 2.6, ease: 'power2.inOut', onUpdate: () => { introV = st.v; hero.intro(st.v); } }, 0)
      .fromTo(words, { yPercent: 115, rotate: 5 }, { yPercent: 0, rotate: 0, duration: 1.5, stagger: .07 }, .35)
      .fromTo('.hero__frame', { scale: 1.08, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.6 }, .3)
      .fromTo('.hero__eyebrow, .hero__promise, .hero__lede, .hero__ctas, .hero__hud, .scroll-cue', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, stagger: .08 }, .9)
      .fromTo('.hud', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, .7);
  }

  /* -------- film leader preloader (full on first visit, quick after) -------- */
  const leader = $('#leader'), loadTxt = $('#leaderLoad');
  let seen = false; try { seen = sessionStorage.getItem('ssd-seen') === '1'; sessionStorage.setItem('ssd-seen', '1'); } catch (e) {}
  function runLeader() {
    if (reduce || !hasGSAP) { leader.remove(); introHero(); return; }
    const sweep = $('#sweep'), num = $('#leaderNum');
    const arc = p => { const a = p * Math.PI * 2 - Math.PI / 2, x = 100 + 92 * Math.cos(a), y = 100 + 92 * Math.sin(a); return `M100 100 L100 8 A92 92 0 ${p > .5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`; };
    const st = { p: 0 }, load = { v: 0 };
    let done = false;
    const per = seen || innerWidth < 820 ? .18 : .34;
    const count = gsap.timeline();
    [3, 2, 1].forEach((n, i) => {
      count.call(() => { num.textContent = n; }, null, i * per)
        .fromTo(st, { p: 0 }, { p: .999, duration: per - .02, ease: 'none', immediateRender: false, onUpdate: () => sweep.setAttribute('d', arc(st.p)) }, i * per);
    });
    count.to(load, { v: 92, duration: per * 3, ease: 'power1.out', onUpdate: () => { loadTxt.textContent = `LOADING REEL · ${Math.round(load.v)}%`; } }, 0);
    const exit = () => {
      if (done) return; done = true;
      count.kill(); loadTxt.textContent = 'LOADING REEL · 100%';
      gsap.timeline({ onComplete: () => leader.remove() })
        .to('.leader__ring, .leader__meta', { opacity: 0, scale: .92, duration: .3, ease: 'power2.in' }, 0)
        .to('.leader .bar--top', { yPercent: -100, duration: .9, ease: 'expo.inOut' }, .12)
        .to('.leader .bar--bot', { yPercent: 100, duration: .9, ease: 'expo.inOut' }, .12)
        .to(leader, { clipPath: 'inset(50% 0 50% 0)', duration: .9, ease: 'expo.inOut' }, .12)
        .call(introHero, null, .25);
    };
    const minTime = new Promise(r => count.eventCallback('onComplete', r));
    Promise.all([minTime, Promise.race([heroReady, new Promise(r => setTimeout(r, 900))])]).then(exit);
    const skip = () => exit();
    leader.addEventListener('click', skip); addEventListener('keydown', skip, { once: true });
  }
  runLeader();

  if (!hasGSAP) {
    $$('.act').forEach(a => a.classList.add('is-active'));
    $$('.manifesto__text .mw').forEach(w => (w.style.opacity = 1));
    showChatUpTo(3);
    return;
  }
  if (reduce) { $$('.manifesto__text .mw').forEach(w => (w.style.opacity = 1)); showChatUpTo(3); }

  /* hero scroll: dolly into the screen + parallax out the copy */
  ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true, onUpdate: s => hero.progress(s.progress) });
  gsap.to('.hero__inner', { yPercent: -22, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '80% top', scrub: true } });

  if (!reduce) {
    gsap.to($$('.manifesto__text .mw'), { opacity: 1, stagger: .5, ease: 'none', scrollTrigger: { trigger: '.manifesto__text', start: 'top 80%', end: 'bottom 45%', scrub: .6 } });
    $$('.split').forEach(el => gsap.from(el.querySelectorAll('.wi'), { yPercent: 115, rotate: 4, duration: 1.3, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: el, start: 'top 85%', once: true } }));
    $$('.eyebrow:not(.hero__eyebrow), .manifesto__stats > div, .direct__card, .brief, .offer, .speed, .industries__sub, .work__sub, .calc__sub, .rev-empty, .rev-form').forEach(el => {
      gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
    gsap.from('.ind', { opacity: 0, y: 60, scale: .96, duration: 1, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: '.ind-grid', start: 'top 80%', once: true } });
    gsap.from('.svc__row', { y: 50, opacity: 0, duration: 1, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '.svc', start: 'top 80%', once: true } });
    gsap.from('.promise', { clipPath: 'inset(100% 0 0 0)', duration: 1.2, ease: 'expo.inOut', stagger: .1, scrollTrigger: { trigger: '.promises__grid', start: 'top 80%', once: true } });
    gsap.from('.ticket', { y: 120, rotateX: -25, opacity: 0, transformOrigin: '50% 100%', duration: 1.4, ease: 'expo.out', stagger: .12, clearProps: 'transform',
      scrollTrigger: { trigger: '.tickets', start: 'top 85%', once: true } });
    gsap.from('.calc__box', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.calc__box', start: 'top 85%', once: true } });
    gsap.from('.contact__title > *', { yPercent: 60, rotate: 3, opacity: 0, duration: 1.3, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.contact__title', start: 'top 85%', once: true } });
    gsap.from('.credits__wordmark', { y: 80, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.credits', start: 'top 80%', once: true } });
    $$('.manifesto__stats .big[data-count]').forEach(el => {
      const node = el.firstChild, end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), o = { v: 0 };
      node.textContent = (0).toFixed(dec);
      gsap.to(o, { v: end, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true }, onUpdate: () => { node.textContent = o.v.toFixed(dec); } });
    });
  }

  const mm = gsap.matchMedia();
  mm.add('(min-width: 821px)', () => {
    const track = $('#workTrack'), bar = $('#workBar'), reels = $$('.reel');
    const dist = () => Math.max(0, track.scrollWidth - (innerWidth - (track.getBoundingClientRect().left - gsap.getProperty(track, 'x'))));
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.work', start: 'top top', end: () => '+=' + dist(), pin: '.work__pin', scrub: .8, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: s => { gsap.set(bar, { scaleX: s.progress }); gsap.set('.work__head', { opacity: 1 - Math.min(1, s.progress * 9) }); }
      }
    });
    const pinEl = $('.work__pin');
    const onFocus = e => {
      const card = e.target.closest('.reel'); if (!card) return;
      pinEl.scrollLeft = 0;
      const st = tween.scrollTrigger, d = dist(); if (!st || !d) return;
      const left = track.getBoundingClientRect().left - gsap.getProperty(track, 'x');
      const want = Math.min(d, Math.max(0, card.offsetLeft + card.offsetWidth - (innerWidth - left) + 40, card.offsetLeft - innerWidth * .25));
      const y = st.start + want;
      lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y);
      st.scroll(y); gsap.set(track, { x: -want });
    };
    track.addEventListener('focusin', onFocus);
    let tick = null;
    if (!reduce) {
      const skewTo = reels.map(r => gsap.quickTo(r, 'skewX', { duration: .5, ease: 'power3.out' }));
      tick = () => { const v = gsap.utils.clamp(-6, 6, -velocity * .25); skewTo.forEach(f => f(v)); };
      gsap.ticker.add(tick);
      reels.forEach(r => {
        const media = r.querySelector('.reel__media img, .reel__media video');
        if (media) gsap.fromTo(media, { xPercent: -2.5 }, { xPercent: 2.5, ease: 'none', scrollTrigger: { trigger: r, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
      });
    }

    const acts = $$('.act'), counter = $('#actNo'), labels = acts.map(a => a.querySelector('.act__label'));
    const labelText = labels.map(l => l.textContent);
    let cur = -1;
    ScrollTrigger.create({
      trigger: '.process', start: 'top top', end: '+=' + innerHeight * 2.6, pin: '.process__pin', scrub: true,
      onUpdate: s => {
        const i = Math.min(acts.length - 1, Math.floor(s.progress * acts.length * .999));
        if (i === cur) return; cur = i;
        acts.forEach((a, j) => a.classList.toggle('is-active', j === i));
        counter.textContent = String(i + 1).padStart(2, '0');
        scramble(labels[i], labelText[i], 600);
        showChatUpTo(i);
      }
    });
    return () => { tick && gsap.ticker.remove(tick); acts.forEach((a, j) => a.classList.toggle('is-active', j === 0)); };
  });
  mm.add('(max-width: 820px)', () => {
    chatAct = 3; msgs.forEach(m => m.classList.add('is-shown', 'is-on'));
  });

  addEventListener('load', () => ScrollTrigger.refresh());
})();
