import { isWatched, add, remove, EVENT } from '../lib/watch/store.js';
import { afterWatch } from './vf-toast.js';
import { t } from './i18n.js';

/**
 * <vf-watch key="<releaseKey>" label="Artist – Title" action="watch|notify" url shop price currency>:
 * a toggle that watches a release, keeping the title, link, shop and price of the copy shown.
 * Renders its own button (no button without JavaScript, since the list lives in the browser). The visible text stays the same; aria-pressed and the
 * watching="true|false" attribute carry the state.
 */
export class VfWatch extends HTMLElement {
  connectedCallback() {
    if (!this.button) {
      const action = this.getAttribute('action') === 'notify' ? 'notify' : 'watch';
      const label = this.getAttribute('label') || '';
      this.button = Object.assign(document.createElement('button'), { type: 'button' });
      this.button.setAttribute('aria-label', t(`watch.${action}Label`, { title: label }));
      this.button.append(document.createElement('vf-icon'), Object.assign(document.createElement('span'), { textContent: t(`watch.${action}`) }));
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
    else if (add([this.record()])) afterWatch();
  }

  /** What the card showed: the `now` shards only carry counts. */
  record() {
    const a = (name) => this.getAttribute(name) || null;
    const price = a('price') == null ? null : Number(a('price'));
    return { key: a('key'), title: a('label'), url: a('url'), offer: [price, a('currency'), a('shop')] };
  }
}
customElements.define('vf-watch', VfWatch);
