/**
 * <vf-sheet mode="bottom|side|full" dock="(min-width: 90rem)" name="…" open docked>: a native <dialog>.
 * open() shows it as a modal (focus trap, Escape, focus return to the opener: all native),
 * or non-modal while `dock` matches (then it sits in its grid area, always shown).
 * Buttons with value="close" close it; the backdrop closes it too (closedby="any", with a click fallback).
 * Fires "dismiss" when the reader closes it (not when docking switches it).
 * A button value="expand" opens it over the whole screen (attribute `expanded`): a docked pane becomes a
 * full-screen modal, and closing that (Back, Escape) puts it back in place, still showing the same thing.
 */
export class VfSheet extends HTMLElement {
  connectedCallback() {
    if (this.dialog) return;
    this.dialog = this.querySelector(':scope > dialog');
    this.closedby = this.dialog.getAttribute('closedby');
    this.dialog.addEventListener('close', () => {
      // the close event comes later than close(): the pane closed by expand() is not a dismissal
      if (this.expanding) { this.expanding = false; return; }
      this.removeAttribute('open');
      // leaving full screen: a pane goes back in place, the reader didn't close the detail
      if (this.hasAttribute('expanded')) {
        this.removeAttribute('expanded');
        if (this.query?.matches) { this.showInPlace(); this.setAttribute('open', ''); return; }
      }
      if (!this.quiet) this.dispatchEvent(new Event('dismiss'));
    });
    this.dialog.addEventListener('click', (e) => {
      if (e.target.closest('button[value="expand"]')) this.expand();
      else if (e.target.closest('button[value="close"]')) this.close();
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
    if (this.docked) this.showInPlace();
    else this.dialog.showModal();
    this.setAttribute('open', '');
  }

  /** show() moves the focus into the dialog: a docked pane is part of the page, so the focus stays where it was. */
  showInPlace() {
    const keep = document.activeElement;
    this.dialog.show();
    if (document.activeElement === keep) return;
    if (keep && keep !== document.body) keep.focus({ preventScroll: true });
    else document.activeElement?.blur();
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  /** Over the whole screen, as a modal: from the docked pane, or from a partial sheet. */
  expand() {
    if (this.hasAttribute('expanded')) return;
    if (this.docked && this.dialog.open) {
      this.expanding = true;
      this.dialog.close();
    }
    this.setAttribute('expanded', '');
    if (!this.dialog.open) this.dialog.showModal();
    this.setAttribute('open', '');
    this.dialog.querySelector('h2, [tabindex="-1"]')?.focus({ preventScroll: true });
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
