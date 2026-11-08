import { load, add } from '../lib/watch/store.js';
import { encodeKeys, keysFromHash } from '../lib/watch/share.js';
import { afterWatch } from './vf-toast.js';
import { t, tn } from './i18n.js';

const refreshPage = () => document.querySelector('vf-watch-page')?.refresh();

/** <vf-watch-backup>: a share link with the keys in #w=… (moving a whole profile as a file: vf-profiles.js). */
export class VfWatchBackup extends HTMLElement {
  connectedCallback() {
    this.live = this.querySelector('output');
    this.on('button[name="share"]', 'click', () => this.share());
  }

  on(selector, type, fn) { this.querySelector(selector).addEventListener(type, fn); }

  async share() {
    const url = new URL(location.pathname, location.origin);
    url.hash = `w=${encodeKeys(Object.keys(load().items))}`;
    const field = this.querySelector('input[type="url"]');
    field.value = url.href;
    field.closest('p').hidden = false;
    try {
      await navigator.clipboard.writeText(url.href);
      this.live.textContent = t('watchPage.shareCopied');
    } catch {
      field.focus();
      field.select();
    }
  }
}

/** <vf-watch-shared>: shown when the page is opened from a share link; adds its records on request. */
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
customElements.define('vf-watch-backup', VfWatchBackup);
customElements.define('vf-watch-shared', VfWatchShared);
