// Sitemap generated from the live catalogue so Google discovers every product page.
import {listProducts, productSlug, escapeHtml} from './_lib/store.js';

export async function onRequestGet({request}) {
  const origin = new URL(request.url).origin;
  const urls = [
    {loc: origin + '/', priority: '1.0'},
    {loc: origin + '/about/', priority: '0.5'},
    {loc: origin + '/customize/', priority: '0.5'},
    {loc: origin + '/privacy/', priority: '0.2'},
  ];
  try {
    for (const product of await listProducts()) {
      urls.push({loc: origin + '/p/' + productSlug(product), priority: '0.8'});
    }
  } catch { /* Still return the static pages if the catalogue is temporarily unavailable. */ }
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `<url><loc>${escapeHtml(u.loc)}</loc><priority>${u.priority}</priority></url>`).join('\n') + '\n</urlset>\n';
  return new Response(body, {headers: {'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600'}});
}
