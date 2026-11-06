import { previousPath } from './router.js';

/**
 * <vf-crumbs>: the parent link goes back in history when the previous page was that parent (in-app
 * navigation), so the list the reader came from keeps its scroll position and state; else it's a link.
 */
export class VfCrumbs extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (new URL(a.href, location.href).pathname !== previousPath()) return;
      e.preventDefault();
      history.back();
    });
  }
}
customElements.define('vf-crumbs', VfCrumbs);
