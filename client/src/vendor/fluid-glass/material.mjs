/* Adapted from huaixuanhu/My-design-system-collection, adc4f29fc8c471de49bfc7c08ccda8fe7a698868, systems/fluid-glass/project/components. See SOURCE.md. */
/* 玻璃流体材质 · fluid-glass.js（可选的普通脚本，不依赖框架）。
   没有它时组件是第 0 级：纯 CSS，玻璃身体用 backdrop-filter 模糊，边由内阴影近似。
   有它时按浏览器和背景升到第 1 级：Chromium 用 backdrop-filter: url() 直接折射活的背景；别的浏览器在背景已知（宿主标了 data-fg-env）时
   用环境副本折射。另外负责：按下从指尖发光并传到同组、菜单显形、珍珠在分段里滑动、透明度滑块、副本模式下量背后的明暗。
   用法：引入 fluid-glass.js 后调 FluidGlass.init()；之后加进页面的玻璃调 FluidGlass.scan()。 */
export const FluidGlass = (() => {
  const global = window;
  'use strict';
  const doc = document, root = doc.documentElement, SVG = 'http://www.w3.org/2000/svg';
  const N_GLASS = 1.5, PAD = 24;
  const TIERS = { thin: { w: 8, Th: 6, d: 5, blur: 6 }, mid: { w: 16, Th: 14, d: 11, blur: 10 }, thick: { w: 20, Th: 18, d: 14, blur: 16 } };
  const LIMITS = { thin: 64, mid: 220 };
  const FOG = { k0: .25, k1: 1.8, k2: 2.5, high: .75, std: .5 };
  const LIGHT = { phi: Math.PI * 1.25, key: 80, fill: 48 };
  const TIMING = { mouse: { in: 160, spread: 420, out: 360, press: 140, release: 460, hold: 170 }, touch: { in: 240, spread: 650, out: 560, press: 170, release: 560, hold: 240 } };
  const MAT = { open: 380, close: 300 };
  const motionMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const transMQ = matchMedia('(prefers-reduced-transparency: reduce)');
  const isChromium = !!(navigator.userAgentData && navigator.userAgentData.brands && navigator.userAgentData.brands.some((b) => /Chromium/i.test(b.brand)));
  const canBackdropUrl = isChromium && typeof CSS !== 'undefined' && (CSS.supports('backdrop-filter', 'url(#fg)') || CSS.supports('-webkit-backdrop-filter', 'url(#fg)'));
  let mode = 'none', fog = 0, inited = false;
  const lensEls = [];

  /* 从 tokens（CSS 变量）读数：几何、模糊、时长，tokens.json 仍是唯一的来源 */
  function readTokens() {
    const cs = getComputedStyle(root);
    const num = (n, fb) => { const v = parseFloat(cs.getPropertyValue(n)); return isNaN(v) ? fb : v; };
    for (const t of ['thin', 'mid', 'thick']) TIERS[t] = { w: num(`--fgs-lens-${t}-w`, TIERS[t].w), Th: num(`--fgs-lens-${t}-th`, TIERS[t].Th), d: num(`--fgs-lens-${t}-d`, TIERS[t].d), blur: num(`--fgs-blur-${t}`, TIERS[t].blur) };
    LIMITS.thin = num('--fgs-lens-thin-max', LIMITS.thin); LIMITS.mid = num('--fgs-lens-mid-max', LIMITS.mid);
    FOG.k0 = num('--fgs-blur-fog-0', FOG.k0); FOG.k1 = num('--fgs-blur-fog-1', FOG.k1); FOG.k2 = num('--fgs-blur-fog-2', FOG.k2);
    LIGHT.phi = num('--fgs-lens-light', 225) * Math.PI / 180; LIGHT.key = num('--fgs-lens-key', LIGHT.key); LIGHT.fill = num('--fgs-lens-fill', LIGHT.fill);
    for (const p of ['mouse', 'touch']) for (const k of ['in', 'spread', 'out', 'press', 'release', 'hold']) TIMING[p][k] = num(`--fgs-dur-${k}-${p}`, TIMING[p][k]);
    MAT.open = num('--fgs-dur-materialize', MAT.open); MAT.close = num('--fgs-dur-dematerialize', MAT.close);
  }

  /* ---------- 贴图：按形状（圆角矩形的距离场）生成位移图、菲涅耳反光和发丝亮线 ----------
     剖面取方形圆弧 y = (1-(1-x)^4)^(1/4)，法线由导数来，按折射定律算出边上每一处的横向偏移；偏移只落在斜面里，到内沿归零 */
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const lightVec = (phi) => norm([Math.cos(phi) * 0.85, Math.sin(phi) * 0.85, 0.55]);
  const blinn = (N, Lv, e) => { const Hh = norm([Lv[0], Lv[1], Lv[2] + 1]); const d = N[0] * Hh[0] + N[1] * Hh[1] + N[2] * Hh[2]; return d > 0 ? Math.pow(d, e) : 0; };
  function profile(x) { const k = 1 - x; const inner = 1 - k * k * k * k; return { y: Math.pow(inner, 0.25), yp: inner > 1e-9 ? k * k * k * Math.pow(inner, -0.75) : 1e6 }; }
  function snellAt(x, G, w) {
    const { y, yp } = profile(clamp01(x));
    const theta = Math.min(Math.atan(G.Th * yp / w), 89.5 * Math.PI / 180);
    const thetaT = Math.asin(Math.sin(theta) / N_GLASS);
    const delta = theta - thetaT;
    const sinOut = N_GLASS * Math.sin(delta);
    const tir = sinOut >= 1;
    const deltaOut = tir ? Math.asin(0.999) : Math.asin(sinOut);
    return { theta, shift: G.Th * y * Math.tan(delta) + G.d * Math.tan(deltaOut), tir };
  }
  const mkImg = (cw, ch, fn) => {
    const c = doc.createElement('canvas'); c.width = cw; c.height = ch;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(cw, ch); const d = img.data;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const i = (y * cw + x) * 4; const v = fn(x, y); d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = v[3]; }
    ctx.putImageData(img, 0, 0); return c.toDataURL();
  };
  function makeMaps(W, H, R, G, pad) {
    const PW = W + 2 * pad, PH = H + 2 * pad, S = 2;
    const hx = W / 2, hy = H / 2;
    const w = Math.min(G.w, R * 0.8);
    const geo = (px, py) => {
      const x = px - pad - hx, y = py - pad - hy;
      const qx = Math.abs(x) - (hx - R), qy = Math.abs(y) - (hy - R);
      const mx = Math.max(qx, 0), my = Math.max(qy, 0);
      const ol = Math.hypot(mx, my);
      const sd = ol + Math.min(Math.max(qx, qy), 0) - R;
      let nx, ny;
      if (qx > 0 || qy > 0) { nx = ol > 1e-6 ? (mx / ol) * (x < 0 ? -1 : 1) : 0; ny = ol > 1e-6 ? (my / ol) * (y < 0 ? -1 : 1) : 0; }
      else if (qx > qy) { nx = x < 0 ? -1 : 1; ny = 0; } else { nx = 0; ny = y < 0 ? -1 : 1; }
      return { nx, ny, s: -sd, inside: sd <= 0 };
    };
    let amax = 0; for (let i = 0; i <= 200; i++) amax = Math.max(amax, Math.min(snellAt(i / 200, G, w).shift, w));
    const q2 = (px, py) => { const q = geo(px, py); const edge = q.inside && q.s < w; const x = clamp01(q.s / w); const sn = edge ? snellAt(x, G, w) : { theta: 0, shift: 0, tir: false }; return { nx: q.nx, ny: q.ny, inside: q.inside, edge, theta: sn.theta, a: Math.min(sn.shift, w) / amax, tir: sn.tir }; };
    const out = { scale: 2 * amax, PW, PH };
    out.disp = mkImg(PW, PH, (x, y) => { const q = q2(x + .5, y + .5); return [128 - q.nx * q.a * 127, 128 - q.ny * q.a * 127, 0, 255]; });
    const Lv = lightVec(LIGHT.phi), L2 = lightVec(LIGHT.phi + Math.PI);
    out.hi = mkImg(W * S, H * S, (x, y) => {
      const q = q2((x + .5) / S + pad, (y + .5) / S + pad); if (!q.edge) return [255, 255, 255, 0];
      const st = Math.sin(q.theta), ct = Math.cos(q.theta); const N = [q.nx * st, q.ny * st, ct];
      const a = blinn(N, Lv, LIGHT.key) * 1.25 + blinn(N, L2, LIGHT.fill) * 0.28;
      return [255, 255, 255, Math.round(Math.min(1, a) * 255)]; });
    const sky = rgbVar('--fgs-reflect-sky', [255, 255, 255]), ground = rgbVar('--fgs-reflect-ground', [120, 128, 142]);
    out.rf = mkImg(W * S, H * S, (x, y) => {
      const q = q2((x + .5) / S + pad, (y + .5) / S + pad); if (!q.edge) return [0, 0, 0, 0];
      const ct = Math.cos(q.theta); let Rf = 0.04 + 0.96 * Math.pow(1 - ct, 5); if (q.tir) Rf = 1;
      const wSky = clamp01(0.5 + 0.5 * (-(q.nx + q.ny) * 0.7071));
      return [ground[0] + (sky[0] - ground[0]) * wSky, ground[1] + (sky[1] - ground[1]) * wSky, ground[2] + (sky[2] - ground[2]) * wSky, Math.round(Math.min(1, Rf * 0.95) * 255)]; });
    return out;
  }
  /* 读 token 颜色：十六进制（3、4、6、8 位）或 rgb()/rgba()，返回 [r, g, b] */
  function parseColor(str, fb) {
    const v = (str || '').trim();
    let m = v.match(/^#([0-9a-f]{3,8})$/i);
    if (m) { const h = m[1]; if (h.length < 6) return [0, 1, 2].map((i) => parseInt(h[i] + h[i], 16)); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
    m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (m) return [+m[1], +m[2], +m[3]];
    return fb;
  }
  function rgbVar(name, fb) { return parseColor(getComputedStyle(root).getPropertyValue(name), fb); }

  /* 滤镜只有三步：模糊 → 位移图 → 弯折。模糊在弯折之前，边带弯的是模糊后的底。每个尺寸两份：-r 常规、-c 清 */
  function ensureDefs() {
    let d = doc.getElementById('fg-defs');
    if (!d) { d = doc.createElementNS(SVG, 'svg'); d.id = 'fg-defs'; d.setAttribute('class', 'fg-defs'); d.setAttribute('aria-hidden', 'true'); d.setAttribute('focusable', 'false'); doc.body.prepend(d); }
    return d;
  }
  const cache = new Map();
  /* 透明度四档，标准在中间：0 透明、.5 标准、.75 加雾、1 近实色；模糊倍数各段线性。清变体的模糊从 .5 到 .75 长到常规的量 */
  function fogK(f) { const f1 = Math.min(f / .5, 1), f2 = Math.min(Math.max((f - .5) / .25, 0), 1), f3 = Math.max((f - .75) / .25, 0); const r = FOG.k0 + (1 - FOG.k0) * f1 + (FOG.k1 - 1) * f2 + (FOG.k2 - FOG.k1) * f3; return { r, c: r * f2 }; }
  const effFog = () => Math.max(fog, transMQ.matches ? FOG.high : 0);
  function filtersFor(key, m, G) {
    const k = fogK(effFog());
    const one = (id, blur) => `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="${blur.toFixed(2)}" result="src"/><feImage href="${m.disp}" x="0" y="0" width="${m.PW}" height="${m.PH}" preserveAspectRatio="none" result="m"/><feDisplacementMap in="src" in2="m" scale="${m.scale.toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
    return one(`fg-${key}-r`, G.blur * k.r) + one(`fg-${key}-c`, G.blur * k.c);
  }
  function ensureMaps(tier, W, H, R, pad, uniq) {
    const key = `${tier}-${W}x${H}-r${Math.round(R)}-p${pad}${uniq ? '-' + uniq : ''}`;
    if (!cache.has(key)) {
      const m = makeMaps(W, H, R, TIERS[tier], pad);
      ensureDefs().insertAdjacentHTML('beforeend', filtersFor(key, m, TIERS[tier]));
      cache.set(key, { key, tier, hi: `url(${m.hi})`, rf: `url(${m.rf})` });
    }
    return cache.get(key);
  }
  const radiusOf = (el, W, H) => {
    const v = getComputedStyle(el).borderRadius.split(' ')[0];
    const m = Math.min(W, H) / 2;
    if (v.endsWith('%')) return Math.min(m, Math.min(W, H) * parseFloat(v) / 100);
    return Math.min(m, parseFloat(v) || m);
  };
  const isClear = (el) => el.classList.contains('fg-glass--clear') || !!el.closest('[data-fg-variant="clear"]');
  function applyFilter(el) {
    if (!el._fgKey) return;
    const id = `fg-${el._fgKey}-${isClear(el) && effFog() < FOG.high ? 'c' : 'r'}`;
    el.dataset.fgFilter = id;
    if (mode === 'backdrop') { const l = el.querySelector(':scope > .fg-glass__lens'); if (l) { l.style.webkitBackdropFilter = `url(#${id})`; l.style.backdropFilter = `url(#${id})`; } }
    else { const f = el.querySelector(':scope > .fg-glass__lens > .fg-glass__f'); if (f) f.style.filter = `url(#${id})`; }
  }

  /* ---------- 环境副本：宿主标 data-fg-env（空值 = 用宿主自己的背景图；或直接给图的地址，按 cover 铺满宿主） ---------- */
  const imgCache = new Map();
  function loadImage(url, cb) {
    if (imgCache.has(url)) { const im = imgCache.get(url); if (im.complete) cb(im); else im.addEventListener('load', () => cb(im)); return; }
    const im = new Image(); imgCache.set(url, im); im.addEventListener('load', () => cb(im)); im.src = url;
  }
  function envOf(host) {
    if (host._fgEnv) return host._fgEnv;
    const hr = host.getBoundingClientRect(); const hw = hr.width, hh = hr.height;
    const attr = (host.getAttribute('data-fg-env') || '').trim();
    const cs = getComputedStyle(host);
    let image = attr ? (attr.startsWith('url(') ? attr : `url("${attr}")`) : cs.backgroundImage.split(/,(?![^(]*\))/)[0].trim();
    const url = (image.match(/url\(["']?([^"')]+)["']?\)/) || [])[1];
    const env = { image, w: hw, h: hh, x: 0, y: 0, url, ready: !url };
    const finish = (im) => {
      const nw = im.naturalWidth || hw, nh = im.naturalHeight || hh;
      let w = hw, h = hh, x = 0, y = 0;
      const size = attr ? 'cover' : cs.backgroundSize.split(',')[0].trim();
      if (size === 'cover' || size === 'contain') { const s = (size === 'cover' ? Math.max : Math.min)(hw / nw, hh / nh); w = nw * s; h = nh * s; }
      else if (size === 'auto' || size === 'auto auto') { w = nw; h = nh; }
      else { const [sw, sh] = size.split(' '); const px = (v, ref, nat) => v === undefined || v === 'auto' ? null : v.endsWith('%') ? ref * parseFloat(v) / 100 : parseFloat(v); const pw = px(sw, hw, nw), ph = px(sh, hh, nh); w = pw != null ? pw : (ph != null ? nw * ph / nh : nw); h = ph != null ? ph : (pw != null ? nh * pw / nw : nh); }
      const pos = attr ? '50% 50%' : cs.backgroundPosition.split(',')[0].trim();
      const [p1, p2] = pos.split(' ');
      const off = (v, room) => v === undefined ? 0 : v.endsWith('%') ? room * parseFloat(v) / 100 : parseFloat(v) || 0;
      x = off(p1, hw - w); y = off(p2 || p1, hh - h);
      Object.assign(env, { w, h, x, y, ready: true });
      host.querySelectorAll('.fg-glass[data-fg-lens]').forEach(update);
      sampleHost(host);
    };
    host._fgEnv = env;  /* 先缓存再加载：图已在缓存里时 finish 会同步跑，里面的 update 会重进 envOf */
    if (url) loadImage(url, finish);
    return env;
  }
  /* 副本模式下量小控件背后的明暗和花不花（同源的图才能量；量不到就不标） */
  function sampleHost(host) {
    const env = host._fgEnv; if (!env || !env.ready || !env.url) return;
    loadImage(env.url, (im) => {
      const hr = host.getBoundingClientRect(); const k = Math.min(1, 600 / Math.max(hr.width, 1));
      const cv = doc.createElement('canvas'); cv.width = Math.max(1, Math.round(hr.width * k)); cv.height = Math.max(1, Math.round(hr.height * k));
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = getComputedStyle(host).backgroundColor; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(im, env.x * k, env.y * k, env.w * k, env.h * k);
      for (const el of host.querySelectorAll('.fg-glass')) {
        if (el.dataset.fgThick !== 'thin' || el.hasAttribute('data-fg-on-fixed')) continue;
        const r = el.getBoundingClientRect();
        const x = Math.max(0, Math.round((r.left - hr.left) * k)), y = Math.max(0, Math.round((r.top - hr.top) * k));
        const w = Math.min(cv.width - x, Math.round(r.width * k)), h = Math.min(cv.height - y, Math.round(r.height * k));
        if (w < 2 || h < 2) continue;
        let d; try { d = ctx.getImageData(x, y, w, h).data; } catch (e) { return; }
        let n = 0, s = 0, s2 = 0;
        for (let i = 0; i < d.length; i += 12) { const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; s += l; s2 += l * l; n++; }
        const mean = s / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
        el.dataset.fgOn = mean < ADAPT.lum ? 'dark' : 'light';
        el.dataset.fgUnder = sd > ADAPT.busy ? 'busy' : 'plain';
      }
    });
  }
  const ADAPT = { lum: .5, busy: .04 };

  /* ---------- 每件玻璃：插层、量尺寸定档、挂滤镜 ---------- */
  /* 可以反复调：第一次插发光层；副本模式下宿主后来才标上 data-fg-env 时（比如场景画完才有环境），再补折射层 */
  function setup(el) {
    if (!el.dataset.fgReady) { el.dataset.fgReady = '1'; el.insertAdjacentHTML('afterbegin', '<span class="fg-glass__glow" aria-hidden="true"><i></i></span>'); }
    const host = el.closest('[data-fg-env]');
    const useLens = el.dataset.fgLensOff === undefined && (mode === 'backdrop' || (mode === 'copy' && host));
    if (useLens && !el.hasAttribute('data-fg-lens')) {
      el.insertAdjacentHTML('afterbegin', (mode === 'backdrop'
        ? '<span class="fg-glass__flat" aria-hidden="true"></span><span class="fg-glass__lens" aria-hidden="true"></span>'
        : '<span class="fg-glass__flat" aria-hidden="true"><i></i></span><span class="fg-glass__lens" aria-hidden="true"><span class="fg-glass__f"><i></i></span></span>')
        + '<span class="fg-glass__rf" aria-hidden="true"></span><span class="fg-glass__hi" aria-hidden="true"></span>');
      el.setAttribute('data-fg-lens', mode); lensEls.push(el);
    }
    update(el);
  }
  function update(el) {
    const r = el.getBoundingClientRect(); const W = Math.round(el.offsetWidth), H = Math.round(el.offsetHeight);
    if (!W || !H) return;
    const tier = el.dataset.fgTier || (H <= LIMITS.thin ? 'thin' : H <= LIMITS.mid ? 'mid' : 'thick');
    el.dataset.fgThick = tier;
    if (!el.hasAttribute('data-fg-lens')) return;
    const R = radiusOf(el, W, H);
    const pad = mode === 'backdrop' ? 0 : PAD;
    const m = ensureMaps(tier, W, H, R, pad, el.dataset.fgUniq || '');
    el.style.setProperty('--fg-hi', m.hi); el.style.setProperty('--fg-rf', m.rf);
    el._fgKey = m.key;
    if (mode === 'copy') {
      const host = el.closest('[data-fg-env]'); const hr = host.getBoundingClientRect(); const env = envOf(host);
      el.style.setProperty('--fg-env', env.image);
      el.style.setProperty('--fg-ew', env.w.toFixed(1) + 'px'); el.style.setProperty('--fg-eh', env.h.toFixed(1) + 'px');
      el.style.setProperty('--fg-ox', (r.left - hr.left - env.x).toFixed(1) + 'px'); el.style.setProperty('--fg-oy', (r.top - hr.top - env.y).toFixed(1) + 'px');
      /* 缩放中心：副本的反向缩放要绕玻璃自己的缩放中心（副本的盒子比玻璃大一圈） */
      const to = getComputedStyle(el).transformOrigin.split(' ');
      el.style.setProperty('--fg-o-x', (parseFloat(to[0]) + PAD).toFixed(1) + 'px'); el.style.setProperty('--fg-o-y', (parseFloat(to[1]) + PAD).toFixed(1) + 'px');
    }
    applyFilter(el);
  }
  function scan(scope) {
    (scope || doc).querySelectorAll('.fg-glass').forEach(setup);
    if (mode === 'copy') doc.querySelectorAll('[data-fg-env]').forEach(sampleHost);
  }
  function refresh() {
    if (mode === 'copy') doc.querySelectorAll('[data-fg-env]').forEach((h) => { h._fgEnv = null; });
    doc.querySelectorAll('.fg-glass[data-fg-ready]').forEach(update);
    if (mode === 'copy') doc.querySelectorAll('[data-fg-env]').forEach(sampleHost);
    doc.querySelectorAll('.fg-group').forEach(placePearl);
  }

  /* ---------- 透明度滑块：0 透明、.5 标准、.75 加雾、1 近实色 ---------- */
  function setFog(v) {
    fog = clamp01(+v || 0);
    root.style.setProperty('--fg-fog', fog.toFixed(3));
    applyFog();
    doc.querySelectorAll('input[data-fg-fog]').forEach((s) => { const max = +s.max || 100; if (Math.abs(+s.value / max - fog) > 1e-6) s.value = Math.round(fog * max); paintRange(s); });
  }
  function applyFog() {
    const f = effFog(), k = fogK(f);
    if (f >= FOG.high) root.setAttribute('data-fg-fog-high', ''); else root.removeAttribute('data-fg-fog-high');
    for (const { key, tier } of cache.values()) {
      const G = TIERS[tier];
      for (const [suffix, kk] of [['r', k.r], ['c', k.c]]) { const b = doc.querySelector(`#fg-${key}-${suffix} feGaussianBlur`); if (b) b.setAttribute('stdDeviation', (G.blur * kk).toFixed(2)); }
    }
    lensEls.forEach(applyFilter);
  }
  function paintRange(s) { const min = +s.min || 0, max = +s.max || 100; s.style.setProperty('--fg-p', ((+s.value - min) / (max - min) * 100).toFixed(1) + '%'); }

  /* ---------- 运动：按下从指尖发光并传到同组（.fg-cluster），松手弹回；鼠标短促、触屏慢软，按得再快也让亮起走完 ---------- */
  const setGlow = (el, cx, cy) => { const r = el.getBoundingClientRect(); el.style.setProperty('--fg-px', ((cx - r.left) / r.width * 100).toFixed(1) + '%'); el.style.setProperty('--fg-py', ((cy - r.top) / r.height * 100).toFixed(1) + '%'); };
  const applyTiming = (el, tm) => { for (const k of ['in', 'spread', 'out', 'press', 'release']) el.style.setProperty('--fg-t-' + k, tm[k] + 'ms'); };
  let pressed = null, near = [], pressT0 = 0, pressTiming = TIMING.mouse, releaseTimer = null;
  const doRelease = () => { clearTimeout(releaseTimer); releaseTimer = null; if (!pressed) return; pressed.classList.remove('is-pressed'); near.forEach((n) => n.classList.remove('is-near')); pressed = null; near = []; };
  const release = () => { if (!pressed || releaseTimer) return; releaseTimer = setTimeout(doRelease, Math.max(0, pressTiming.hold - (performance.now() - pressT0))); };
  function onPointerDown(e) {
    if (e.button && e.button !== 0) return;
    const el = e.target.closest('.fg-glass');
    if (!el || el.disabled || el.hasAttribute('inert') || el.classList.contains('fg-glass--static') || el.closest('[data-fg-press="off"]')) return;
    doRelease();
    pressTiming = e.pointerType === 'mouse' ? TIMING.mouse : TIMING.touch;
    applyTiming(el, pressTiming);
    setGlow(el, e.clientX, e.clientY);
    el.classList.add('is-pressed');
    pressed = el; pressT0 = performance.now();
    const grp = el.closest('.fg-cluster');
    if (grp) for (const n of grp.querySelectorAll('.fg-glass')) if (n !== el && !n.contains(el) && !el.contains(n)) { applyTiming(n, pressTiming); setGlow(n, e.clientX, e.clientY); n.classList.add('is-near'); near.push(n); }
  }

  /* ---------- 菜单：显形和消失只切一个类，过渡在 CSS 里 ---------- */
  const matMs = (ms) => (motionMQ.matches ? 1 : ms);
  function menu(menuEl, btn, opts) {
    opts = opts || {};
    let open = false, busy = false, timer = null;
    if (!menuEl.dataset.fgUniq) menuEl.dataset.fgUniq = 'menu-' + Math.random().toString(36).slice(2, 7);
    const api = {
      get isOpen() { return open; },
      open(byKeyboard) {
        if (open || busy) return; open = true; busy = true; clearTimeout(timer);
        menuEl.hidden = false; menuEl.classList.add('is-closed');
        if (!menuEl.dataset.fgReady) setup(menuEl); else update(menuEl);
        void menuEl.offsetWidth; menuEl.classList.remove('is-closed');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        timer = setTimeout(() => { busy = false; }, matMs(MAT.open));
        if (byKeyboard) { const f = menuEl.querySelector('.fg-menu__item'); if (f) f.focus({ preventScroll: true }); }
      },
      close(refocus) {
        if (!open || busy) return; open = false; busy = true; clearTimeout(timer);
        menuEl.classList.add('is-closed');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        timer = setTimeout(() => { menuEl.hidden = true; busy = false; if (refocus && btn) btn.focus({ preventScroll: true }); }, matMs(MAT.close));
      },
      toggle(byKeyboard) { open ? api.close(true) : api.open(byKeyboard); }
    };
    if (btn) btn.addEventListener('click', (e) => api.toggle(e.detail === 0));
    if (opts.closeOnSelect !== false) menuEl.querySelectorAll('.fg-menu__item').forEach((it) => it.addEventListener('click', () => api.close(true)));
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) api.close(true); });
    doc.addEventListener('pointerdown', (e) => { if (open && !menuEl.contains(e.target) && !(btn && (e.target === btn || btn.contains(e.target)))) api.close(false); });
    /* 预热：页面空下来时先把贴图和滤镜算好，第一次打开不卡 */
    setTimeout(() => { if (menuEl.hidden && !open) { menuEl.style.visibility = 'hidden'; menuEl.hidden = false; if (!menuEl.dataset.fgReady) setup(menuEl); else update(menuEl); menuEl.hidden = true; menuEl.style.visibility = ''; } }, 700);
    return api;
  }

  /* ---------- 滑动的珍珠：.fg-group 里的 .fg-slide 停在选中项下面 ---------- */
  function checkedOf(group) {
    const inp = group.querySelector('input:checked'); if (inp) return inp.closest('.fg-seg__opt') || inp.parentElement;
    return group.querySelector('[role="radio"][aria-checked="true"], [aria-selected="true"]');
  }
  function placePearl(group) {
    const pearl = group.querySelector(':scope > .fg-slide'); const on = checkedOf(group);
    if (!pearl || !on) return;
    const gr = group.getBoundingClientRect(), r = on.getBoundingClientRect();
    group.style.setProperty('--fg-pxl', (r.left - gr.left).toFixed(1) + 'px'); group.style.setProperty('--fg-pw', r.width.toFixed(1) + 'px');
    if (!group.classList.contains('is-ready')) requestAnimationFrame(() => group.classList.add('is-ready'));
  }
  function bindGroup(group) {
    if (group.dataset.fgGroup) return; group.dataset.fgGroup = '1';  /* 和玻璃的 fgReady 分开：分段开关既是玻璃又是组 */
    group.addEventListener('change', () => placePearl(group));
    const radios = [...group.querySelectorAll('[role="radio"]')];
    radios.forEach((b, i) => {
      b.addEventListener('click', () => { radios.forEach((o) => { o.setAttribute('aria-checked', o === b ? 'true' : 'false'); o.tabIndex = o === b ? 0 : -1; }); placePearl(group); group.dispatchEvent(new CustomEvent('fg-change', { bubbles: true, detail: { value: b.dataset.value || b.textContent.trim() } })); });
      b.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!d) return; e.preventDefault(); const n = radios[(i + d + radios.length) % radios.length]; n.focus(); n.click(); });
    });
    placePearl(group);
  }

  /* ---------- 入口 ---------- */
  function init(options) {
    options = options || {};
    if (inited) { scan(); return api; }
    inited = true;
    readTokens();
    mode = options.mode && options.mode !== 'auto' ? options.mode : (canBackdropUrl ? 'backdrop' : (doc.querySelector('[data-fg-env]') ? 'copy' : 'none'));
    if (mode === 'backdrop' && !canBackdropUrl) mode = doc.querySelector('[data-fg-env]') ? 'copy' : 'none';
    root.setAttribute('data-fg-js', ''); root.setAttribute('data-fg-mode', mode);
    if (isChromium) root.setAttribute('data-fg-engine', 'chromium');
    const cs = getComputedStyle(root);
    ADAPT.lum = parseFloat(cs.getPropertyValue('--fgs-adapt-lum')) || ADAPT.lum; ADAPT.busy = parseFloat(cs.getPropertyValue('--fgs-adapt-busy')) || ADAPT.busy;
    const cssFog = parseFloat(cs.getPropertyValue('--fg-fog'));
    fog = clamp01(options.fog !== undefined ? +options.fog : (isNaN(cssFog) ? FOG.std : cssFog));
    scan();
    setFog(fog);
    doc.addEventListener('pointerdown', onPointerDown);
    doc.addEventListener('pointerup', release); doc.addEventListener('pointercancel', release); global.addEventListener('blur', doRelease);
    doc.querySelectorAll('.fg-group').forEach(bindGroup);
    doc.querySelectorAll('input[data-fg-fog]').forEach((s) => { s.addEventListener('input', () => setFog(+s.value / (+s.max || 100))); paintRange(s); });
    doc.querySelectorAll('.fg-slider').forEach((s) => { paintRange(s); s.addEventListener('input', () => paintRange(s)); });
    transMQ.addEventListener('change', applyFog);
    let rt = null; global.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => api.refresh(), 120); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => api.refresh());
    /* 在 init 之前就画过的场景按现在的模式重画一遍（副本模式下这一遍才会把画交给玻璃） */
    if (api.redrawScenes) api.redrawScenes();
    return api;
  }
  const api = { init, scan, refresh, refreshGlass: refresh, update, setFog, parseColor, get fog() { return fog; }, get mode() { return mode; }, menu, placePearl, bindGroup, TIERS };
  return api;
})();


