import { region } from './viewer.js';

/**
 * <vf-countries shown="12">: country tiles; the viewer's own country (from the browser language)
 * moves first and is marked local="true", the list still showing `shown` tiles.
 */
export class VfCountries extends HTMLElement {
  connectedCallback() {
    const list = this.querySelector('ul');
    const tile = region && list.querySelector(`vf-country-tile[code="${region}"]`);
    tile?.setAttribute('local', 'true');
    const own = tile?.closest('li');
    if (!own || own === list.firstElementChild) return;
    const wasHidden = own.hidden;
    own.hidden = false;
    list.prepend(own);
    if (wasHidden) [...list.children].filter((li) => !li.hidden).at(-1).hidden = true;
  }
}
customElements.define('vf-countries', VfCountries);
