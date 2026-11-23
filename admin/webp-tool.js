// Admin tab "🖼️ ממיר WebP": batch-convert PNG/JPG photos to WebP locally and download them.
import {INPUT_TYPES, kb, toWebp} from '/admin/webp.js?v=1';

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};

export function injectWebpTab() {
  const nav = document.querySelector('#dashboard .navtabs');
  if (!nav || document.querySelector('[data-view="webp"]')) return;
  const tab = el('button', '🖼️ ממיר WebP');
  tab.type = 'button';
  tab.dataset.view = 'webp';
  tab.setAttribute('aria-pressed', 'false');
  nav.append(tab);
  const panel = el('section', '', 'hidden webp-tool');
  panel.dataset.panel = 'webp';
  nav.parentElement.append(panel);
  build(panel);
}

function build(panel) {
  const intro = el('p', 'ממירים תמונות PNG / JPG ל־WebP — קבצים קטנים יותר ואתר מהיר יותר. ההמרה מתבצעת במחשב שלכם בלבד, שום דבר לא נשלח לשרת. (כל תמונה שמעלים לאתר מומרת ל־WebP אוטומטית.)', 'muted');
  const drop = el('label', '', 'webp-drop');
  const input = Object.assign(document.createElement('input'), {type: 'file', multiple: true, accept: INPUT_TYPES.join(',')});
  drop.append(el('strong', 'גררו לכאן תמונות או לחצו לבחירה'), el('small', 'PNG · JPG · WebP · עד 20MB לקובץ'), input);

  const quality = Object.assign(document.createElement('input'), {type: 'range', min: '50', max: '100', step: '1', value: '86'});
  const qualityValue = el('output', '86%');
  quality.addEventListener('input', () => { qualityValue.textContent = quality.value + '%'; });
  const size = document.createElement('select');
  for (const [value, label] of [['640', '640px — תמונת מוצר'], ['1200', '1200px'], ['1600', '1600px (מומלץ)'], ['2400', '2400px'], ['100000', 'גודל מקורי']]) size.add(new Option(label, value));
  size.value = '1600';
  const settings = el('div', '', 'row webp-settings');
  const qualityLabel = el('label', 'איכות ');
  qualityLabel.append(quality, ' ', qualityValue);
  const sizeLabel = el('label', 'צלע ארוכה מקסימלית ');
  sizeLabel.append(size);
  settings.append(qualityLabel, sizeLabel);

  const list = el('div', '', 'webp-results');
  const summary = el('p', '', 'status');
  summary.setAttribute('role', 'status');
  const downloadAll = el('button', 'הורדת כל הקבצים', 'secondary');
  downloadAll.type = 'button';
  downloadAll.hidden = true;
  let results = [];

  async function convert(files) {
    results.forEach(r => URL.revokeObjectURL(r.url));
    results = [];
    list.replaceChildren();
    downloadAll.hidden = true;
    const chosen = [...files].filter(file => INPUT_TYPES.includes(file.type));
    if (!chosen.length) { summary.textContent = 'לא נבחרו קבצי תמונה נתמכים.'; summary.className = 'status error'; return; }
    summary.textContent = 'ממיר ' + chosen.length + ' תמונות…';
    summary.className = 'status ok';
    let before = 0, after = 0;
    for (const file of chosen) {
      const row = el('div', '', 'webp-row');
      list.append(row);
      try {
        const {blob, width, height} = await toWebp(file, {maxSize: Number(size.value), quality: Number(quality.value) / 100});
        const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
        const url = URL.createObjectURL(blob);
        results.push({url, name});
        before += file.size;
        after += blob.size;
        // Thumbnail as data: URL — the admin CSP allows data: images but not blob: images.
        const thumb = Object.assign(document.createElement('img'), {alt: '', width: 64, height: 64});
        thumb.src = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
        const saving = Math.round((1 - blob.size / file.size) * 100);
        const info = el('div');
        info.append(el('strong', name), el('small', kb(file.size) + ' → ' + kb(blob.size) + ' · ' + width + '×' + height + (saving > 0 ? ' · חיסכון ' + saving + '%' : ' · הקובץ לא קטן יותר')));
        const link = Object.assign(el('a', 'הורדה', 'webp-download'), {href: url, download: name});
        row.append(thumb, info, link);
      } catch (error) {
        row.append(el('strong', file.name), el('small', 'ההמרה נכשלה: ' + error.message, 'error'));
      }
    }
    if (results.length) {
      summary.textContent = results.length + ' תמונות הומרו · ' + kb(before) + ' → ' + kb(after) + (before ? ' (חיסכון ' + Math.max(0, Math.round((1 - after / before) * 100)) + '%)' : '');
      downloadAll.hidden = results.length < 2;
    }
  }

  input.addEventListener('change', () => { if (input.files.length) convert(input.files); input.value = ''; });
  for (const name of ['dragenter', 'dragover']) drop.addEventListener(name, event => { event.preventDefault(); drop.classList.add('is-over'); });
  for (const name of ['dragleave', 'drop']) drop.addEventListener(name, () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', event => { event.preventDefault(); convert(event.dataTransfer.files); });
  downloadAll.addEventListener('click', async () => {
    for (const {url, name} of results) {
      Object.assign(document.createElement('a'), {href: url, download: name}).click();
      await new Promise(resolve => setTimeout(resolve, 250)); // browsers drop rapid successive downloads
    }
  });

  panel.append(el('h2', 'ממיר תמונות ל־WebP'), intro, settings, drop, summary, downloadAll, list);
}
