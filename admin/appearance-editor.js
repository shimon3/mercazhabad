import {
  CONTACT, applyAppearance, elementFields, elementGroups, elementKinds, originalText, pageFields, pages,
  publishAppearance, readAppearance, sanitizeAppearance, uploadCmsImage,
} from '/appearance.js?v=16';

const SELECTABLE = ['text', 'image', 'media', 'placeholder', 'section', 'edit'];
const SELECTOR = SELECTABLE.map(name => `[data-appearance-${name}]`).join(',');
const keyOf = node => {
  for (const name of SELECTABLE) {
    const value = node.getAttribute('data-appearance-' + name);
    if (value !== null && value !== '') return value;
  }
  return null;
};
const signedInElements = new Set(['accountTitle', 'accountOrders', 'checkoutTitle', 'checkoutNote', 'checkoutPrivacyNote']);
const checkoutElements = new Set(['checkoutTitle', 'checkoutNote', 'checkoutPrivacyNote']);
const cartElements = new Set(['cartTexts', 'cartOverline', 'cartTitle', 'floatingCartLabel', 'floatingCartGo']);

export async function mountAppearanceEditor(host, getToken) {
  host.replaceChildren(document.getElementById('appearance-template').content.cloneNode(true));
  const switcher = document.createElement('div');
  switcher.className = 'appearance-actions cms-editor-switcher';
  const productButton = document.createElement('button');
  productButton.type = 'button';
  productButton.textContent = 'עריכת מוצרים: תמונות, מחירים ומבצעים';
  async function openProductEditor(productId = null, field = null) {
    productButton.disabled = true;
    try {
      const {mountProductVisualEditor} = await import('/admin/product-visual-editor.js?v=4');
      await mountProductVisualEditor(host, getToken, () => mountAppearanceEditor(host, getToken), productId, field);
    } catch (error) {
      productButton.disabled = false;
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      message.textContent = 'טעינת עורך המוצרים נכשלה: ' + error.message;
      switcher.append(message);
    }
  }
  productButton.addEventListener('click', () => { void openProductEditor(); });
  switcher.append(productButton);
  host.prepend(switcher);
  const form = host.querySelector('form');
  const status = form.querySelector('[role="status"]');
  const previewStatus = host.querySelector('[data-preview-status]');
  const frame = host.querySelector('iframe');
  const pageSelect = form.elements.page;
  const elementSelect = form.elements.element;
  const controls = form.querySelector('[data-fields]');
  const publish = form.querySelector('[type="submit"]');
  const reload = form.querySelector('[data-reload]');
  const reset = form.querySelector('[data-defaults]');
  let revision;
  let settings = {};
  let published = {};
  let busy = false;
  let previewRequest;
  let previewDocument;

  const requestedPage = new URLSearchParams(location.search).get('customize');
  for (const [key, {label}] of Object.entries(pages)) pageSelect.add(new Option(label, key));
  pageSelect.value = Object.hasOwn(pages, requestedPage) ? requestedPage : 'home';

  function markDirty() {
    const dirty = JSON.stringify(sanitizeAppearance(settings)) !== JSON.stringify(sanitizeAppearance(published));
    publish.textContent = dirty ? 'פרסום באתר •' : 'פרסום באתר';
    publish.classList.toggle('has-changes', dirty);
  }

  function syncPreview({reveal = false} = {}) {
    if (!previewDocument) return;
    const element = elementSelect.value;
    if (pageSelect.value === 'account') {
      const signedIn = signedInElements.has(element);
      previewDocument.getElementById('authView')?.classList.toggle('hidden', signedIn);
      previewDocument.getElementById('accountView')?.classList.toggle('hidden', !signedIn);
      previewDocument.getElementById('checkout')?.classList.toggle('hidden', !checkoutElements.has(element));
    }
    if (pageSelect.value === 'home') {
      const cart = cartElements.has(element);
      const floating = previewDocument.getElementById('floating-cart');
      if (floating) floating.hidden = !cart;
      const drawer = previewDocument.getElementById('cart-dialog');
      if (drawer && cart && !drawer.open) drawer.show();
      if (drawer && !cart && drawer.open) drawer.close();
    }
    applyAppearance(previewDocument.documentElement, settings, pageSelect.value);
    for (const node of previewDocument.querySelectorAll(SELECTOR)) {
      node.toggleAttribute('data-editor-selected', Boolean(element) && keyOf(node) === element);
    }
    if (reveal) previewDocument.querySelector('[data-editor-selected]')?.scrollIntoView({block:'center'});
    markDirty();
  }

  function selectedFields() {
    return elementFields[elementSelect.value] ?? pageFields[pageSelect.value];
  }

  // Default value of a field: schema default, or the text currently in the page HTML.
  function fallbackOf(key, type, fallback) {
    if (fallback !== null && fallback !== undefined) return fallback;
    if ((type === 'text' || type === 'textarea') && previewDocument) return originalText(previewDocument, key);
    return null;
  }

  function setValue(key, value, type, fallback) {
    const empty = value === '' || value === null || (typeof value === 'string' && !value.trim());
    if (empty || (type !== 'color' && value === fallback)) {
      delete settings[key];
      return true;
    }
    const clean = sanitizeAppearance({[key]:value});
    if (!Object.hasOwn(clean, key)) return false;
    settings = {...settings, ...clean};
    return true;
  }

  function imageControl(label, key, caption) {
    const box = document.createElement('div');
    box.className = 'cms-image-field';
    const thumb = document.createElement('img');
    thumb.alt = '';
    thumb.className = 'cms-image-thumb';
    const url = document.createElement('input');
    url.type = 'text';
    url.dir = 'ltr';
    url.placeholder = '/assets-v8/... או העלאת קובץ';
    url.value = settings[key] ?? '';
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/jpeg,image/png,image/webp';
    file.setAttribute('aria-label', 'העלאת תמונה עבור ' + caption);
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'secondary';
    clear.textContent = 'חזרה לתמונה המקורית';
    const note = document.createElement('small');
    const refresh = () => {
      const node = previewDocument?.querySelector(`[data-appearance-image="${key}"]`);
      thumb.src = settings[key] || node?.getAttribute('src') || '';
      thumb.hidden = !thumb.getAttribute('src');
      clear.disabled = !Object.hasOwn(settings, key);
    };
    url.addEventListener('change', () => {
      note.textContent = setValue(key, url.value.trim(), 'image', null) ? '' : 'כתובת תמונה לא תקינה. מותר רק קובץ מהאתר או תמונה שהועלתה.';
      refresh();
      syncPreview();
    });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      note.textContent = 'מעלה תמונה…';
      file.disabled = true;
      try {
        const uploaded = await uploadCmsImage(file.files[0], getToken());
        setValue(key, uploaded, 'image', null);
        url.value = uploaded;
        note.textContent = 'התמונה הועלתה. לחצו על פרסום כדי להחיל באתר.';
        refresh();
        syncPreview();
      } catch (error) {
        note.textContent = error.message;
      } finally {
        file.disabled = false;
        file.value = '';
      }
    });
    clear.addEventListener('click', () => {
      delete settings[key];
      url.value = '';
      refresh();
      syncPreview();
    });
    refresh();
    box.append(thumb, url, file, clear, note);
    label.append(box);
  }

  function renderControls() {
    controls.replaceChildren();
    const key0 = elementSelect.value;
    if (key0 === CONTACT) {
      const info = document.createElement('p');
      info.className = 'muted';
      info.textContent = 'הפרטים מתעדכנים בכל הקישורים לטלפון ול־WhatsApp בכל עמודי האתר, כולל כפתורי השאלה על מוצרים.';
      controls.append(info);
    } else if (key0 && elementKinds[key0] === 'section') {
      const info = document.createElement('p');
      info.className = 'muted';
      info.textContent = 'בתצוגה המקדימה אזור מוסתר מוצג שקוף עם מסגרת אדומה. באתר עצמו הוא לא יופיע.';
      controls.append(info);
    }
    // Show/hide switches first: on desktop the sidebar scrolls on its own and a switch
    // placed after the typography fields was out of sight.
    const ordered = [...selectedFields()].sort((a, b) => Number(b[2] === 'checkbox' && /Hidden$/.test(b[0])) - Number(a[2] === 'checkbox' && /Hidden$/.test(a[0])));
    for (const [key, caption, type, schemaFallback, options, min, max] of ordered) {
      const fallback = fallbackOf(key, type, schemaFallback);
      const label = document.createElement('label');
      label.textContent = caption;
      if (type === 'image') {
        imageControl(label, key, caption);
        controls.append(label);
        continue;
      }
      const input = document.createElement(type === 'select' ? 'select' : type === 'textarea' ? 'textarea' : 'input');
      if (type === 'select') {
        for (const [value, name] of Object.entries(options)) input.add(new Option(name, value));
      } else if (type === 'textarea') {
        input.rows = Math.min(14, Math.max(3, Math.ceil(String(settings[key] ?? fallback ?? '').length / 38)));
        input.maxLength = 4000;
      } else {
        input.type = type === 'url' || type === 'tel' ? 'text' : type;
        if (type === 'url' || type === 'tel') input.dir = 'ltr';
      }
      if (type === 'number') Object.assign(input, {min, max, required:true});
      if (type === 'text') Object.assign(input, {placeholder:fallback ?? '', maxLength:300});
      if (type === 'url') input.placeholder = key.endsWith('Link') ? '/?category=Pins#catalog · https://… · tel:…' : '/assets-v8/video.mp4';
      if (type === 'tel') input.placeholder = fallback ?? '';
      if (type === 'checkbox') input.checked = settings[key] ?? fallback;
      else if (type === 'textarea') input.value = settings[key] ?? fallback ?? '';
      else input.value = settings[key] ?? (['text', 'url', 'tel'].includes(type) ? '' : fallback ?? '#000000');

      label.append(input);
      controls.append(label);
      const note = document.createElement('small');
      note.className = 'cms-field-note';
      if (type === 'color') {
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'secondary';
        clear.textContent = 'איפוס צבע';
        clear.setAttribute('aria-label', 'איפוס ' + caption);
        clear.disabled = !Object.hasOwn(settings, key);
        clear.addEventListener('click', () => {
          delete settings[key];
          input.value = fallback ?? '#000000';
          clear.disabled = true;
          syncPreview();
        });
        label.append(clear);
      }
      if (type === 'text' || type === 'textarea') {
        const restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'secondary cms-restore';
        restore.textContent = 'חזרה לטקסט המקורי';
        restore.disabled = !Object.hasOwn(settings, key);
        restore.addEventListener('click', () => {
          delete settings[key];
          input.value = type === 'textarea' ? fallback ?? '' : '';
          restore.disabled = true;
          syncPreview();
        });
        label.append(restore);
      }
      label.append(note);
      const update = () => {
        if (!input.validity.valid) return;
        const value = type === 'checkbox' ? input.checked :
          type === 'number' ? input.valueAsNumber : input.value;
        const accepted = setValue(key, typeof value === 'string' && type !== 'textarea' ? value.trim() : value, type, fallback);
        note.textContent = accepted ? '' : type === 'url' ? 'קישור לא תקין. מותר: /עמוד, #אזור, https://…, tel:, mailto:' :
          type === 'tel' ? 'מספר לא תקין (ספרות בלבד).' : 'הערך לא נשמר (ארוך מדי או לא תקין).';
        if (type === 'color') label.querySelector('button').disabled = false;
        const restore = label.querySelector('.cms-restore');
        if (restore) restore.disabled = !Object.hasOwn(settings, key);
        syncPreview();
      };
      input.addEventListener(type === 'url' || type === 'tel' ? 'change' : 'input', update);
    }
  }

  // Desktop: the sticky sidebar has its own scroll — bring the selected element's fields into view.
  function revealControls() {
    const sidebar = form.closest('.appearance-sidebar') || form;
    if (sidebar.scrollHeight > sidebar.clientHeight + 4) {
      const top = controls.getBoundingClientRect().top - sidebar.getBoundingClientRect().top + sidebar.scrollTop - 12;
      sidebar.scrollTo({top: Math.max(0, top), behavior: 'smooth'});
    }
  }

  function fillElementSelect() {
    const page = pageSelect.value;
    const current = elementSelect.value;
    elementSelect.replaceChildren(new Option('עיצוב כללי, צבעים ו־SEO', ''), new Option('פרטי קשר (כל האתר)', CONTACT));
    for (const [groupLabel, items] of elementGroups[page]) {
      const group = document.createElement('optgroup');
      group.label = groupLabel;
      for (const [key, label] of items) group.append(new Option(label, key));
      elementSelect.append(group);
    }
    if ([...elementSelect.options].some(option => option.value === current)) elementSelect.value = current;
  }

  function setBusy(value) {
    busy = value;
    controls.disabled = busy;
    reset.disabled = busy;
    reload.disabled = busy;
    publish.disabled = busy || revision === undefined;
  }

  async function showPage() {
    const page = pageSelect.value;
    fillElementSelect();
    elementSelect.value = '';
    renderControls();
    previewRequest?.abort();
    previewDocument = undefined;
    const request = new AbortController();
    previewRequest = request;
    previewStatus.textContent = 'טוען תצוגה מקדימה…';
    try {
      const url = new URL(pages[page].path, location.origin);
      const response = await fetch(url, {signal:AbortSignal.any([request.signal, AbortSignal.timeout(8000)])});
      if (!response.ok) throw new Error();
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (request.signal.aborted) return;
      html.documentElement.dataset.editorPreview = page;
      for (const node of html.querySelectorAll('script, noscript')) {
        const source = node.getAttribute('src');
        if (page === 'home' && source && new URL(source, url).pathname === '/catalogue-editorial.js') continue;
        node.remove();
      }
      for (const node of html.querySelectorAll('[src], [href], [poster]')) {
        for (const name of ['src', 'href', 'poster']) {
          if (node.hasAttribute(name)) node.setAttribute(name, new URL(node.getAttribute(name), url).href);
        }
      }
      frame.srcdoc = '<!doctype html>' + html.documentElement.outerHTML;
    } catch {
      if (!request.signal.aborted) previewStatus.textContent = 'לא ניתן לטעון את התצוגה המקדימה. בחרו את העמוד שוב או רעננו.';
    }
  }

  function selectElement(key) {
    if (!key || ![...elementSelect.options].some(option => option.value === key)) return false;
    elementSelect.value = key;
    renderControls();
    syncPreview();
    revealControls();
    controls.querySelector('input:not([type="checkbox"]), textarea, select')?.focus({preventScroll:true});
    return true;
  }

  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (doc?.documentElement.dataset.editorPreview !== pageSelect.value) return;
    previewDocument = doc;
    previewStatus.textContent = '';
    doc.addEventListener('submit', event => event.preventDefault(), true);
    doc.addEventListener('auxclick', event => event.preventDefault(), true);
    doc.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const productCard = event.target.closest('[data-product-id]');
      if (productCard && pageSelect.value === 'home') {
        const field = event.target.closest('[data-product-field]')?.dataset.productField || 'image';
        void openProductEditor(productCard.dataset.productId, field);
        return;
      }
      const editable = event.target.closest(SELECTOR) ||
        event.target.closest('a, button')?.querySelector('[data-appearance-text]');
      if (editable && selectElement(keyOf(editable))) return;
      const target = event.target.closest('a[href]');
      if (!target) return;
      const url = new URL(target.href);
      if (url.origin !== location.origin) return;
      const page = Object.keys(pages).find(key => pages[key].path === url.pathname);
      if (page && page !== pageSelect.value) {
        pageSelect.value = page;
        void showPage();
      } else if (page && url.hash) {
        doc.getElementById(url.hash.slice(1))?.scrollIntoView();
      }
    }, true);
    renderControls();
    syncPreview({reveal:true});
  });

  async function loadPublished() {
    setBusy(true);
    status.textContent = 'טוען תוכן שפורסם…';
    try {
      const row = await readAppearance(AbortSignal.timeout(8000));
      revision = row.revision;
      published = sanitizeAppearance(row.settings);
      settings = {...published};
      renderControls();
      syncPreview();
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setBusy(false);
    }
  }

  pageSelect.addEventListener('change', showPage);
  elementSelect.addEventListener('change', () => {
    renderControls();
    syncPreview({reveal:true});
    revealControls();
  });
  host.querySelector('[data-mobile]').addEventListener('click', event => {
    const button = event.currentTarget;
    const active = frame.classList.toggle('mobile');
    button.setAttribute('aria-pressed', String(active));
  });
  reload.addEventListener('click', loadPublished);
  reset.addEventListener('click', () => {
    for (const [key] of selectedFields()) delete settings[key];
    renderControls();
    syncPreview();
    status.textContent = 'ההגדרות שנבחרו אופסו בתצוגה. לחצו על פרסום כדי להחיל בחנות.';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || revision === undefined) return;
    setBusy(true);
    try {
      const row = await publishAppearance(settings, revision, getToken());
      revision = row.revision;
      published = sanitizeAppearance(row.settings);
      status.textContent = 'השינויים פורסמו באתר.';
      markDirty();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setBusy(false);
    }
  });
  await Promise.all([showPage(), loadPublished()]);
}
