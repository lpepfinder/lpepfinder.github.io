/**
 * <vf-strip at="start|middle|end">: a scrolling row of cards with Previous/Next buttons (keyboard and
 * mouse users never need to swipe). The buttons scroll by most of a screen; `at` reflects the position.
 */
export class VfStrip extends HTMLElement {
  connectedCallback() {
    this.list = this.querySelector('ul');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    for (const b of this.querySelectorAll(':scope > button')) {
      b.addEventListener('click', () => {
        const dir = (b.value === 'next' ? 1 : -1) * (getComputedStyle(this).direction === 'rtl' ? -1 : 1);
        this.list.scrollBy({ left: dir * this.list.clientWidth * 0.8, behavior: reduce.matches ? 'auto' : 'smooth' });
      });
    }
    const update = () => {
      const max = this.list.scrollWidth - this.list.clientWidth - 1;
      const x = Math.abs(this.list.scrollLeft);
      this.setAttribute('at', max <= 0 ? 'all' : x <= 1 ? 'start' : x >= max ? 'end' : 'middle');
    };
    this.list.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update, { passive: true });
    update();
  }
}
customElements.define('vf-strip', VfStrip);
