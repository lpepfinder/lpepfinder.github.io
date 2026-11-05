import { isWatched, add, remove, EVENT } from '../lib/watch/store.js';
import { afterWatch } from './vf-toast.js';
import { t } from './i18n.js';

/**
 * <vf-watch key="<releaseKey>" label="Artist – Title" action="watch|notify">: a toggle that
 * watches a release. Renders its own button (no button without JavaScript, since the list
 * lives in the browser). The visible text stays the same; aria-pressed and the
 * watching="true|false" attribute carry the state.
 */
export class VfWatch extends HTMLElement {
  connectedCallback() {
    if (!this.button) {
      const action = this.getAttribute('action') === 'notify' ? 'notify' : 'watch';
      const label = this.getAttribute('label') || '';
      this.button = Object.assign(document.createElement('button'), { type: 'button' });
      this.button.setAttribute('aria-label', t(`watch.${action}Label`, { title: label }));
      this.button.append(document.createElement('vf-icon'), ` ${t(`watch.${action}`)}`);
      this.button.firstChild.setAttribute('name', 'star');
      this.button.addEventListener('click', () => this.toggle());
      this.append(this.button);
      this.sync = this.sync.bind(this);
    }
    addEventListener(EVENT, this.sync);
    this.sync();
  }

  disconnectedCallback() { removeEventListener(EVENT, this.sync); }

  sync() {
    const on = isWatched(this.getAttribute('key'));
    this.setAttribute('watching', String(on));
    this.button.setAttribute('aria-pressed', String(on));
  }

  toggle() {
    const key = this.getAttribute('key');
    if (isWatched(key)) remove(key);
    else if (add([{ key, title: this.getAttribute('label') }])) afterWatch();
  }
}
customElements.define('vf-watch', VfWatch);
