import {applyAppearance, pages, readAppearance} from '/appearance.js?v=10';

const page = document.body.dataset.appearancePage;
readAppearance(AbortSignal.timeout(4000))
  .then(({settings}) => applyAppearance(document.documentElement, settings, page))
  .catch(() => {})
  .then(() => {
    const video = document.querySelector('.exhibit-video');
    if (video?.getClientRects().length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.play().catch(() => {});
    }
  });

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
