/**
 * <vf-menu>: a contextual menu, the native popover (light dismiss, Escape, focus back to the button):
 *   <vf-menu><button popovertarget="x" aria-haspopup="menu">…</button><menu popover id="x"><li>…</li></menu></vf-menu>
 * On a phone it rises from the bottom as a sheet (CSS); wider, it opens under its button, kept on screen.
 * Picking an item (a button or a link) closes it.
 */
export class VfMenu extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector(':scope > button[popovertarget]');
    this.menu = this.querySelector(':scope > [popover]');
    if (!this.button || !this.menu || this.ready) return;
    this.ready = true;
    this.menu.addEventListener('toggle', (e) => {
      this.button.setAttribute('aria-expanded', String(e.newState === 'open'));
      if (e.newState === 'open') { this.place(); this.menu.querySelector('button, a')?.focus(); }
    });
    this.menu.addEventListener('click', (e) => { if (e.target.closest('button, a')) this.menu.hidePopover(); });
  }

  /** Under the button, its end edge aligned with the button's, inside the viewport. */
  place() {
    const style = this.menu.style;
    style.insetBlockStart = style.insetInlineStart = '';
    if (matchMedia('(max-width: 40rem)').matches) return;
    const b = this.button.getBoundingClientRect();
    const m = this.menu.getBoundingClientRect();
    const gap = 4;
    const left = Math.max(gap, Math.min(b.right - m.width, innerWidth - m.width - gap));
    const below = b.bottom + gap;
    const top = below + m.height > innerHeight ? Math.max(gap, b.top - m.height - gap) : below;
    style.insetBlockStart = `${top}px`;
    style.insetInlineStart = `${left}px`;
  }
}
customElements.define('vf-menu', VfMenu);
