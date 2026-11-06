/**
 * <vf-app mode="home|results|page" scroll="top|up|down">: the page frame. `scroll` follows the
 * reading direction (8 px threshold, one passive rAF-throttled listener) so CSS can tuck the compact
 * search header away while reading down a list and bring it back on the way up.
 * Tapping the Search tab while on the search page scrolls to the top and focuses the search box.
 */
import { listen, unlisten } from './dom.js';
const THRESHOLD = 8;

export class VfApp extends HTMLElement {
  disconnectedCallback() { unlisten(this); }

  connectedCallback() {
    let last = scrollY;
    let queued = false;
    const update = () => {
      queued = false;
      const y = scrollY;
      if (y <= THRESHOLD) this.setAttribute('scroll', 'top');
      else if (Math.abs(y - last) >= THRESHOLD) this.setAttribute('scroll', y > last ? 'down' : 'up');
      else return;
      last = y;
    };
    listen(this, window, 'scroll', () => {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
    this.querySelector('vf-tabbar a')?.addEventListener('click', (e) => {
      const a = e.currentTarget;
      if (new URL(a.href).pathname !== location.pathname || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      this.setAttribute('scroll', 'top');
      this.querySelector('input[name="q"]')?.focus({ preventScroll: true });
    });
  }
}
customElements.define('vf-app', VfApp);
