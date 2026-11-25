import {applyAppearance, pages, readAppearance} from '/appearance.js?v=16';

const page = document.body.dataset.appearancePage;
const video = document.querySelector('.exhibit-video');
const replay = document.querySelector('.exhibit-replay');

if (video && replay) {
  const playVideo = () => {
    replay.hidden = true;
    return video.play().catch(() => { replay.hidden = false; });
  };
  video.addEventListener('ended', () => { replay.hidden = false; });
  replay.addEventListener('click', () => {
    if (video.ended) video.currentTime = 0;
    playVideo();
  });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) playVideo();
  else replay.hidden = false;
}

const CACHE_KEY = 'merkaz_appearance_v1:' + location.pathname;
const root = document.documentElement;
const reveal = () => root.classList.remove('cms-pending');

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}

function writeCache(settings) {
  try {
    const vars = {};
    for (const name of root.style) if (name.startsWith('--')) vars[name] = root.style.getPropertyValue(name).trim();
    localStorage.setItem(CACHE_KEY, JSON.stringify({settings, vars}));
  } catch { /* storage full or blocked: next visit waits for the network */ }
}

// Last published design first, so returning visitors see it immediately.
const cached = readCache();
if (cached?.settings) {
  try { applyAppearance(root, cached.settings, page); reveal(); } catch { /* fall through to network */ }
}

readAppearance(AbortSignal.timeout(4000))
  // One retry on a slow or failed first read, so the page does not stay on the default design.
  .catch(() => readAppearance(AbortSignal.timeout(8000)))
  .then(({settings}) => {
    applyAppearance(root, settings, page);
    writeCache(settings);
  })
  .catch(() => {})
  .finally(reveal);

async function showCustomizeShortcut() {
  const token = sessionStorage.getItem('merkaz_staff_token');
  if (!token || !Object.hasOwn(pages, page)) return;
  const response = await fetch('/api/staff/dashboard?panel=admin', {
    headers:{Authorization:'Bearer ' + token},
    cache:'no-store',
    signal:AbortSignal.timeout(4000),
  });
  if (!response.ok) return;
  const link = document.createElement('a');
  link.className = 'appearance-shortcut';
  link.href = '/admin/?customize=' + page;
  link.textContent = 'התאמה אישית';
  document.body.append(link);
}
showCustomizeShortcut().catch(() => {});
