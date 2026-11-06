/**
 * <vf-sheet mode="bottom|side|full" dock="(min-width: 90rem)" name="…" open docked>: a native <dialog>.
 * open() shows it as a modal (focus trap, Escape, focus return to the opener: all native),
 * or non-modal while `dock` matches (then it sits in its grid area, always shown).
 * Buttons with value="close" close it; the backdrop closes it too (closedby="any", with a click fallback).
 * Fires "dismiss" when the reader closes it (not when docking switches it).
 */
export class VfSheet extends HTMLElement {
  connectedCallback() {
    if (this.dialog) return;
    this.dialog = this.querySelector(':scope > dialog');
    this.closedby = this.dialog.getAttribute('closedby');
    this.dialog.addEventListener('close', () => {
      this.removeAttribute('open');
      if (!this.quiet) this.dispatchEvent(new Event('dismiss'));
    });
    this.dialog.addEventListener('click', (e) => {
      if (e.target.closest('button[value="close"]')) this.close();
      else if (e.target === this.dialog && !this.docked && !('closedBy' in this.dialog)) this.close();
    });
    const dock = this.getAttribute('dock');
    if (dock) {
      this.query = matchMedia(dock);
      this.query.addEventListener('change', () => this.redock());
      this.redock();
    }
  }

  get docked() { return this.hasAttribute('docked'); }
  get isOpen() { return this.dialog.open; }

  /** Show it: in place when docked, else as a modal. */
  open() {
    if (this.dialog.open) return;
    if (this.docked) this.dialog.show();
    else this.dialog.showModal();
    this.setAttribute('open', '');
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  /** Close without "dismiss" (a switch of layout, or a caller that already handles history). */
  closeQuietly() {
    this.quiet = true;
    this.close();
    this.quiet = false;
  }

  redock() {
    const docked = this.query.matches;
    if (docked === this.docked && this.dialog.open) return;
    this.closeQuietly();
    this.toggleAttribute('docked', docked);
    // light dismiss only applies to the modal: a docked pane stays put
    if (docked || !this.closedby) this.dialog.removeAttribute('closedby');
    else this.dialog.setAttribute('closedby', this.closedby);
    if (docked) this.open();
    this.dispatchEvent(new Event('dock'));
  }
}
customElements.define('vf-sheet', VfSheet);
