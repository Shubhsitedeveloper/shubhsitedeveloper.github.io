/* Shubhsitedeveloper — cinematic agency site */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ---------------- smooth scroll ---------------- */
  let lenis = null;
  if (!reduce && typeof Lenis !== 'undefined' && hasGSAP) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollToEl = (el) => {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2 && id !== '#') return;
    const el = id === '#top' || id === '#' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    if (a.dataset.plan) { const sel = $('#fPlan'); if (sel) sel.value = a.dataset.plan; }
    scrollToEl(el);
  }));

  /* ---------------- mobile menu ---------------- */
  const menuBtn = $('#menuBtn'), menu = $('#mobileMenu');
  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false');
    lenis && lenis.start(); document.body.style.overflow = '';
  }
  menuBtn.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) { lenis && lenis.stop(); document.body.style.overflow = 'hidden'; } else { lenis && lenis.start(); document.body.style.overflow = ''; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ---------------- HUD state + timecode ---------------- */
  const hud = $('.hud'), fab = $('.wa-fab'), tc = $('#timecode');
  const onScroll = () => {
    const y = window.scrollY;
    hud.classList.toggle('is-scrolled', y > 40);
    fab.classList.toggle('is-on', y > window.innerHeight * 0.7);
  };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const t0 = performance.now();
  const pad = n => String(n).padStart(2, '0');
  setInterval(() => {
    const ms = performance.now() - t0, f = Math.floor(ms / (1000 / 24)) % 24, s = Math.floor(ms / 1000);
    tc.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
  }, 1000 / 24);
  $('#yr').textContent = new Date().getFullYear();

  /* ---------------- cursor ---------------- */
  const cursor = $('#cursor'), cLabel = $('#cursorLabel');
  let mx = innerWidth / 2, my = innerHeight / 2;
  if (finePointer && !reduce) {
    let cx = mx, cy = my;
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; cursor.style.opacity = 1; }, { passive: true });
    const loop = () => { cx += (mx - cx) * .22; cy += (my - cy) * .22; cursor.style.transform = `translate3d(${cx}px,${cy}px,0)`; requestAnimationFrame(loop); };
    loop();
    $$('[data-cursor]').forEach(el => {
      el.addEventListener('pointerenter', () => { cLabel.textContent = el.dataset.cursor; cursor.classList.add('is-big'); });
      el.addEventListener('pointerleave', () => cursor.classList.remove('is-big'));
    });
    /* magnetic buttons */
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .35}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------------- hero WebGL: ember light leak ---------------- */
  const glState = { mouse: [0.5, 0.5], target: [0.5, 0.5], visible: true, intro: 0 };
  (function initGL() {
    const canvas = $('#gl');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) { canvas.style.background = 'radial-gradient(80% 60% at 70% 30%,#5a1a08,#0b0a09 70%)'; return; }
    const vs = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
    const fs = `precision highp float;
uniform vec2 r;uniform float t;uniform vec2 m;uniform float k;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 R=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*n(p);p=R*p*2.03+3.1;a*=.5;}return v;}
void main(){
 vec2 uv=gl_FragCoord.xy/r;vec2 q=(gl_FragCoord.xy-.5*r)/r.y;
 vec2 mm=(m-.5)*vec2(r.x/r.y,1.);
 float T=t*.06;
 vec2 w=q+vec2(fbm(q*1.6+T),fbm(q*1.6-T+4.))*.55;
 float smoke=fbm(w*2.2+vec2(T*1.4,-T));
 /* main ember bloom follows the pointer softly */
 vec2 c=vec2(.42,.18)+mm*.35;
 float d=length((q-c)*vec2(.75,1.));
 float bloom=exp(-d*d*3.2)*(.65+.55*smoke);
 /* secondary cool leak bottom-left */
 float d2=length(q-vec2(-.85,-.55));
 float leak=exp(-d2*d2*2.4)*.35;
 /* anamorphic streak */
 float streak=exp(-abs(q.y-c.y)*26.)*exp(-abs(q.x-c.x)*.9)*.55;
 vec3 col=vec3(.043,.039,.035);
 col+=vec3(1.,.30,.10)*bloom*1.05;
 col+=vec3(1.,.62,.32)*pow(bloom,3.)*.9;
 col+=vec3(.25,.12,.42)*leak*smoke;
 col+=vec3(1.,.55,.35)*streak;
 col+=vec3(.95,.8,.7)*smoothstep(.55,.95,smoke)*.05;
 /* light flicker like a projector */
 col*=.94+.06*n(vec2(t*9.,0.));
 col*=k;
 /* scanline + vignette */
 col*=.97+.03*sin(gl_FragCoord.y*1.6);
 col*=1.-.55*pow(length(uv-.5)*1.25,2.2);
 gl_FragColor=vec4(col,1.);
}`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return;
    const prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uM = gl.getUniformLocation(prog, 'm'), uK = gl.getUniformLocation(prog, 'k');
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * (innerWidth < 820 ? .6 : .75);
      canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize(); addEventListener('resize', resize);
    addEventListener('pointermove', e => { glState.target = [e.clientX / innerWidth, 1 - e.clientY / innerHeight]; }, { passive: true });
    new IntersectionObserver(([en]) => { glState.visible = en.isIntersecting; }).observe(canvas);
    const start = performance.now();
    const frame = () => {
      requestAnimationFrame(frame);
      if (!glState.visible) return;
      glState.mouse[0] += (glState.target[0] - glState.mouse[0]) * .04;
      glState.mouse[1] += (glState.target[1] - glState.mouse[1]) * .04;
      const t = reduce ? 20 : (performance.now() - start) / 1000;
      gl.uniform2f(uR, canvas.width, canvas.height); gl.uniform1f(uT, t + 20);
      gl.uniform2f(uM, glState.mouse[0], glState.mouse[1]); gl.uniform1f(uK, glState.intro);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    frame();
  })();

  /* ---------------- manifesto word split ---------------- */
  const mText = $('#manifestoText');
  const hot = new Set(['cheap,', 'slow', 'empty,', 'first', 'five', 'seconds']);
  mText.innerHTML = mText.textContent.trim().split(/\s+/).map(w => `<span class="mw${hot.has(w) ? ' hot' : ''}">${w}</span>`).join(' ');

  /* ---------------- form → WhatsApp ---------------- */
  $('#brief').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#fName'), biz = $('#fBiz'), err = $('#briefErr');
    [name, biz].forEach(i => i.setAttribute('aria-invalid', String(!i.value.trim())));
    if (!name.value.trim() || !biz.value.trim()) { err.textContent = 'Please add your name and business so we can prepare your demo.'; (name.value.trim() ? biz : name).focus(); return; }
    err.textContent = '';
    const needs = $$('input[name="need"]:checked').map(i => i.value).join(', ') || 'Not sure yet';
    const plan = $('#fPlan').value || 'Not sure yet', msg = $('#fMsg').value.trim();
    const text = `Hi Shubhsitedeveloper! 👋\n\nName: ${name.value.trim()}\nBusiness: ${biz.value.trim()}\nNeed: ${needs}\nPackage: ${plan}${msg ? `\nNote: ${msg}` : ''}\n\nPlease send me a free demo idea.`;
    window.open(`https://wa.me/919935270943?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  });

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
    let fx = 0, fy = 0, tx = 0, ty = 0, on = false;
    $$('.svc__row').forEach(row => {
      row.addEventListener('pointerenter', () => { floatImg.src = row.dataset.img; float.classList.add('is-on'); on = true; });
      row.addEventListener('pointerleave', () => { float.classList.remove('is-on'); on = false; });
      row.addEventListener('pointermove', e => { tx = e.clientX + 170; ty = e.clientY; });
    });
    const fl = () => { fx += (tx - fx) * .12; fy += (ty - fy) * .12; float.style.left = fx + 'px'; float.style.top = fy + 'px'; requestAnimationFrame(fl); };
    fl();
  }

  /* ---------------- reel videos: play when visible ---------------- */
  $$('.reel video').forEach(vid => {
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting) { vid.preload = 'auto'; if (!reduce) vid.play().catch(() => {}); } else vid.pause();
    }, { threshold: .35 }).observe(vid);
  });

  /* ================= GSAP choreography ================= */
  const words = $$('.hero__title .w');
  const heroBits = $$('.hero__eyebrow, .hero__lede, .hero__ctas, .hero__hud, .scroll-cue, .hero__frame');

  function introHero() {
    document.body.classList.remove('is-loading');
    lenis && lenis.start();
    if (!hasGSAP || reduce) { glState.intro = 1; return; }
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(glState, { intro: 1, duration: 2.4, ease: 'power2.out' }, 0)
      .fromTo(words, { yPercent: 110, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.5, stagger: .07 }, .1)
      .fromTo('.hero__frame', { scale: 1.08, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.6 }, .2)
      .fromTo(heroBits.filter(el => !el.classList.contains('hero__frame')), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, stagger: .08 }, .7)
      .fromTo('.hud', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, .5);
  }

  /* -------- film leader preloader -------- */
  const leader = $('#leader');
  function runLeader() {
    if (reduce || !hasGSAP) { leader.remove(); introHero(); return; }
    const sweep = $('#sweep'), num = $('#leaderNum');
    const arc = p => {
      const a = p * Math.PI * 2 - Math.PI / 2, x = 100 + 92 * Math.cos(a), y = 100 + 92 * Math.sin(a);
      return `M100 100 L100 8 A92 92 0 ${p > .5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
    };
    const st = { p: 0 };
    const tl = gsap.timeline({ onComplete: () => leader.remove() });
    [3, 2, 1].forEach((n, i) => {
      tl.call(() => { num.textContent = n; }, null, i * .62)
        .fromTo(st, { p: 0 }, { p: .999, duration: .6, ease: 'none', onUpdate: () => sweep.setAttribute('d', arc(st.p)) }, i * .62);
    });
    tl.to('.leader__ring, .leader__meta', { opacity: 0, scale: .9, duration: .3, ease: 'power2.in' }, 1.86)
      .to('.leader .bar--top', { yPercent: -100, duration: .9, ease: 'expo.inOut' }, 2.0)
      .to('.leader .bar--bot', { yPercent: 100, duration: .9, ease: 'expo.inOut' }, 2.0)
      .to(leader, { clipPath: 'inset(50% 0 50% 0)', duration: .9, ease: 'expo.inOut' }, 2.0)
      .call(introHero, null, 2.15);
  }
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(runLeader);

  if (!hasGSAP) {
    $$('.act').forEach(a => a.classList.add('is-active'));
    $$('.manifesto__text .mw').forEach(w => (w.style.opacity = 1));
    return;
  }
  if (reduce) {
    $$('.manifesto__text .mw').forEach(w => (w.style.opacity = 1));
  }

  /* hero parallax out */
  gsap.to('.hero__inner', { yPercent: -18, opacity: .2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* manifesto scrub */
  if (!reduce) {
    const mws = $$('.manifesto__text .mw');
    gsap.to(mws, { opacity: 1, stagger: .5, ease: 'none', scrollTrigger: { trigger: '.manifesto__text', start: 'top 80%', end: 'bottom 45%', scrub: .6 } });
  }

  /* generic reveals */
  if (!reduce) {
    $$('.h2, .contact__title, .eyebrow:not(.hero__eyebrow), .manifesto__stats > div, .promise, .ticket, .direct__card, .brief, .offer, .credits__wordmark').forEach(el => {
      gsap.from(el, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    gsap.from('.svc__row', { y: 50, opacity: 0, duration: 1, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '.svc', start: 'top 80%', once: true } });
    gsap.from('.contact__title > *', { yPercent: 60, rotate: 3, opacity: 0, duration: 1.3, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.contact__title', start: 'top 85%', once: true } });
    /* count-up stats */
    $$('.manifesto__stats .big').forEach(el => {
      const node = el.firstChild, end = parseInt(node.textContent, 10);
      if (!end) return;
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true }, onUpdate: () => { node.textContent = Math.round(o.v); } });
    });
  }

  const mm = gsap.matchMedia();
  mm.add('(min-width: 821px)', () => {
    /* horizontal reel */
    const track = $('#workTrack'), bar = $('#workBar');
    const dist = () => Math.max(0, track.scrollWidth - (window.innerWidth - track.getBoundingClientRect().left) + 0);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.work', start: 'top top', end: () => '+=' + dist(), pin: '.work__pin', scrub: .8, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: s => { gsap.set(bar, { scaleX: s.progress }); gsap.set('.work__head', { opacity: 1 - Math.min(.75, s.progress * 2.2) }); }
      }
    });
    $$('.reel').forEach(r => {
      const media = r.querySelector('.reel__media img, .reel__media video');
      if (!media || reduce) return;
      gsap.fromTo(media, { xPercent: -2.5 }, { xPercent: 2.5, ease: 'none', scrollTrigger: { trigger: r, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });

    /* process acts */
    const acts = $$('.act'), counter = $('#actNo');
    ScrollTrigger.create({
      trigger: '.process', start: 'top top', end: '+=' + window.innerHeight * 2.4, pin: '.process__pin', scrub: true,
      onUpdate: s => {
        const i = Math.min(acts.length - 1, Math.floor(s.progress * acts.length * .999));
        acts.forEach((a, j) => a.classList.toggle('is-active', j === i));
        counter.textContent = String(i + 1).padStart(2, '0');
      }
    });
    return () => acts.forEach((a, j) => a.classList.toggle('is-active', j === 0));
  });

  /* credits wordmark slow drift */
  if (!reduce) gsap.fromTo('.credits__wordmark', { xPercent: 2 }, { xPercent: -2, ease: 'none', scrollTrigger: { trigger: '.credits', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  addEventListener('load', () => ScrollTrigger.refresh());
})();
