import { navigate } from 'astro:transitions/client';
import { listen, unlisten } from './dom.js';

/** Rows the j/k keys move between: a link per row of the page's main list. */
const ROWS = 'main :is(vf-release > a, vf-dig-card > a, vf-watch-shop > a, vf-result h3 a, vf-grid li > a, vf-shop-card > a)';
const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable]');

/**
 * <vf-shortcuts>: "?" opens the help dialog; "g" then a letter goes to a section (the dialog's links with
 * data-key); "j" and "k" move the focus to the next and previous row of the page's list. Ignored while typing
 * or with a modifier key ("/" for the search is in vf-search.js).
 */
export class VfShortcuts extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    listen(this, document, 'keydown', (e) => this.key(e));
  }

  disconnectedCallback() { unlisten(this); }

  key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e) || document.querySelector('dialog:modal:not(vf-shortcuts dialog)')) return;
    if (this.pending) {
      this.pending = false;
      const link = this.querySelector(`a[data-key="${CSS.escape(e.key)}"]`);
      if (!link) return;
      e.preventDefault();
      this.dialog.close();
      navigate(link.href);
      return;
    }
    if (e.key === '?') { e.preventDefault(); this.dialog.open ? this.dialog.close() : this.dialog.showModal(); }
    else if (e.key === 'g') { this.pending = true; setTimeout(() => { this.pending = false; }, 1500); }
    else if (e.key === 'j' || e.key === 'k') this.step(e, e.key === 'j' ? 1 : -1);
  }

  /** Focus the next or previous row, from the focused one (or the first visible one). */
  step(e, by) {
    const rows = [...document.querySelectorAll(ROWS)].filter((a) => a.offsetParent);
    if (!rows.length) return;
    e.preventDefault();
    const at = rows.indexOf(document.activeElement);
    const next = at < 0 ? rows.find((a) => a.getBoundingClientRect().top >= 0) || rows[0] : rows[Math.max(0, Math.min(rows.length - 1, at + by))];
    next.focus();
    next.scrollIntoView({ block: 'nearest' });
  }
}
customElements.define('vf-shortcuts', VfShortcuts);
