import { recent, clearRecent, RECENT_EVENT } from './recent.js';
import { el } from './dom.js';

/**
 * <vf-recent>: links to the last searches, under the empty search box of the home page,
 * with a button to clear them. Hidden when there are none (and in results mode, by CSS).
 */
export class VfRecent extends HTMLElement {
  connectedCallback() {
    this.render = this.render.bind(this);
    this.querySelector('button[name="clear"]').addEventListener('click', () => {
      clearRecent();
      document.querySelector('vf-search input[name="q"]')?.focus();
    });
    addEventListener(RECENT_EVENT, this.render);
    this.render();
  }

  disconnectedCallback() { removeEventListener(RECENT_EVENT, this.render); }

  render() {
    const list = recent();
    const home = location.pathname;
    this.querySelector('ul').replaceChildren(...list.map((q) => el('li', {}, el('a', { href: `${home}?q=${encodeURIComponent(q)}`, textContent: q }))));
    this.hidden = !list.length;
  }
}
customElements.define('vf-recent', VfRecent);
