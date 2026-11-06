import { t, formatNumber, countryName } from './i18n.js';
import { region, coversOn, setCovers } from './viewer.js';

/**
 * <vf-filters>: toggles in the filters sheet, real controls of the search form (form="search"),
 * mirrored in the URL so a link shares them: stock=in, near=0 (on by default), format=lp (repeatable).
 * "Show covers" is a per-browser preference (localStorage), not part of the URL.
 * Fires "filters" when a toggle changes; `value` is { inStock, near, formats, covers }.
 */
export class VfFilters extends HTMLElement {
  connectedCallback() {
    this.stock = this.querySelector('input[name="stock"]');
    this.near = this.querySelector('input[name="near"]');
    this.covers = this.querySelector('input[name="covers"]');
    this.formats = [...this.querySelectorAll('input[name="format"]')];
    if (region) this.near.labels[0].querySelector('span').textContent = t('results.nearCountry', { country: countryName(region) });
    else this.near.closest('label').hidden = true;
    this.covers.checked = coversOn();
    this.fromUrl();
    addEventListener('popstate', () => this.fromUrl());
    this.addEventListener('change', (e) => {
      if (e.target.closest('vf-currency')) return;
      if (e.target === this.covers) setCovers(this.covers.checked);
      else this.toUrl();
      this.dispatchEvent(new Event('filters', { bubbles: true }));
    });
  }

  fromUrl() {
    const p = new URLSearchParams(location.search);
    this.stock.checked = p.get('stock') === 'in';
    this.near.checked = p.get('near') !== '0';
    const formats = new Set(p.getAll('format'));
    for (const f of this.formats) f.checked = formats.has(f.value);
  }

  toUrl() {
    const url = new URL(location.href);
    for (const k of ['stock', 'near', 'format']) url.searchParams.delete(k);
    if (this.stock.checked) url.searchParams.set('stock', 'in');
    if (!this.near.checked) url.searchParams.set('near', '0');
    for (const f of this.formats) if (f.checked) url.searchParams.append('format', f.value);
    history.replaceState(history.state, '', url);
  }

  get value() {
    return {
      inStock: this.stock.checked,
      near: !!region && this.near.checked,
      covers: this.covers.checked,
      formats: new Set(this.formats.filter((f) => f.checked).map((f) => f.value)),
    };
  }

  /** How many filters differ from the defaults (the count on the Filters buttons). */
  get active() {
    return Number(this.stock.checked) + Number(!!region && !this.near.checked) + this.formats.filter((f) => f.checked).length;
  }

  /** Format chips: shown when loaded copies have the format (or it is selected), with their count. */
  counts(byFormat) {
    for (const f of this.formats) {
      const n = byFormat.get(f.value) || 0;
      const label = f.closest('label');
      label.hidden = !n && !f.checked;
      label.querySelector('data').value = n;
      label.querySelector('data').textContent = formatNumber(n);
    }
    this.querySelector('fieldset[name="format"]').hidden = this.formats.every((f) => f.closest('label').hidden);
  }
}
customElements.define('vf-filters', VfFilters);
