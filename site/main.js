(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = matchMedia('(min-width: 761px)');
  const hasGsap = window.gsap && window.ScrollTrigger && !reduce;
  if (!hasGsap) document.documentElement.classList.add('no-motion');

  /* marquee: дублируем карточки для бесшовной ленты */
  $$('.marquee__row').forEach(row => [...row.children].forEach(c => {
    const d = c.cloneNode(true); d.setAttribute('aria-hidden', 'true'); row.appendChild(d);
  }));

  /* header */
  const top = $('.top');
  const onScroll = () => top.classList.toggle('is-scrolled', scrollY > 10);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* smooth scroll */
  let lenis = null;
  if (hasGsap && window.Lenis && desktop.matches) {
    lenis = new Lenis({ lerp: 0.11 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToEl = el => lenis ? lenis.scrollTo(el, { offset: -70 }) : el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const el = $(a.getAttribute('href')); if (!el) return;
    e.preventDefault(); scrollToEl(el);
  }));

  /* hero video (V1): грузим после постера, играем один раз и замираем на финале.
     Ждём не canplaythrough (Safari его не шлёт при preload=none), а сразу просим play() */
  const hv = $('[data-hero-video]');
  const HERO_SRC = 'assets/video/hero-arrive.mp4';
  function startHero() {
    hv.muted = true; hv.playsInline = true; hv.preload = 'auto';
    hv.addEventListener('playing', () => hv.classList.add('is-ready'), { once: true });
    hv.addEventListener('error', () => hv.remove(), { once: true });
    hv.src = HERO_SRC;
    const go = () => hv.play().catch(() => {});
    go(); hv.addEventListener('canplay', go, { once: true });
  }
  if (hv && !reduce && desktop.matches) {
    if (document.readyState === 'complete') startHero(); else addEventListener('load', startHero, { once: true });
  }

  /* лента машин клиентов: клик открывает фото в окне просмотра */
  const lb = $('[data-lb]'), lbImg = $('[data-lb-img]'), lbName = $('[data-lb-name]');
  const cars = $$('.tile--car');
  let lbi = 0;
  function showCar(i) {
    lbi = (i + cars.length) % cars.length;
    const c = cars[lbi];
    lbImg.src = c.dataset.photo; lbImg.alt = c.querySelector('img').alt; lbName.textContent = c.dataset.name;
  }
  function openCar(i) {
    showCar(i);
    if (!lb.open) { lb.showModal(); lenis && lenis.stop(); }
  }
  cars.forEach((c, i) => {
    c.addEventListener('click', () => openCar(i));
  });
  $('[data-lb-close]').addEventListener('click', () => lb.close());
  $('[data-lb-prev]').addEventListener('click', () => showCar(lbi - 1));
  $('[data-lb-next]').addEventListener('click', () => showCar(lbi + 1));
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') showCar(lbi - 1); if (e.key === 'ArrowRight') showCar(lbi + 1); });
  lb.addEventListener('close', () => { lenis && lenis.start(); });

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    const ease = 'power3.out';

    /* first screen */
    const tl = gsap.timeline({ defaults: { ease } });
    tl.from('.hero__title span', { yPercent: 70, opacity: 0, duration: .9, stagger: .12 })
      .from('.hero__side > *', { y: 20, opacity: 0, duration: .7, stagger: .07 }, '-=.6')
      .from('.wall .tile', { y: 60, opacity: 0, duration: 1, stagger: .08 }, '-=.7');

    /* generic reveal */
    $$('[data-reveal]').forEach(el => gsap.to(el, {
      opacity: 1, y: 0, duration: .9, ease,
      scrollTrigger: { trigger: el, start: 'top 82%' }
    }));
    $$('[data-reveal-group]').forEach(g => gsap.from(g.children, {
      y: 40, opacity: 0, duration: .8, ease, stagger: .08,
      scrollTrigger: { trigger: g, start: 'top 85%' }
    }));
    ['.route__quote', '.reviews__head', '.lots__head', '.faq__grid > *'].forEach(s =>
      gsap.from($$(s), { y: 30, opacity: 0, duration: .8, ease, stagger: .08, scrollTrigger: { trigger: $(s), start: 'top 92%' } }));
    /* футер не прячем: он внизу, и порог появления там может быть недостижим */
    addEventListener('load', () => ScrollTrigger.refresh());

    /* receipt: строки «пробиваются» по очереди */
    const rc = $('[data-receipt]');
    gsap.from($$('li, .receipt__total', rc), {
      x: -16, opacity: 0, duration: .45, ease, stagger: .07,
      scrollTrigger: { trigger: rc, start: 'top 75%' }
    });
    gsap.from(rc, { rotate: -2, y: 60, opacity: 0, duration: 1, ease, scrollTrigger: { trigger: rc, start: 'top 85%' } });

  } else {
    $$('[data-reveal]').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  }

  /* route: прогресс скролла -> этап, линия, шторка между шотами */
  const track = $('[data-route]');
  const steps = $$('[data-step]');
  const layers = $$('[data-layer]');
  const dots = $$('.route__dots span');
  const fill = $('[data-route-fill]');
  const N = layers.length, WIPE = 0.32; // доля этапа, на которой идёт шторка
  let cur = -1;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  function setStep(i) {
    if (i === cur) return; cur = i;
    steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
    dots.forEach((s, k) => s.classList.toggle('is-on', k <= i));
  }
  /* видео этапов: бесшовные циклы, играет только видимый шот; 5-й этап (заезд) — один раз и стоп на финале */
  function prepVideo(layer) {
    const v = layer.querySelector('video');
    if (!v || reduce || !v.dataset.src) return null;
    if (!v.dataset.state) {
      v.dataset.state = 'loading';
      v.muted = true; v.preload = 'auto';
      v.addEventListener('playing', () => { v.dataset.state = 'ready'; v.classList.add('is-ready'); }, { once: true });
      v.addEventListener('error', () => { v.dataset.state = 'none'; v.classList.remove('is-ready'); }, { once: true });
      v.src = v.dataset.src;
    }
    return v.dataset.state === 'none' ? null : v;
  }
  function showLayer(L, on) {
    const v = prepVideo(L);
    if (!v) return;
    if (on) {
      if (!L._on && !v.loop) v.currentTime = 0;  // заезд к офису каждый раз с начала
      if (v.paused && !(v.ended && !v.loop)) v.play().catch(() => {});
    } else if (!v.paused) v.pause();
    L._on = on;
  }
  function routeProgress() {
    const r = track.getBoundingClientRect();
    return clamp(-r.top / (r.height - innerHeight));
  }
  let raf = null, shown = 0;
  function tickRoute() {
    raf = null;
    if (!desktop.matches) return;
    const r = track.getBoundingClientRect();
    const inView = r.top < innerHeight && r.bottom > 0;
    const p = routeProgress();
    shown += (p - shown) * .18;
    if (Math.abs(p - shown) < .0006) shown = p; else raf = requestAnimationFrame(tickRoute);
    fill.style.transform = `scaleX(${shown})`;
    const s = shown * (N - 0.0001);           // 0..N
    const base = Math.floor(s), t = s - base;  // этап и позиция внутри него
    layers.forEach((L, k) => {
      let rev;                                 // 0 — шот скрыт, 1 — открыт полностью
      if (k <= base) rev = 1;
      else if (k === base + 1) rev = clamp((t - (1 - WIPE)) / WIPE);
      else rev = 0;
      const e = rev * rev * (3 - 2 * rev);     // smoothstep
      if (k > 0) {
        L.style.setProperty('--cut', `${(1 - e) * 100}%`);
        L.style.setProperty('--edge', e > 0 && e < 1 ? 1 : 0);
      }
      L.style.setProperty('--z', (1.08 - 0.08 * e).toFixed(4));
      const near = r.top < innerHeight * 2 && r.bottom > -innerHeight;
      if (near && k <= base + 1) prepVideo(L);
      if (near) showLayer(L, inView && (k === base || (k === base + 1 && e > 0)));
    });
    setStep(Math.min(N - 1, Math.floor(s + WIPE / 2)));
  }
  const kick = () => { if (raf === null) raf = requestAnimationFrame(tickRoute); };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick); kick();

  /* quick entry + hints -> квиз */
  const q = $('#q'), model = $('[data-model]');
  $$('.hints button').forEach(b => b.addEventListener('click', () => { q.value = b.dataset.hint; q.focus(); }));
  $('[data-quick]').addEventListener('submit', e => {
    e.preventDefault();
    if (q.value.trim()) model.value = q.value.trim();
    updatePlate(); scrollToEl($('#quiz'));
  });

  /* quiz */
  const form = $('[data-quiz]'), trackEl = $('[data-qz-track]'), bar = $('[data-qz-bar]');
  const back = $('[data-qz-back]'), next = $('[data-qz-next]'), plate = $('[data-plate]');
  const vp = $('.qz__viewport', form), qsteps = $$('.qz__step', form);
  const data = { channel: 'Telegram' };
  let step = 0;
  $$('.qz__opts', form).forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', g).forEach(x => x.classList.toggle('is-on', x === b));
    data[g.dataset.name] = b.textContent.trim();
    updatePlate();
    if (g.dataset.name !== 'channel' && step < 3) setTimeout(() => go(step + 1), 260);
  }));
  model.addEventListener('input', updatePlate);
  function updatePlate() {
    const parts = [model.value.trim() || data.type, data.budget, data.from].filter(Boolean);
    plate.textContent = parts.length ? parts.join(' · ') : 'Ваш запрос';
  }
  function valid(s) {
    if (s === 0) return !!(data.type || model.value.trim());
    if (s === 1) return !!data.budget;
    if (s === 2) return !!data.from;
    if (s === 3) return $('[name=phone]', form).value.replace(/\D/g, '').length >= 9;
    return true;
  }
  function go(s) {
    step = Math.max(0, Math.min(4, s));
    trackEl.style.transform = `translateX(${-100 * step}%)`;
    fitQuiz();
    bar.style.width = `${Math.min(100, (step + 1) * 25)}%`;
    back.style.visibility = step > 0 && step < 4 ? 'visible' : 'hidden';
    next.textContent = step === 3 ? 'Отправить заявку' : 'Дальше';
    next.style.display = step === 4 ? 'none' : '';
    $('.qz__nav', form).style.display = step === 4 ? 'none' : '';
    const f = $$('.qz__step', form)[step].querySelector('input'); if (f && step === 3) setTimeout(() => f.focus({ preventScroll: true }), 400);
  }
  next.addEventListener('click', () => {
    if (!valid(step)) { window.gsap?.fromTo(next, { x: -6 }, { x: 0, duration: .4, ease: 'elastic.out(1,.3)' }); next.textContent = step === 3 ? 'Укажите телефон' : 'Выберите вариант'; setTimeout(() => go(step), 1200); return; }
    go(step + 1);
    if (step === 4) setTimeout(() => scrollToEl(form), 350);  // показать «Заявка у нас», а не середину карточки
  });
  back.addEventListener('click', () => go(step - 1));
  form.addEventListener('submit', e => e.preventDefault());
  let qzT = null;
  function fitQuiz() {
    vp.style.height = qsteps[step].offsetHeight + 'px';
    /* высота страницы поменялась — пересчитать точки появления блоков ниже */
    clearTimeout(qzT); qzT = setTimeout(() => window.ScrollTrigger && ScrollTrigger.refresh(), 500);
  }
  addEventListener('resize', fitQuiz);
  go(0);
})();
