import { load, update, size } from '../lib/watch/store.js';
import config from '../../data/watch.json' with { type: 'json' };
import { t } from './i18n.js';

/**
 * <vf-toast>: one short message at the bottom of the screen with a Close button.
 * Only its <p role="status"> is live; it never takes the focus.
 */
let installPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function toast(text, action) {
  let box = document.querySelector('vf-toast');
  if (!box) {
    box = document.createElement('vf-toast');
    box.innerHTML = '<p role="status"></p><menu></menu>';
    document.body.append(box);
  }
  const button = (label, fn) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: label });
    b.addEventListener('click', () => { fn?.(); box.remove(); });
    const li = document.createElement('li');
    li.append(b);
    return li;
  };
  box.querySelector('menu').replaceChildren(...(action ? [button(...action)] : []), button(t('watch.close')));
  // set the text after insertion, so screen readers announce it
  requestAnimationFrame(() => { box.querySelector('p').textContent = text; });
  // it goes away by itself, unless the reader is using it
  clearTimeout(box.timer);
  const later = () => { box.timer = setTimeout(() => (box.matches(':hover, :focus-within') ? later() : box.remove()), config.toastSeconds * 1000); };
  later();
}

/**
 * After records were added: ask the browser to keep the storage (first watch),
 * then, once, suggest the home screen, which also protects the list from Safari's purge.
 */
export function afterWatch() {
  const n = size();
  if (n >= config.installHintAfter && !load().hinted && !standalone()) {
    update((list) => { list.hinted = 1; });
    toast(t('watch.installHint'), installPrompt && [t('watch.install'), () => installPrompt.prompt()]);
  } else if (n === 1 || !load().persistAsked) {
    update((list) => { list.persistAsked = 1; });
    navigator.storage?.persist?.().catch(() => {});
    toast(t('watch.firstWatch'));
  }
}
