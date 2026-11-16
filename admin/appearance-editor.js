import {applyAppearance, publishAppearance, readAppearance, sections} from '/appearance.js?v=3';

export async function mountAppearanceEditor(host, getToken) {
  const template = document.getElementById('appearance-template');
  host.replaceChildren(template.content.cloneNode(true));
  const form = host.querySelector('form');
  const status = host.querySelector('[role="status"]');
  const preview = host.querySelector('.appearance-preview');
  const sample = host.querySelector('template');
  const publish = form.querySelector('[type="submit"]');
  const controls = form.querySelector('[data-fields]');
  const reloadButton = host.querySelector('[data-reload]');
  const defaultsButton = host.querySelector('[data-defaults]');
  const defaults = {};
  const inputs = {};
  let revision;

  for (const [title, fields] of sections) {
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = title;
    group.append(legend);
    for (const [key, caption, type, fallback, choices, min, max] of fields) {
      const label = document.createElement('label');
      label.textContent = caption;
      const input = document.createElement(type === 'select' ? 'select' : 'input');
      if (type === 'select') {
        for (const [value, title] of Object.entries(choices)) input.add(new Option(title, value));
      } else input.type = type;
      if (type === 'number') Object.assign(input, {min, max, required:true});
      if (type === 'text') Object.assign(input, {placeholder:fallback, maxLength:120});
      defaults[key] = fallback;
      inputs[key] = input;
      label.append(input);
      group.append(label);
    }
    controls.append(group);
  }

  function render() {
    const settings = {};
    for (const [key, input] of Object.entries(inputs)) {
      const value = input.type === 'checkbox' ? input.checked :
        input.type === 'number' ? input.valueAsNumber : input.value;
      if (value !== defaults[key] && value !== '') settings[key] = value;
    }
    preview.replaceChildren(sample.content.cloneNode(true));
    applyAppearance(preview, settings);
    return settings;
  }

  function loadForm(settings) {
    for (const [key, input] of Object.entries(inputs)) {
      if (input.type === 'checkbox') input.checked = settings[key] ?? defaults[key];
      else input.value = settings[key] ?? (input.type === 'text' ? '' : defaults[key]);
    }
    render();
  }

  function setBusy(busy) {
    publish.disabled = busy || revision === undefined;
    reloadButton.disabled = busy;
    defaultsButton.disabled = busy;
    for (const input of Object.values(inputs)) input.disabled = busy;
  }

  async function reload() {
    setBusy(true);
    status.textContent = 'טוען עיצוב שפורסם…';
    try {
      const published = await readAppearance(AbortSignal.timeout(8000));
      revision = published.revision;
      loadForm(published.settings);
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener('input', render);
  defaultsButton.addEventListener('click', () => {
    loadForm({});
    status.textContent = 'ברירות המחדל בתצוגה המקדימה. לפרסום יש ללחוץ על פרסום.';
  });
  reloadButton.addEventListener('click', reload);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const settings = render();
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
  await reload();
}
