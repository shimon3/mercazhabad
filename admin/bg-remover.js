// Admin tab "🪄 הסרת רקע": replace a photo's background with pure white, locally in the browser.
// Method: flood fill from the photo's edges (and from points the user clicks) over pixels close to
// the background colour, soft edge, then composite on white. No AI service, nothing is uploaded.
import {kb} from '/admin/webp.js?v=1';

const MAX = 1600;
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const range = (min, max, value, step = 1) => Object.assign(document.createElement('input'), {type: 'range', min, max, value, step});

export function injectBgTab() {
  const nav = document.querySelector('#dashboard .navtabs');
  if (!nav || document.querySelector('[data-view="bg"]')) return;
  const tab = el('button', '🪄 הסרת רקע');
  tab.type = 'button';
  tab.dataset.view = 'bg';
  tab.setAttribute('aria-pressed', 'false');
  nav.append(tab);
  const panel = el('section', '', 'hidden bg-tool');
  panel.dataset.panel = 'bg';
  nav.parentElement.append(panel);
  build(panel);
}

// --- image processing -------------------------------------------------------
function dist2(d, i, r, g, b) {
  const dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b;
  return dr * dr + dg * dg + db * db;
}

// Most frequent (quantised) colour along the border = background colour.
function borderColour(d, w, h) {
  const counts = new Map();
  const add = i => {
    const key = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4);
    const entry = counts.get(key) || {n: 0, r: 0, g: 0, b: 0};
    entry.n++; entry.r += d[i]; entry.g += d[i + 1]; entry.b += d[i + 2];
    counts.set(key, entry);
  };
  for (let x = 0; x < w; x++) { add(x * 4); add(((h - 1) * w + x) * 4); }
  for (let y = 0; y < h; y++) { add(y * w * 4); add((y * w + w - 1) * 4); }
  let best = null;
  for (const entry of counts.values()) if (!best || entry.n > best.n) best = entry;
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

// Flood fill: mask[p] = 1 where background. Seeds: {x, y, colour} — colour null = border colour.
function computeMask(d, w, h, seeds, tolerance, shadow = 0, keepSeeds = []) {
  const mask = new Uint8Array(w * h);
  // "Keep" clicks: the region around each click (similar colour) can never become background.
  const protect = new Uint8Array(w * h);
  for (const seed of keepSeeds) {
    const p0 = seed.y * w + seed.x, r0 = d[p0 * 4], g0 = d[p0 * 4 + 1], b0 = d[p0 * 4 + 2];
    const lim = (Math.max(tolerance, 12) * 4.42) ** 2, stack = [p0];
    protect[p0] = 1;
    while (stack.length) {
      const p = stack.pop(), x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= w * h || protect[q] || dist2(d, q * 4, r0, g0, b0) > lim) continue;
        protect[q] = 1; stack.push(q);
      }
    }
  }
  for (let p = 0; p < w * h; p++) if (protect[p]) mask[p] = 2; // 2 = protected (treated as "visited", never background)
  const queue = new Int32Array(w * h);
  const limit = (tolerance * 4.42) ** 2; // tolerance 0–100 → distance 0–442 (max RGB distance)
  const bg = borderColour(d, w, h);
  const fill = (starts, [r, g, b]) => {
    let head = 0, tail = 0;
    for (const p of starts) if (!mask[p] && dist2(d, p * 4, r, g, b) <= limit) { mask[p] = 1; queue[tail++] = p; }
    while (head < tail) {
      const p = queue[head++], x = p % w;
      const next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of next) {
        if (q < 0 || q >= w * h || mask[q]) continue;
        if (dist2(d, q * 4, r, g, b) <= limit) { mask[q] = 1; queue[tail++] = q; }
      }
    }
  };
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  fill(border, bg);
  for (const seed of seeds) {
    const p = seed.y * w + seed.x;
    fill([p], [d[p * 4], d[p * 4 + 1], d[p * 4 + 2]]);
  }
  if (shadow > 0) shadowPass(d, w, h, mask, queue, shadow, bg);
  for (let p = 0; p < w * h; p++) if (mask[p] === 2) mask[p] = 0;
  return mask;
}

// Shadows and glows: from the background already found, keep spreading over pixels that change
// only gradually (shadows are smooth, product edges are sharp) and stay greyish and not too dark.
function shadowPass(d, w, h, mask, queue, strength, bg) {
  const step = (2 + strength * 1.2) ** 2;        // max colour change between two neighbours
  const minLight = Math.max(40, (bg[0] + bg[1] + bg[2]) / 3 - 30 - strength * 14); // darkest shadow accepted
  // Shadows are the background colour, only darker: compare the tint (colour minus its grey level)
  // with the background's tint, so cream / beige products are not eaten.
  const bgGrey = (bg[0] + bg[1] + bg[2]) / 3, tint = [bg[0] - bgGrey, bg[1] - bgGrey, bg[2] - bgGrey];
  const maxTint = 6 + strength * 1.2;
  let head = 0, tail = 0;
  for (let p = 0; p < w * h; p++) if (mask[p] === 1) {
    const x = p % w;
    if ((x > 0 && !mask[p - 1]) || (x < w - 1 && !mask[p + 1]) || (p >= w && !mask[p - w]) || (p < w * (h - 1) && !mask[p + w])) queue[tail++] = p;
  }
  while (head < tail) {
    const p = queue[head++], x = p % w, i = p * 4;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
      if (q < 0 || q >= w * h || mask[q]) continue;
      const j = q * 4, r = d[j], g = d[j + 1], b = d[j + 2];
      if (dist2(d, i, r, g, b) > step) continue;
      if ((r + g + b) / 3 < minLight) continue;
      const grey = (r + g + b) / 3;
      if (Math.abs(r - grey - tint[0]) > maxTint || Math.abs(g - grey - tint[1]) > maxTint || Math.abs(b - grey - tint[2]) > maxTint) continue;
      mask[q] = 1; queue[tail++] = q;
    }
  }
}

// Soft edge: box-blur the mask into an alpha (0 = keep photo, 1 = white).
function softAlpha(mask, w, h, radius) {
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < mask.length; i++) alpha[i] = mask[i];
  if (!radius) return alpha;
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += alpha[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / (2 * radius + 1);
      sum += alpha[y * w + Math.min(w - 1, x + radius + 1)] - alpha[y * w + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      alpha[y * w + x] = sum / (2 * radius + 1);
      sum += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x];
    }
  }
  return alpha;
}

function render(source, mask, w, h, softness, transparent) {
  const alpha = softAlpha(mask, w, h, softness);
  const out = new ImageData(w, h);
  const s = source.data, o = out.data;
  for (let p = 0; p < w * h; p++) {
    const a = alpha[p], i = p * 4;
    if (transparent) {
      o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; o[i + 3] = Math.round(255 * (1 - a));
    } else {
      o[i] = s[i] * (1 - a) + 255 * a; o[i + 1] = s[i + 1] * (1 - a) + 255 * a; o[i + 2] = s[i + 2] * (1 - a) + 255 * a; o[i + 3] = 255;
    }
  }
  return out;
}

// Bounding box of the kept object (for "center in a square").
function objectBox(mask, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!mask[y * w + x]) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return maxX < 0 ? null : {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1};
}

// --- UI ---------------------------------------------------------------------
function build(panel) {
  const intro = el('p', 'מעלים תמונת מוצר, והרקע מוחלף בלבן. עובד הכי טוב כשהרקע בצבע אחיד. נשאר רקע או צל? לחצו עליו בתמונת "אחרי". נמחק חלק מהמוצר? עברו ל־🛡️ שחזור ולחצו עליו. הכל מתבצע במחשב שלכם.', 'muted');
  const drop = el('label', '', 'webp-drop');
  const input = Object.assign(document.createElement('input'), {type: 'file', accept: 'image/jpeg,image/png,image/webp'});
  drop.append(el('strong', 'גררו לכאן תמונה או לחצו לבחירה'), el('small', 'JPG · PNG · WebP'), input);

  const tolerance = range(1, 60, 18);
  const softness = range(0, 4, 1);
  const shadow = range(0, 10, 4);
  const square = Object.assign(document.createElement('input'), {type: 'checkbox', checked: true});
  const transparent = Object.assign(document.createElement('input'), {type: 'checkbox'});
  transparent.addEventListener('change', () => after.classList.toggle('is-transparent', transparent.checked));
  const settings = el('div', '', 'bg-settings');
  const label = (text, control, valueText) => {
    const node = el('label', text + ' ');
    node.append(control);
    if (valueText) node.append(' ', valueText);
    return node;
  };
  const tolValue = el('output', '18');
  const softValue = el('output', '1');
  const shadowValue = el('output', '4');
  settings.append(label('רגישות', tolerance, tolValue), label('ריכוך שוליים', softness, softValue), label('הסרת צל', shadow, shadowValue),
    label('מרכוז בריבוע 800×800 עם שוליים', square), label('רקע שקוף (PNG) במקום לבן', transparent));

  const before = el('canvas', '', 'bg-canvas');
  const after = el('canvas', '', 'bg-canvas bg-clickable');
  after.title = 'לחיצה על אזור רקע שנשאר תסיר אותו';
  const stage = el('div', '', 'bg-stage');
  const figure = (title, canvas) => { const f = el('figure'); f.append(el('figcaption', title), canvas); return f; };
  stage.append(figure('לפני', before), figure('אחרי', after));
  stage.hidden = true;

  const undo = el('button', 'ביטול לחיצה אחרונה', 'secondary');
  const reset = el('button', 'איפוס', 'secondary');
  const download = el('button', 'הורדת התמונה');
  for (const b of [undo, reset, download]) b.type = 'button';
  // Click mode on the result: remove leftover background, or restore a part of the product that was erased.
  const modes = el('div', '', 'bg-modes');
  const modeButton = (value, text) => {
    const b = el('button', text, 'secondary');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(value === 'remove'));
    b.addEventListener('click', () => {
      mode = value;
      for (const other of modes.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === b));
      after.classList.toggle('is-keep', value === 'keep');
    });
    return b;
  };
  modes.hidden = true;
  modes.append(el('span', 'לחיצה על התמונה:'), modeButton('remove', '🧽 הסרת רקע שנשאר'), modeButton('keep', '🛡️ שחזור חלק מהמוצר שנמחק'));
  const actions = el('div', '', 'row bg-actions');
  actions.append(download, undo, reset);
  actions.hidden = true;
  const status = el('p', '', 'status');
  status.setAttribute('role', 'status');

  let source = null, w = 0, h = 0, seeds = [], keepSeeds = [], history = [], mask = null, name = 'image', mode = 'remove';

  const draw = () => {
    if (!source) return;
    mask = computeMask(source.data, w, h, seeds, Number(tolerance.value), Number(shadow.value), keepSeeds);
    const result = render(source, mask, w, h, Number(softness.value), transparent.checked);
    after.width = w; after.height = h;
    after.getContext('2d').putImageData(result, 0, 0);
    const kept = mask.reduce((n, v) => n + (v ? 0 : 1), 0) / mask.length;
    status.textContent = kept < 0.02 ? 'כמעט כל התמונה הוסרה — הורידו את הרגישות.' : (seeds.length || keepSeeds.length) ? seeds.length + ' אזורים הוסרו · ' + keepSeeds.length + ' אזורים שוחזרו.' : '';
    status.className = kept < 0.02 ? 'status error' : 'status ok';
    undo.disabled = !history.length;
  };

  async function load(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { status.textContent = 'יש לבחור JPG, PNG או WebP.'; status.className = 'status error'; return; }
    const bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    w = Math.round(bitmap.width * scale); h = Math.round(bitmap.height * scale);
    before.width = w; before.height = h;
    const ctx = before.getContext('2d', {willReadFrequently: true});
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // transparent PNG → white first
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    source = ctx.getImageData(0, 0, w, h);
    seeds = []; keepSeeds = []; history = [];
    name = file.name.replace(/\.[^.]+$/, '');
    stage.hidden = false; actions.hidden = false; modes.hidden = false;
    draw();
  }

  input.addEventListener('change', () => { load(input.files[0]); input.value = ''; });
  for (const n of ['dragenter', 'dragover']) drop.addEventListener(n, e => { e.preventDefault(); drop.classList.add('is-over'); });
  for (const n of ['dragleave', 'drop']) drop.addEventListener(n, () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', e => { e.preventDefault(); load(e.dataTransfer.files[0]); });
  tolerance.addEventListener('input', () => { tolValue.textContent = tolerance.value; draw(); });
  softness.addEventListener('input', () => { softValue.textContent = softness.value; draw(); });
  shadow.addEventListener('input', () => { shadowValue.textContent = shadow.value; draw(); });
  transparent.addEventListener('change', draw);
  after.addEventListener('click', event => {
    if (!source) return;
    const box = after.getBoundingClientRect();
    const x = Math.floor((event.clientX - box.left) / box.width * w), y = Math.floor((event.clientY - box.top) / box.height * h);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    (mode === 'keep' ? keepSeeds : seeds).push({x, y});
    history.push(mode);
    draw();
  });
  undo.addEventListener('click', () => { const last = history.pop(); if (last === 'keep') keepSeeds.pop(); else if (last) seeds.pop(); draw(); });
  reset.addEventListener('click', () => { seeds = []; keepSeeds = []; history = []; tolerance.value = '18'; tolValue.textContent = '18'; shadow.value = '4'; shadowValue.textContent = '4'; draw(); });

  download.addEventListener('click', async () => {
    if (!source) return;
    let canvas = after;
    if (square.checked) {
      const box = objectBox(mask, w, h);
      if (box) {
        const size = 800, margin = 0.08;
        const scale = Math.min(size * (1 - 2 * margin) / box.w, size * (1 - 2 * margin) / box.h);
        canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!transparent.checked) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(after, box.x, box.y, box.w, box.h, (size - box.w * scale) / 2, (size - box.h * scale) / 2, box.w * scale, box.h * scale);
      }
    }
    const type = transparent.checked ? 'image/png' : 'image/webp';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, 0.9));
    if (!blob) { status.textContent = 'השמירה נכשלה.'; status.className = 'status error'; return; }
    const link = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: name + (transparent.checked ? '-transparent.png' : '-white.webp')});
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    status.textContent = 'הקובץ הורד (' + kb(blob.size) + '). אפשר להעלות אותו כתמונת מוצר בעורך המוצרים.';
    status.className = 'status ok';
  });

  panel.append(el('h2', 'הסרת רקע — רקע לבן'), intro, drop, settings, modes, stage, actions, status);
}
