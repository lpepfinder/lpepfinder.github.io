import { region } from './viewer.js';

/**
 * <vf-near>: on the shops index, the viewer's own country (from the browser language) as a card
 * above the A–Z list: the shortcut to the shops one can visit or order from without customs.
 * It copies the country's link and count from the list; hidden when the country has no shops.
 */
export class VfNear extends HTMLElement {
  connectedCallback() {
    if (!region) return;
    const a = document.querySelector(`vf-grid a[href$="/shops/${region.toLowerCase()}/"]`);
    if (!a) return;
    const link = this.querySelector('a');
    link.href = a.href;
    link.querySelector('vf-near-name').textContent = a.textContent;
    link.querySelector('data').replaceWith(a.nextElementSibling.cloneNode(true));
    this.hidden = false;
  }
}
customElements.define('vf-near', VfNear);
