import { add } from '../lib/watch/store.js';
import { keysFromHash } from '../lib/watch/share.js';
import { afterWatch } from './vf-toast.js';
import { tn } from './i18n.js';

const refreshPage = () => document.querySelector('vf-watch-page')?.refresh();

/** <vf-watch-shared>: shown when the page is opened from a share link (#w=…, made until 2026-11-22); adds its records on request. */
export class VfWatchShared extends HTMLElement {
  connectedCallback() {
    const keys = keysFromHash(location.hash);
    if (!keys.length) return;
    this.querySelector('p').textContent = tn('watchPage.sharedBody', keys.length);
    this.hidden = false;
    this.querySelector('button').addEventListener('click', () => {
      const n = add(keys.map((key) => ({ key })));
      history.replaceState(null, '', location.pathname + location.search);
      this.hidden = true;
      document.querySelector('vf-watch-page output').textContent = tn('watchPage.imported', n);
      if (n) { afterWatch(); refreshPage(); }
      document.querySelector('vf-watch-page')?.show?.(false);
      document.querySelector('vf-watch-page > :not([hidden]) > h2')?.focus();
    });
  }
}
customElements.define('vf-watch-shared', VfWatchShared);
