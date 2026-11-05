import { thumb, absolute } from '../lib/thumb.js';
import { el } from './dom.js';

const EAGER = 4;

/** Record cover: a small lazy image, falling back once to the original; <vf-cover> without one. */
export function cover(image, index) {
  const src = thumb(image);
  if (!src) return el('vf-cover');
  const original = absolute(image);
  const eager = index < EAGER;
  const img = el('img', { src, alt: '', decoding: 'async', width: 56, height: 56, referrerPolicy: 'no-referrer', loading: eager ? 'eager' : 'lazy', fetchPriority: eager ? 'auto' : 'low' });
  if (src !== original) img.addEventListener('error', () => { img.src = original; }, { once: true });
  return img;
}
