'use strict';
/* Mercaz Chabad — case design studio (preview only).
   One state object drives both the on-screen preview and the PNG export,
   so what you save is what you see. CSP-safe: no inline styles/scripts,
   images only from this origin, Supabase or data: URLs. */
(() => {
const BASE = 'https://bdalhyqpruefdbyirykp.supabase.co';
const KEY = 'sb_publishable_K6ciGUejNpRfLeIEc598Iw_L3VoMJYM';
const WHATSAPP = '972533770073';
const STORE_KEY = 'mercaz-case-studio-v2';
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10);

const MODELS = {
  iPhone: ['15', '15 Plus', '15 Pro', '15 Pro Max', '16', '16 Plus', '16 Pro', '16 Pro Max', '17', '17 Pro', '17 Pro Max'],
  Samsung: ['S23', 'S23+', 'S23 Ultra', 'S24', 'S24+', 'S24 Ultra', 'S25', 'S25+', 'S25 Ultra']
};
const BRANDS = [{ id: 'iPhone', name: 'iPhone', prefix: 'iPhone ' }, { id: 'Samsung', name: 'Samsung Galaxy', prefix: 'Galaxy ' }];
const COLORS = [
  { id: 'black', name: 'שחור', hex: '#17181c' }, { id: 'white', name: 'לבן', hex: '#f3f1ec' },
  { id: 'clear', name: 'שקוף', hex: null }, { id: 'navy', name: 'כחול לילה', hex: '#1b2a5e' },
  { id: 'royal', name: 'כחול מלכותי', hex: '#1e45c8' }, { id: 'gold', name: 'זהב', hex: '#d6ad3b' },
  { id: 'red', name: 'אדום', hex: '#b3262e' }, { id: 'pink', name: 'ורוד', hex: '#f1b9c8' },
  { id: 'sky', name: 'תכלת', hex: '#a3cbef' }, { id: 'lilac', name: 'סגול', hex: '#b4a2dc' },
  { id: 'sand', name: 'חול', hex: '#d8c6a6' }, { id: 'graphite', name: 'אפור', hex: '#5d626c' }
];
const FINISHES = [{ id: 'matte', name: 'מט' }, { id: 'gloss', name: 'מבריק' }, { id: 'glitter', name: 'נצנצים' }];
const FONTS = [
  { id: 'sans', name: 'מודרני', css: '"Noto Sans Hebrew CMS","Segoe UI",Arial,sans-serif' },
  { id: 'serif', name: 'קלאסי', css: '"Noto Serif Hebrew CMS",Georgia,serif' },
  { id: 'rashi', name: 'רש״י', css: '"Noto Rashi Hebrew CMS",serif' }
];
const INKS = ['#ffffff', '#111111', '#ffd21f', '#1e45c8', '#0f1b4d', '#c8102e', '#f1b9c8', '#a3cbef'];
const LIMITS = { sticker: [0.1, 1.2], text: [0.05, 0.4] };

/* Camera layouts, all in case-width units: [cx, cy, diameter]. Family cues only, not tooling-accurate. */
function layout(brand, model) {
  if (brand === 'iPhone') {
    const b = { aspect: 0.487, radius: 0.17 };
    if (/^17 Pro/.test(model)) return { ...b, mod: { x: .035, y: .03, w: .93, h: .43, r: .13 }, lenses: [[.16, .135, .165], [.16, .355, .165], [.37, .245, .165]], flash: [.8, .13, .06], dots: [[.8, .33, .045]] };
    if (/Pro/.test(model)) return { ...b, mod: { x: .045, y: .035, w: .43, h: .43, r: .12 }, lenses: [[.155, .14, .165], [.155, .36, .165], [.37, .25, .165]], flash: [.37, .095, .055], dots: [[.37, .405, .04]] };
    if (/^1[67]/.test(model)) return { ...b, mod: { x: .06, y: .04, w: .22, h: .41, r: .11 }, lenses: [[.17, .145, .15], [.17, .345, .15]], flash: [.35, .13, .055], dots: [] };
    return { ...b, mod: { x: .055, y: .04, w: .37, h: .37, r: .1 }, lenses: [[.155, .14, .145], [.325, .31, .145]], flash: [.325, .12, .055], dots: [[.155, .31, .035]] };
  }
  if (/Ultra/.test(model)) return { aspect: 0.49, radius: 0.06, mod: null, lenses: [[.15, .13, .17], [.15, .32, .17], [.15, .51, .17], [.33, .13, .11], [.33, .275, .11]], flash: [.33, .39, .055], dots: [] };
  return { aspect: 0.475, radius: 0.14, mod: null, lenses: [[.15, .13, .155], [.15, .3, .155], [.15, .47, .155]], flash: [.3, .13, .055], dots: [] };
}

/* ---------- state ---------- */
const S = { brand: 'iPhone', model: '16 Pro', color: 'black', finish: 'matte', items: [] };
let sel = null, caseW = 300, catalog = [];
const textPrefs = { font: 'sans', color: '#ffffff', outline: true };
const nodes = new Map();
const display = new Map(); // original src -> background-removed data URL

const caseEl = $('case');
const colorOf = () => COLORS.find(c => c.id === S.color) || COLORS[0];
const finishOf = () => FINISHES.find(f => f.id === S.finish) || FINISHES[0];
const brandOf = () => BRANDS.find(b => b.id === S.brand) || BRANDS[0];
const fontOf = id => FONTS.find(f => f.id === id) || FONTS[0];
const itemOf = id => S.items.find(i => i.id === id);
const L = () => layout(S.brand, S.model);
const heightUnits = () => 1 / L().aspect;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255);
  return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function luminance(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
const ringColor = () => { const c = colorOf(); return c.hex ? shade(c.hex, luminance(c.hex) > .55 ? -.16 : -.35) : '#9aa6b4'; };
const strokeFor = ink => luminance(ink) > .5 ? '#0f1b4d' : '#ffffff';

/* ---------- validation & persistence ---------- */
function safeSrc(src) {
  try {
    const u = new URL(src, location.origin);
    if (!['https:', 'http:'].includes(u.protocol) || ![location.origin, BASE].includes(u.origin)) return null;
    return u.href;
  } catch { return null; }
}
function clean(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = { brand: 'iPhone', model: '16 Pro', color: 'black', finish: 'matte', items: [] };
  if (MODELS[raw.brand]) out.brand = raw.brand;
  out.model = MODELS[out.brand].includes(raw.model) ? raw.model : MODELS[out.brand][0];
  if (COLORS.some(c => c.id === raw.color)) out.color = raw.color;
  if (FINISHES.some(f => f.id === raw.finish)) out.finish = raw.finish;
  const num = (v, d) => Number.isFinite(v) ? v : d;
  for (const it of Array.isArray(raw.items) ? raw.items.slice(0, 60) : []) {
    if (!it || (it.type !== 'sticker' && it.type !== 'text')) continue;
    const base = { id: uid(), type: it.type, x: clamp(num(it.x, .5), 0, 1), y: clamp(num(it.y, 1), 0, 2.2), angle: clamp(num(it.angle, 0), -180, 180), flip: !!it.flip };
    base.size = clamp(num(it.size, .3), ...LIMITS[it.type]);
    if (it.type === 'sticker') {
      const src = safeSrc(it.src); if (!src) continue;
      Object.assign(base, { src, pid: String(it.pid || '').slice(0, 80), name: String(it.name || 'מדבקה').slice(0, 80) });
    } else {
      const text = String(it.text || '').slice(0, 32).trim(); if (!text) continue;
      Object.assign(base, { text, font: fontOf(it.font).id, color: /^#[0-9a-f]{6}$/i.test(it.color) ? it.color : '#ffffff', outline: !!it.outline });
    }
    out.items.push(base);
  }
  return out;
}
const serialize = () => JSON.stringify({ brand: S.brand, model: S.model, color: S.color, finish: S.finish, items: S.items });
function persist() { try { localStorage.setItem(STORE_KEY, serialize()); } catch { /* storage unavailable: preview still works */ } }
function loadSaved() { try { return clean(JSON.parse(localStorage.getItem(STORE_KEY) || 'null')); } catch { return null; } }

/* ---------- history ---------- */
let past = [], future = [], last = '';
function commit() {
  const now = serialize(); if (now === last) return;
  past.push(last); if (past.length > 80) past.shift(); future = []; last = now;
  persist(); syncHistory();
}
function apply(json) {
  const s = clean(JSON.parse(json)); if (!s) return;
  // keep ids stable across undo so nodes are reused
  const parsed = JSON.parse(json).items || [];
  s.items.forEach((it, i) => { if (parsed[i] && parsed[i].id) it.id = String(parsed[i].id); });
  Object.assign(S, s);
  if (!itemOf(sel)) sel = null;
  S.items.filter(i => i.type === 'sticker').forEach(i => prepare(i.src));
  persist(); syncControls(); render(); syncHistory();
}
function undo() { if (!past.length) return; future.push(last); last = past.pop(); apply(last); }
function redo() { if (!future.length) return; past.push(last); last = future.pop(); apply(last); }
function syncHistory() { $('undo').disabled = !past.length; $('redo').disabled = !future.length; }
let commitTimer = 0;
const commitSoon = () => { clearTimeout(commitTimer); commitTimer = setTimeout(commit, 350); };

/* ---------- background removal (works on a copy, never the catalogue image) ---------- */
const cutCache = new Map();
function cutout(url) {
  if (cutCache.has(url)) return cutCache.get(url);
  const job = (async () => {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.src = url; await image.decode();
    const max = 700, k = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    const w = Math.max(1, Math.round(image.naturalWidth * k)), h = Math.max(1, Math.round(image.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, w, h);
    const frame = ctx.getImageData(0, 0, w, h), d = frame.data, seen = new Uint8Array(w * h), q = new Int32Array(w * h);
    let head = 0, tail = 0;
    const white = i => { const p = i * 4; return d[p + 3] < 24 || (d[p] > 224 && d[p + 1] > 224 && d[p + 2] > 224 && Math.max(d[p], d[p + 1], d[p + 2]) - Math.min(d[p], d[p + 1], d[p + 2]) < 24); };
    const seed = i => { if (!seen[i] && white(i)) { seen[i] = 1; q[tail++] = i; } };
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (head < tail) { const i = q[head++], x = i % w, y = (i - x) / w; if (x > 0) seed(i - 1); if (x < w - 1) seed(i + 1); if (y > 0) seed(i - w); if (y < h - 1) seed(i + w); }
    if (tail < w * h * .02 || tail > w * h * .92) return url;
    for (let i = 0; i < w * h; i++) if (seen[i]) d[i * 4 + 3] = 0;
    ctx.putImageData(frame, 0, 0);
    return c.toDataURL('image/png');
  })().catch(() => url);
  cutCache.set(url, job); return job;
}
function prepare(src) {
  if (display.has(src)) return Promise.resolve();
  return cutout(src).then(d => { display.set(src, d); render(); });
}

/* ---------- rendering ---------- */
let raf = 0;
const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

function fitCase() {
  const st = $('stage'), lay = L();
  const aw = st.clientWidth - 40, ah = st.clientHeight - 64;
  caseW = Math.max(120, Math.floor(Math.min(aw * .9, ah * lay.aspect, 360)));
  const h = Math.round(caseW / lay.aspect);
  caseEl.style.width = caseW + 'px'; caseEl.style.height = h + 'px';
  caseEl.style.borderRadius = Math.round(lay.radius * caseW) + 'px';
  caseEl.style.setProperty('--W', caseW + 'px');
  caseEl.style.setProperty('--ring', ringColor());
  const c = colorOf();
  if (c.hex) caseEl.style.setProperty('--case', c.hex);
  caseEl.classList.toggle('clear', !c.hex);
  caseEl.classList.toggle('shiny', S.finish !== 'matte');
  caseEl.classList.toggle('glitter', S.finish === 'glitter');
  return lay;
}
let camKey = '';
function renderCamera(lay) {
  const key = S.brand + S.model + caseW; if (key === camKey) return; camKey = key;
  const cam = $('camera'), W = caseW; cam.replaceChildren();
  const circle = (cls, [x, y, d]) => { const e = el('div', cls); e.style.width = e.style.height = d * W + 'px'; e.style.left = (x - d / 2) * W + 'px'; e.style.top = (y - d / 2) * W + 'px'; cam.append(e); };
  if (lay.mod) { const m = el('div', 'cam-mod'); m.style.left = lay.mod.x * W + 'px'; m.style.top = lay.mod.y * W + 'px'; m.style.width = lay.mod.w * W + 'px'; m.style.height = lay.mod.h * W + 'px'; m.style.borderRadius = lay.mod.r * W + 'px'; cam.append(m); }
  lay.lenses.forEach(l => circle('lens', l));
  circle('flash', lay.flash);
  lay.dots.forEach(d => circle('dot', d));
}
function makeNode(it) {
  const n = el('div', 'item'); n.tabIndex = 0; n.dataset.id = it.id; n.setAttribute('role', 'button');
  if (it.type === 'sticker') { const img = el('img'); img.alt = ''; img.draggable = false; n.append(img); }
  else n.append(el('span', 'txt'));
  const h = el('span', 'handle'); h.setAttribute('aria-hidden', 'true'); n.append(h);
  return n;
}
function renderItems() {
  const host = $('items'), W = caseW, keep = new Set();
  S.items.forEach((it, i) => {
    let n = nodes.get(it.id);
    if (!n) { n = makeNode(it); nodes.set(it.id, n); host.append(n); }
    keep.add(it.id);
    n.style.left = it.x * W + 'px'; n.style.top = it.y * W + 'px'; n.style.zIndex = String(i + 1);
    n.style.transform = `translate(-50%,-50%) rotate(${it.angle}deg) scaleX(${it.flip ? -1 : 1})`;
    n.classList.toggle('selected', it.id === sel);
    if (it.type === 'sticker') {
      const s = it.size * W; n.style.width = n.style.height = s + 'px';
      const img = n.firstChild, src = display.get(it.src) || it.src;
      if (img.getAttribute('src') !== src) img.src = src;
      n.setAttribute('aria-label', 'מדבקה: ' + it.name + ' — חצים להזזה, Delete למחיקה');
    } else {
      const t = n.firstChild, fs = it.size * W;
      if (t.textContent !== it.text) t.textContent = it.text;
      t.style.fontFamily = fontOf(it.font).css; t.style.fontSize = fs + 'px'; t.style.color = it.color;
      n.style.setProperty('--fs', fs + 'px'); n.style.setProperty('--stroke', strokeFor(it.color));
      n.classList.toggle('outlined', it.outline);
      n.setAttribute('aria-label', 'טקסט: ' + it.text + ' — חצים להזזה, Delete למחיקה');
    }
  });
  for (const [id, n] of nodes) if (!keep.has(id)) { n.remove(); nodes.delete(id); }
}
function render() {
  const lay = fitCase();
  renderCamera(lay);
  renderItems();
  $('caption').textContent = `${brandOf().prefix}${S.model} · ${colorOf().name} · ${finishOf().name}`;
  $('colorName').textContent = colorOf().name;
  const it = itemOf(sel);
  $('seltools').hidden = !it; $('selhint').hidden = !!it;
  if (it) {
    const [a, b] = LIMITS[it.type], sz = $('size');
    sz.min = Math.round(a * 100); sz.max = Math.round(b * 100);
    if (document.activeElement !== sz) sz.value = Math.round(it.size * 100);
    if (document.activeElement !== $('angle')) $('angle').value = Math.round(it.angle);
  }
  updateCounts(); updateWhatsApp();
}

/* ---------- item operations ---------- */
function select(id) {
  sel = id; const it = itemOf(id);
  if (it && it.type === 'text') { textPrefs.font = it.font; textPrefs.color = it.color; textPrefs.outline = it.outline; $('txt').value = it.text; syncTextControls(); }
  $('addText').textContent = it && it.type === 'text' ? '+ הוסיפו עוד טקסט' : '+ הוסיפו טקסט לכיסוי';
  render();
}
function spot() { const n = S.items.length, H = heightUnits(); return { x: clamp(.5 + ((n % 3) - 1) * .16, .2, .8), y: clamp(H * .56 + ((n % 4) - 1.5) * .14, .4, H - .25) }; }
function addSticker(p, at) {
  const src = safeSrc(p.image_key); if (!src) return;
  const it = { id: uid(), type: 'sticker', pid: String(p.id), name: p.name_he || 'מדבקה', src, size: .36, angle: 0, flip: false, ...(at || spot()) };
  S.items.push(it); prepare(src); select(it.id); commit();
}
function addText() {
  const text = $('txt').value.trim().slice(0, 32);
  if (!text) { toast('כתבו טקסט קודם'); $('txt').focus(); return; }
  const H = heightUnits();
  const it = { id: uid(), type: 'text', text, font: textPrefs.font, color: textPrefs.color, outline: textPrefs.outline, size: .11, angle: 0, flip: false, x: .5, y: clamp(H * .78, .5, H - .15) };
  S.items.push(it); select(it.id); commit();
  if (matchMedia('(max-width:880px)').matches) toast('הטקסט נוסף ↑');
}
function removeSel() { const i = S.items.findIndex(x => x.id === sel); if (i < 0) return; S.items.splice(i, 1); sel = null; render(); commit(); }
function duplicate() {
  const it = itemOf(sel); if (!it) return;
  const H = heightUnits(), copy = { ...it, id: uid(), x: clamp(it.x + .07, 0, 1), y: clamp(it.y + .07, 0, H) };
  S.items.push(copy); select(copy.id); commit();
}
function move(delta) {
  const i = S.items.findIndex(x => x.id === sel); if (i < 0) return;
  const j = clamp(i + delta, 0, S.items.length - 1); if (i === j) return;
  const [it] = S.items.splice(i, 1); S.items.splice(j, 0, it); render(); commit();
}

/* ---------- direct manipulation: drag, handle, pinch, wheel, keyboard ---------- */
const pointers = new Map(); let gesture = null;
const pt = e => ({ x: e.clientX, y: e.clientY });
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
const norm = a => ((a + 540) % 360) - 180;
const snapAngle = a => { const r = Math.round(a / 45) * 45; return Math.abs(a - r) < 4 ? norm(r) : norm(a); };
function centerOf(it) { const r = caseEl.getBoundingClientRect(); return { x: r.left + it.x * caseW, y: r.top + it.y * caseW }; }
function guides(v, h) { $('guideV').classList.toggle('on', v); $('guideH').classList.toggle('on', h); }

caseEl.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const node = e.target.closest('.item');
  if (gesture && pointers.size === 1) {
    const it = itemOf(gesture.id); if (!it) return;
    pointers.set(e.pointerId, pt(e)); caseEl.setPointerCapture(e.pointerId);
    const [a, b] = [...pointers.values()];
    gesture = { type: 'pinch', id: it.id, d0: dist(a, b), a0: ang(a, b), size0: it.size, angle0: it.angle };
    e.preventDefault(); return;
  }
  if (!node) { select(null); return; }
  const it = itemOf(node.dataset.id); if (!it) return;
  if (sel !== it.id) select(it.id);
  node.focus({ preventScroll: true });
  pointers.set(e.pointerId, pt(e)); caseEl.setPointerCapture(e.pointerId);
  if (e.target.classList.contains('handle')) {
    const c = centerOf(it); gesture = { type: 'xform', id: it.id, c, r0: Math.max(8, dist(c, pt(e))), a0: ang(c, pt(e)), size0: it.size, angle0: it.angle };
  } else gesture = { type: 'drag', id: it.id, p0: pt(e), x0: it.x, y0: it.y };
  e.preventDefault();
});
caseEl.addEventListener('pointermove', e => {
  if (!gesture || !pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, pt(e));
  const it = itemOf(gesture.id); if (!it) return;
  const [lo, hi] = LIMITS[it.type];
  if (gesture.type === 'drag') {
    const H = heightUnits();
    let x = gesture.x0 + (e.clientX - gesture.p0.x) / caseW, y = gesture.y0 + (e.clientY - gesture.p0.y) / caseW;
    const sv = Math.abs(x - .5) < .025, sh = Math.abs(y - H / 2) < .025;
    if (sv) x = .5; if (sh) y = H / 2; guides(sv, sh);
    it.x = clamp(x, 0, 1); it.y = clamp(y, 0, H);
  } else if (gesture.type === 'xform') {
    const p = pt(e);
    it.size = clamp(gesture.size0 * dist(gesture.c, p) / gesture.r0, lo, hi);
    it.angle = snapAngle(gesture.angle0 + ang(gesture.c, p) - gesture.a0);
  } else if (gesture.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    it.size = clamp(gesture.size0 * dist(a, b) / Math.max(8, gesture.d0), lo, hi);
    it.angle = snapAngle(gesture.angle0 + ang(a, b) - gesture.a0);
  }
  gesture.moved = true; schedule();
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (gesture && gesture.type === 'pinch' && pointers.size === 1) { gesture = null; commit(); }
  if (!pointers.size) { if (gesture && gesture.moved) commit(); gesture = null; guides(false, false); }
}
caseEl.addEventListener('pointerup', endPointer);
caseEl.addEventListener('pointercancel', endPointer);
caseEl.addEventListener('lostpointercapture', endPointer);
caseEl.addEventListener('wheel', e => {
  const it = itemOf(sel); if (!it || !e.target.closest('.item.selected')) return;
  e.preventDefault();
  it.size = clamp(it.size * (1 - e.deltaY * .0012), ...LIMITS[it.type]); schedule(); commitSoon();
}, { passive: false });

document.addEventListener('keydown', e => {
  const typing = e.target.matches('input[type=text],input[type=search]');
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !typing && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && !typing && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  const it = itemOf(sel); if (!it || typing || !e.target.closest('#case')) {
    if (it && mod && e.key.toLowerCase() === 'd' && !typing) { e.preventDefault(); duplicate(); }
    return;
  }
  const step = e.shiftKey ? .05 : .01, H = heightUnits();
  const k = e.key;
  if (mod && k.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); removeSel(); return; }
  if (k === 'Escape') { select(null); return; }
  if (k === 'ArrowLeft') it.x = clamp(it.x - step, 0, 1);
  else if (k === 'ArrowRight') it.x = clamp(it.x + step, 0, 1);
  else if (k === 'ArrowUp') it.y = clamp(it.y - step, 0, H);
  else if (k === 'ArrowDown') it.y = clamp(it.y + step, 0, H);
  else if (k === '+' || k === '=') it.size = clamp(it.size * 1.08, ...LIMITS[it.type]);
  else if (k === '-') it.size = clamp(it.size / 1.08, ...LIMITS[it.type]);
  else if (k === ']') it.angle = norm(it.angle + 15);
  else if (k === '[') it.angle = norm(it.angle - 15);
  else return;
  e.preventDefault(); schedule(); commitSoon();
});

/* ---------- controls ---------- */
function pressed(group, value) { group.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === value))); }
function buildControls() {
  const brands = $('brands');
  BRANDS.forEach(b => { const x = el('button', '', b.name); x.type = 'button'; x.dataset.v = b.id; x.onclick = () => { if (S.brand === b.id) return; S.brand = b.id; S.model = b.id === 'iPhone' ? '16 Pro' : 'S25 Ultra'; buildModels(); syncControls(); render(); commit(); }; brands.append(x); });
  const colors = $('colors');
  COLORS.forEach(c => { const x = el('button', 'sw' + (c.hex ? '' : ' clear')); x.type = 'button'; x.dataset.v = c.id; x.title = c.name; x.setAttribute('aria-label', c.name); if (c.hex) x.style.background = c.hex; x.onclick = () => { S.color = c.id; syncControls(); render(); commit(); }; colors.append(x); });
  const fin = $('finishes');
  FINISHES.forEach(f => { const x = el('button', '', f.name); x.type = 'button'; x.dataset.v = f.id; x.onclick = () => { S.finish = f.id; syncControls(); render(); commit(); }; fin.append(x); });
  const fonts = $('fonts');
  FONTS.forEach(f => { const x = el('button'); x.type = 'button'; x.dataset.v = f.id; const b = el('b', '', 'משיח'); b.style.fontFamily = f.css; x.append(b, el('small', '', f.name)); x.onclick = () => { textPrefs.font = f.id; editText(); }; fonts.append(x); });
  const inks = $('inks');
  INKS.forEach(c => { const x = el('button', 'sw'); x.type = 'button'; x.dataset.v = c; x.style.background = c; x.setAttribute('aria-label', 'צבע ' + c); x.onclick = () => { textPrefs.color = c; editText(); }; inks.append(x); });
  buildModels();
}
function buildModels() {
  const m = $('models'); m.replaceChildren();
  MODELS[S.brand].forEach(v => { const x = el('button', 'chip', v); x.type = 'button'; x.dataset.v = v; x.setAttribute('aria-label', brandOf().prefix + v); x.onclick = () => { S.model = v; syncControls(); render(); commit(); }; m.append(x); });
}
function syncTextControls() { pressed($('fonts'), textPrefs.font); pressed($('inks'), textPrefs.color); $('outline').checked = textPrefs.outline; }
function syncControls() {
  pressed($('brands'), S.brand);
  if (!$('models').querySelector(`[data-v="${CSS.escape(S.model)}"]`)) buildModels();
  pressed($('models'), S.model); pressed($('colors'), S.color); pressed($('finishes'), S.finish);
  syncTextControls();
}
function editText() {
  syncTextControls();
  const it = itemOf(sel);
  if (it && it.type === 'text') {
    const t = $('txt').value.trim().slice(0, 32);
    if (t) it.text = t;
    Object.assign(it, { font: textPrefs.font, color: textPrefs.color, outline: textPrefs.outline });
    schedule(); commitSoon();
  }
}

/* Tabs (ARIA tabs with arrow-key support) */
const tabs = [...document.querySelectorAll('[role=tab]')];
function showTab(t, focus) {
  tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; $(x.getAttribute('aria-controls')).hidden = !on; });
  if (focus) t.focus();
}
tabs.forEach((t, i) => {
  t.onclick = () => showTab(t);
  t.onkeydown = e => { const d = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0; if (d) { e.preventDefault(); showTab(tabs[(i + d + tabs.length) % tabs.length], true); } };
});

/* ---------- sticker catalogue ---------- */
function updateCounts() {
  const counts = {}; S.items.forEach(i => { if (i.type === 'sticker') counts[i.pid] = (counts[i.pid] || 0) + 1; });
  document.querySelectorAll('.st').forEach(b => {
    let c = b.querySelector('.count'); const n = counts[b.dataset.pid] || 0;
    if (n && !c) { c = el('span', 'count'); b.append(c); }
    if (c) { if (n) c.textContent = n; else c.remove(); }
  });
}
function renderCatalog() {
  const host = $('assets'), q = $('q').value.trim();
  host.replaceChildren();
  const list = catalog.filter(p => !q || p.name_he.includes(q));
  if (!list.length) { host.append(el('p', 'empty', catalog.length ? 'לא נמצאו מדבקות לחיפוש הזה' : 'אין מדבקות זמינות כרגע')); return; }
  for (const p of list) {
    const b = el('button', 'st'); b.type = 'button'; b.dataset.pid = p.id; b.title = p.name_he;
    const img = el('img'); img.src = p.image_key; img.loading = 'lazy'; img.alt = '';
    b.append(img, el('small', '', p.name_he));
    b.setAttribute('aria-label', 'הוספת מדבקה: ' + p.name_he);
    b.onclick = () => { addSticker(p); if (matchMedia('(max-width:880px)').matches) toast('המדבקה נוספה ↑'); };
    host.append(b);
  }
  updateCounts();
}
async function loadCatalog() {
  const host = $('assets'); host.replaceChildren(...Array.from({ length: 9 }, () => el('div', 'sk')));
  try {
    const res = await fetch(BASE + '/rest/v1/mercaz_products?select=id,name_he,image_key,category,active&category=eq.PhoneStickers&active=eq.true&order=created_at.asc', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
    if (!res.ok) throw Error('HTTP ' + res.status);
    const rows = await res.json();
    catalog = (Array.isArray(rows) ? rows : []).map(p => ({ id: String(p.id), name_he: String(p.name_he || 'מדבקה'), image_key: safeSrc(p.image_key || '') })).filter(p => p.image_key);
    renderCatalog();
  } catch (e) {
    host.replaceChildren(el('p', 'empty', 'לא ניתן לטעון מדבקות כרגע'));
    $('error').textContent = 'שגיאת טעינת הקטלוג: ' + e.message;
  }
}
function surprise() {
  if (!catalog.length) { toast('המדבקות עדיין נטענות…'); return; }
  const pool = [...catalog].sort(() => Math.random() - .5).slice(0, 3), H = heightUnits();
  const spots = [{ x: .32, y: H * .55 }, { x: .68, y: H * .66 }, { x: .42, y: H * .82 }];
  pool.forEach((p, i) => {
    const src = safeSrc(p.image_key); if (!src) return;
    S.items.push({ id: uid(), type: 'sticker', pid: p.id, name: p.name_he, src, size: .3 + Math.random() * .1, angle: Math.round((Math.random() - .5) * 40), flip: false, ...spots[i] });
    prepare(src);
  });
  sel = S.items[S.items.length - 1]?.id || null; render(); commit();
}

/* ---------- export ---------- */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function loadImg(src) { return new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = no; i.src = src; }); }
async function toCanvas() {
  await Promise.all(S.items.filter(i => i.type === 'sticker').map(i => prepare(i.src)));
  await Promise.all(FONTS.map(f => document.fonts?.load(`700 40px ${f.css}`, 'משיח').catch(() => {})));
  const lay = L(), OW = 1080, OH = 1350, c = document.createElement('canvas'); c.width = OW; c.height = OH;
  const ctx = c.getContext('2d');
  const bg = ctx.createRadialGradient(OW / 2, OH * .38, 40, OW / 2, OH * .45, OH * .8);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(.45, '#eef2fa'); bg.addColorStop(1, '#d6dff0');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, OW, OH);
  const W = Math.min(OW * .56, OH * .76 * lay.aspect), H = W / lay.aspect, ox = (OW - W) / 2, oy = (OH - H) / 2 - 40, R = lay.radius * W;
  const col = colorOf();
  // shadow + body
  ctx.save(); ctx.shadowColor = 'rgba(15,27,77,.38)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 38;
  rr(ctx, ox, oy, W, H, R); ctx.fillStyle = col.hex || '#c9d2dc'; ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, ox, oy, W, H, R); ctx.clip();
  if (!col.hex) {
    const g = ctx.createLinearGradient(ox, oy, ox + W, oy + H); g.addColorStop(0, '#e7ecf2'); g.addColorStop(.55, '#c9d2dc'); g.addColorStop(1, '#b3bfcc');
    ctx.fillStyle = g; ctx.fillRect(ox, oy, W, H);
  }
  if (S.finish === 'glitter') {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < W * H / 90; i++) { ctx.globalAlpha = .35 + rnd() * .5; ctx.fillStyle = rnd() > .7 ? '#ffe9a0' : '#ffffff'; ctx.beginPath(); ctx.arc(ox + rnd() * W, oy + rnd() * H, .8 + rnd() * 1.8, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  for (const it of S.items) {
    ctx.save(); ctx.translate(ox + it.x * W, oy + it.y * W); ctx.rotate(it.angle * Math.PI / 180); ctx.scale(it.flip ? -1 : 1, 1);
    if (it.type === 'sticker') {
      try {
        const img = await loadImg(display.get(it.src) || it.src), s = it.size * W, k = Math.min(s / img.naturalWidth, s / img.naturalHeight);
        const w = img.naturalWidth * k, h = img.naturalHeight * k;
        ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = W * .012; ctx.shadowOffsetY = W * .006;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } catch { /* skip images the browser refuses to export */ }
    } else {
      const fs = it.size * W; ctx.font = `700 ${fs}px ${fontOf(it.font).css}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      if (it.outline) { ctx.lineWidth = fs * .14; ctx.lineJoin = 'round'; ctx.strokeStyle = strokeFor(it.color); ctx.strokeText(it.text, 0, fs * .04); }
      ctx.fillStyle = it.color; ctx.fillText(it.text, 0, fs * .04);
    }
    ctx.restore();
  }
  // finish
  const gl = ctx.createLinearGradient(ox, oy, ox + W, oy + H * .55);
  const a = S.finish === 'matte' ? .25 : 1;
  gl.addColorStop(0, `rgba(255,255,255,${.35 * a})`); gl.addColorStop(.3, `rgba(255,255,255,${.08 * a})`); gl.addColorStop(.46, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(ox, oy, W, H);
  // camera
  const ring = ringColor();
  const circ = (x, y, r, fill) => { ctx.beginPath(); ctx.arc(ox + x * W, oy + y * W, r * W, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  if (lay.mod) {
    const m = lay.mod; rr(ctx, ox + m.x * W - .014 * W, oy + m.y * W - .014 * W, m.w * W + .028 * W, m.h * W + .028 * W, m.r * W + .014 * W); ctx.fillStyle = ring; ctx.fill();
    const mg = ctx.createLinearGradient(ox + m.x * W, oy + m.y * W, ox + (m.x + m.w) * W, oy + (m.y + m.h) * W); mg.addColorStop(0, '#3a3d45'); mg.addColorStop(.7, '#1b1d22');
    rr(ctx, ox + m.x * W, oy + m.y * W, m.w * W, m.h * W, m.r * W); ctx.fillStyle = mg; ctx.fill();
  }
  for (const [x, y, d] of lay.lenses) {
    circ(x, y, d / 2 + .014, ring);
    const g = ctx.createRadialGradient(ox + (x - d * .14) * W, oy + (y - d * .18) * W, 0, ox + x * W, oy + y * W, d / 2 * W);
    g.addColorStop(0, '#7d8cc4'); g.addColorStop(.08, '#2a3566'); g.addColorStop(.3, '#0c0f1a'); g.addColorStop(.62, '#030407'); g.addColorStop(.66, '#1c1e24'); g.addColorStop(1, '#2b2e36');
    circ(x, y, d / 2, g);
  }
  { const [x, y, d] = lay.flash; circ(x, y, d / 2 + .008, ring); circ(x, y, d / 2, '#efe2b8'); }
  for (const [x, y, d] of lay.dots) { circ(x, y, d / 2 + .006, ring); circ(x, y, d / 2, '#101115'); }
  ctx.restore();
  // edge
  rr(ctx, ox + 1.5, oy + 1.5, W - 3, H - 3, R); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.stroke();
  // caption
  ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#0f1b4d'; ctx.font = `700 34px ${FONTS[0].css}`;
  ctx.fillText(`${brandOf().prefix}${S.model} · ${colorOf().name} · ${finishOf().name}`, OW / 2, OH - 92);
  ctx.fillStyle = '#52607e'; ctx.font = `400 24px ${FONTS[0].css}`;
  ctx.fillText('מרכז חב״ד משיח · הדמיה בלבד', OW / 2, OH - 50);
  return c;
}
const fileName = () => `mercaz-case-${S.brand}-${S.model}`.replace(/[^\w-]+/g, '-').toLowerCase() + '.png';
async function savePNG() {
  try {
    const c = await toCanvas(), a = document.createElement('a');
    a.download = fileName(); a.href = c.toDataURL('image/png'); document.body.append(a); a.click(); a.remove();
    toast('התמונה נשמרה ✓');
  } catch { toast('לא ניתן לשמור את התמונה בדפדפן הזה'); }
}
async function sharePNG() {
  try {
    const c = await toCanvas();
    const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
    const file = new File([blob], fileName(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'הכיסוי שעיצבתי', text: 'עיצבתי כיסוי עם המדבקות של מרכז חב״ד משיח ✨' });
    } else { await savePNG(); toast('השיתוף לא נתמך כאן — התמונה נשמרה'); }
  } catch (e) { if (e && e.name !== 'AbortError') toast('השיתוף נכשל'); }
}
function updateWhatsApp() {
  const names = [...new Set(S.items.filter(i => i.type === 'sticker').map(i => i.name))];
  const lines = ['שלום! עיצבתי כיסוי בסטודיו באתר:', `${brandOf().prefix}${S.model} · ${colorOf().name}`];
  if (names.length) lines.push('המדבקות שבחרתי: ' + names.join(', '));
  lines.push('אשמח לפרטים על המדבקות 🙏');
  $('wa').href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/* ---------- toast ---------- */
let toastTimer = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200); }

/* ---------- wiring ---------- */
$('undo').onclick = undo; $('redo').onclick = redo;
$('dup').onclick = duplicate; $('remove').onclick = removeSel;
$('fwd').onclick = () => move(1); $('bwd').onclick = () => move(-1);
$('flip').onclick = () => { const it = itemOf(sel); if (it) { it.flip = !it.flip; render(); commit(); } };
$('center').onclick = () => { const it = itemOf(sel); if (it) { it.x = .5; it.y = heightUnits() / 2; render(); commit(); } };
$('size').oninput = e => { const it = itemOf(sel); if (it) { it.size = clamp(e.target.value / 100, ...LIMITS[it.type]); schedule(); } };
$('angle').oninput = e => { const it = itemOf(sel); if (it) { it.angle = snapAngle(Number(e.target.value)); schedule(); } };
$('size').onchange = $('angle').onchange = commit;
$('clear').onclick = () => { if (!S.items.length) return; S.items = []; sel = null; render(); commit(); toast('הכיסוי נוקה — אפשר לבטל עם ↶'); };
$('save').onclick = savePNG; $('share').onclick = sharePNG;
$('addText').onclick = addText;
$('txt').addEventListener('input', editText);
$('txt').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const it = itemOf(sel); if (it && it.type === 'text') commit(); else addText(); } });
$('outline').onchange = e => { textPrefs.outline = e.target.checked; editText(); };
$('q').addEventListener('input', renderCatalog);
$('surprise').onclick = surprise;
new ResizeObserver(() => { camKey = ''; schedule(); }).observe($('stage'));

buildControls();
const saved = loadSaved();
if (saved) { Object.assign(S, saved); S.items.filter(i => i.type === 'sticker').forEach(i => prepare(i.src)); }
last = serialize();
syncControls(); render(); syncHistory(); loadCatalog();
})();
