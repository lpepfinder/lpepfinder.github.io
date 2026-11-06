/**
 * <vf-ad unit="<AdSense ad unit id>" client="ca-pub-…">: a fixed-height ad spot (sheet.css: vf-ad).
 * It queues its unit once; the AdSense script itself is loaded lazily by Ads.astro.
 * The <ins> and its class are what AdSense requires: third-party markup, made here only.
 */
export class VfAd extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount) return;
    const unit = document.createElement('ins');
    unit.className = 'adsbygoogle';
    Object.assign(unit.dataset, { adClient: this.getAttribute('client'), adSlot: this.getAttribute('unit'), adFormat: 'auto', fullWidthResponsive: 'true' });
    this.append(unit);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
}
customElements.define('vf-ad', VfAd);
