/**
 * <vf-docs>: the docs' topics are a disclosure on phones (closed, showing where you are) and a column
 * on wide screens (always open).
 */
const wide = matchMedia('(min-width: 64rem)');

export class VfDocs extends HTMLElement {
  connectedCallback() {
    this.details = this.querySelector(':scope > details');
    this.sync = () => { this.details.open = wide.matches; };
    this.sync();
    wide.addEventListener('change', this.sync);
  }

  disconnectedCallback() { wide.removeEventListener('change', this.sync); }
}
customElements.define('vf-docs', VfDocs);
