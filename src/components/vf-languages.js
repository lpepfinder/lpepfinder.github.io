import { listen, unlisten } from './dom.js';

const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * <vf-languages>: the languages sheet (LanguageSheet.astro). Any button name="language" on the page opens it;
 * a language keeps the page's ?query and #hash (the same search, the same record); the filter box, when there
 * is one, hides the languages whose names and code don't contain what is typed.
 */
export class VfLanguages extends HTMLElement {
  connectedCallback() {
    this.sheet = this.querySelector('vf-sheet');
    listen(this, document, 'click', (e) => {
      if (e.target.closest('button[name="language"]')) this.open();
    });
    // before the router sees the click: the same page, with what it shows
    this.addEventListener('click', (e) => {
      const link = e.target.closest('a[hreflang]');
      if (link) link.href = new URL(link.getAttribute('href'), location.origin).pathname + location.search + location.hash;
    });
    this.querySelector('input[type="search"]')?.addEventListener('input', (e) => this.filter(e.target.value));
  }

  disconnectedCallback() { unlisten(this); }

  open() {
    this.sheet.open();
    (this.querySelector('input[type="search"]') || this.querySelector('a[aria-current]'))?.focus();
  }

  filter(text) {
    const words = fold(text).split(/\s+/).filter(Boolean);
    for (const link of this.querySelectorAll('a[data-match]')) {
      const match = fold(link.dataset.match);
      link.parentElement.hidden = !words.every((w) => match.includes(w));
    }
  }
}
customElements.define('vf-languages', VfLanguages);
