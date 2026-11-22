import {applyAppearance, pages, readAppearance} from '/appearance.js?v=13';

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

readAppearance(AbortSignal.timeout(4000))
  .then(({settings}) => applyAppearance(document.documentElement, settings, page))
  .catch(() => {});

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
