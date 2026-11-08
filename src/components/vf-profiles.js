import { profiles, add, rename, remove, use, DEFAULT, EVENT } from '../lib/watch/profiles.js';
import { t } from './i18n.js';
import { el, attrs, listen, unlisten } from './dom.js';

/**
 * <vf-profiles>: the local profiles of the More tab (profiles.js): pick one, add one, rename or remove it.
 * The default profile can be renamed but not removed. Each profile has its own watchlist, Discogs account,
 * collection and filters, in this browser only. Rename and remove ask in the section's native <dialog>.
 */
export class VfProfiles extends HTMLElement {
  connectedCallback() {
    this.list = this.querySelector('ul');
    this.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim();
      if (!name) return;
      add(name);
      e.target.reset();
    });
    this.list.addEventListener('click', (e) => this.act(e.target.closest('button')));
    listen(this, window, EVENT, () => this.render());
    this.render();
  }

  disconnectedCallback() { unlisten(this); }

  label(p) { return p.name || t('profiles.default'); }

  act(button) {
    if (!button) return;
    const { current, list } = profiles();
    const p = list.find((x) => x.id === button.value);
    if (!p) return;
    if (button.name === 'use') {
      use(p.id);
      if (p.id !== current) this.querySelector(`button[name="use"][value="${p.id}"]`)?.focus();
    } else if (button.name === 'rename' || button.name === 'remove') this.ask(button.name, p);
  }

  /** Rename (a field) or remove (a question) in the dialog; only its confirm button acts. */
  ask(action, p) {
    const dialog = this.querySelector('dialog');
    const field = dialog.querySelector('input[name="name"]');
    dialog.setAttribute('action', action);
    dialog.querySelector('h2').textContent = action === 'remove' ? t('profiles.removeConfirm', { name: this.label(p) }) : t('profiles.renameTitle', { name: this.label(p) });
    dialog.querySelector('button[value="ok"]').textContent = t(action === 'remove' ? 'profiles.remove' : 'profiles.rename');
    field.value = this.label(p);
    field.closest('label').hidden = action !== 'rename';
    dialog.returnValue = '';
    dialog.addEventListener('close', () => {
      if (dialog.returnValue !== 'ok') return;
      if (action === 'remove') remove(p.id);
      else if (field.value.trim()) rename(p.id, field.value);
    }, { once: true });
    dialog.showModal();
    if (action === 'rename') field.select();
  }

  render() {
    const { current, list } = profiles();
    this.list.replaceChildren(...list.map((p) => el('li', {}, attrs(el('vf-profile', {},
      el('button', { type: 'button', name: 'use', value: p.id, textContent: this.label(p), ariaPressed: String(p.id === current) }),
      attrs(el('button', { type: 'button', name: 'rename', value: p.id, textContent: t('profiles.rename') }), { kind: 'text' }),
      p.id !== DEFAULT ? attrs(el('button', { type: 'button', name: 'remove', value: p.id, textContent: t('profiles.remove') }), { kind: 'text' }) : null,
    ), { current: String(p.id === current) }))));
  }
}
customElements.define('vf-profiles', VfProfiles);
