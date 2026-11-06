import { t } from './i18n.js';
import { recent, clearRecent, removeRecent, RECENT_EVENT } from './recent.js';
import { el, attrs } from './dom.js';

/**
 * <vf-recent>: the last searches as chips under the search box of the home page, each with a small
 * "×" to forget it, and a quiet "Clear" for all. Hidden when there are none (and in results mode, by CSS).
 */
export class VfRecent extends HTMLElement {
  connectedCallback() {
    this.render = this.render.bind(this);
    this.list = this.querySelector('ul');
    const focusSearch = () => document.querySelector('vf-search input[name="q"]')?.focus();
    this.querySelector('button[name="clear"]').addEventListener('click', () => { clearRecent(); focusSearch(); });
    this.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[name="remove"]');
      if (!b) return;
      const next = b.closest('li').nextElementSibling || b.closest('li').previousElementSibling;
      removeRecent(b.value);
      (next?.querySelector('button[name="remove"]') || this.querySelector('button[name="clear"]'))?.focus();
      if (!recent().length) focusSearch();
    });
    addEventListener(RECENT_EVENT, this.render);
    this.render();
  }

  disconnectedCallback() { removeEventListener(RECENT_EVENT, this.render); }

  render() {
    const list = recent();
    const home = location.pathname;
    this.list.replaceChildren(...list.map((q) => {
      const remove = attrs(el('button', { type: 'button', name: 'remove', value: q }, attrs(el('vf-icon'), { name: 'close' })), { kind: 'text', 'aria-label': t('recent.remove', { query: q }) });
      return el('li', {}, el('a', { href: `${home}?q=${encodeURIComponent(q)}`, textContent: q }), remove);
    }));
    this.hidden = !list.length;
  }
}
customElements.define('vf-recent', VfRecent);
