import {
  applyAppearance, elementFields, elements, pageFields, pages,
  publishAppearance, readAppearance, sanitizeAppearance,
} from '/appearance.js?v=6';

export async function mountAppearanceEditor(host, getToken) {
  host.replaceChildren(document.getElementById('appearance-template').content.cloneNode(true));
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
  let busy = false;
  let previewRequest;
  let previewDocument;

  const requestedPage = new URLSearchParams(location.search).get('customize');
  for (const [key, {label}] of Object.entries(pages)) pageSelect.add(new Option(label, key));
  pageSelect.value = Object.hasOwn(pages, requestedPage) ? requestedPage : 'home';

  function syncPreview({reveal = false} = {}) {
    if (!previewDocument) return;
    const element = elementSelect.value;
    if (pageSelect.value === 'account') {
      const signedIn = ['accountTitle', 'accountOrders'].includes(element);
      previewDocument.getElementById('authView').classList.toggle('hidden', signedIn);
      previewDocument.getElementById('accountView').classList.toggle('hidden', !signedIn);
    }
    applyAppearance(previewDocument.documentElement, settings, pageSelect.value);
    for (const node of previewDocument.querySelectorAll('[data-appearance-text]')) {
      node.toggleAttribute('data-editor-selected', node.dataset.appearanceText === element);
    }
    if (reveal) previewDocument.querySelector('[data-editor-selected]')?.scrollIntoView({block:'nearest'});
  }

  function selectedFields() {
    return elementFields[elementSelect.value] ?? pageFields[pageSelect.value];
  }

  function renderControls() {
    controls.replaceChildren();
    for (const [key, caption, type, fallback, options, min, max] of selectedFields()) {
      const label = document.createElement('label');
      label.textContent = caption;
      const input = document.createElement(type === 'select' ? 'select' : 'input');
      if (type === 'select') {
        for (const [value, name] of Object.entries(options)) input.add(new Option(name, value));
      } else {
        input.type = type;
      }
      if (type === 'number') Object.assign(input, {min, max, required:true});
      if (type === 'text') Object.assign(input, {placeholder:fallback, maxLength:120});
      if (type === 'checkbox') input.checked = settings[key] ?? fallback;
      else input.value = settings[key] ?? (type === 'text' ? '' : fallback ?? '#000000');

      label.append(input);
      controls.append(label);
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
      input.addEventListener('input', () => {
        if (!input.validity.valid) return;
        const value = type === 'checkbox' ? input.checked :
          type === 'number' ? input.valueAsNumber : input.value;
        if (value === '' || (type !== 'color' && value === fallback)) delete settings[key];
        else settings = {...settings, ...sanitizeAppearance({[key]:value})};
        if (type === 'text' && !value.trim()) delete settings[key];
        if (type === 'color') label.querySelector('button').disabled = false;
        syncPreview();
      });
    }
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
    elementSelect.replaceChildren(new Option('עיצוב כללי', ''));
    for (const [key, label] of elements[page]) elementSelect.add(new Option(label, key));
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
      for (const node of html.querySelectorAll('[src], [href]')) {
        for (const name of ['src', 'href']) {
          if (node.hasAttribute(name)) node.setAttribute(name, new URL(node.getAttribute(name), url).href);
        }
      }
      frame.srcdoc = '<!doctype html>' + html.documentElement.outerHTML;
    } catch {
      if (!request.signal.aborted) previewStatus.textContent = 'לא ניתן לטעון את התצוגה המקדימה. בחרו את העמוד שוב או רעננו.';
    }
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
      const target = event.target.closest('[data-appearance-text], a, button');
      const editable = target?.matches('[data-appearance-text]') ? target : target?.querySelector('[data-appearance-text]');
      if (editable) {
        elementSelect.value = editable.dataset.appearanceText;
        renderControls();
        syncPreview();
        return;
      }
      if (!target?.matches('a[href]')) return;
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
    syncPreview({reveal:true});
  });

  async function loadPublished() {
    setBusy(true);
    status.textContent = 'טוען עיצוב שפורסם…';
    try {
      const published = await readAppearance(AbortSignal.timeout(8000));
      revision = published.revision;
      settings = sanitizeAppearance(published.settings);
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
      const published = await publishAppearance(settings, revision, getToken());
      revision = published.revision;
      status.textContent = 'העיצוב פורסם בחנות.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setBusy(false);
    }
  });
  await Promise.all([showPage(), loadPublished()]);
}
