import { otherProfiles, fileOf, merge, drop } from '../lib/watch/legacy.js';
import { download } from './vf-transfer.js';
import { today } from '../lib/watch/store.js';
import { el, attrs } from './dom.js';
import { t, tn } from './i18n.js';

/**
 * <vf-legacy-profiles>: on Me, once, for a browser that had several profiles before they were removed (legacy.js):
 * each other profile with Download (the same file as Settings › Move to another device), Merge into my list, and
 * Remove. Hidden when there is none left. Remove with legacy.js after 2027-03-01.
 */
export class VfLegacyProfiles extends HTMLElement {
  connectedCallback() {
    this.live = this.querySelector('output');
    this.addEventListener('click', (e) => {
      const button = e.target.closest('button[name]');
      const p = button && otherProfiles().find((x) => x.id === button.value);
      if (!p) return;
      const name = p.name || p.id;
      if (button.name === 'download') return download(fileOf(p), `lpepfinder-${name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${today()}.json`);
      if (button.name === 'merge') {
        this.live.textContent = tn('legacy.merged', merge(p), { name });
        document.querySelector('vf-watch-page')?.refresh();
      } else {
        drop(p);
        this.live.textContent = t('legacy.removed', { name });
      }
      this.render();
    });
    this.render();
  }

  render() {
    const list = otherProfiles();
    // the message of the last action stays while the card does; with nothing left the card goes
    this.hidden = !list.length && !this.live.textContent;
    const action = (name, value, text) => attrs(el('button', { type: 'button', name, value, textContent: text }), { kind: name === 'remove' ? 'text' : 'secondary' });
    this.querySelector('ul').replaceChildren(...list.map((p) => el('li', {},
      el('span', {}, el('b', { textContent: p.name || p.id }), p.current ? el('small', { textContent: t('legacy.inUse') }) : null),
      action('download', p.id, t('legacy.download')),
      action('merge', p.id, t('legacy.merge')),
      action('remove', p.id, t('legacy.remove')))));
  }
}
customElements.define('vf-legacy-profiles', VfLegacyProfiles);
