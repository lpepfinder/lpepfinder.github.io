import { profiles, add, rename, remove, switchTo, DEFAULT } from '../lib/watch/profiles.js';
import { t, tn } from './i18n.js';
import { accounts } from '../lib/atproto/accounts.js';
import { exportProfile, importProfile } from '../lib/watch/transfer.js';
import { today } from '../lib/watch/store.js';
import { el, attrs } from './dom.js';

/**
 * <vf-profiles>: the local profiles of the More tab (profiles.js): pick one, add one, rename or remove it.
 * The default profile can be renamed but not removed. Each profile has its own watchlist, Discogs account,
 * collection and filters, in this browser only, and may be signed in to one Bluesky account (shown under its
 * name). Switching, adding and removing the current profile reload the page; removing a signed-in profile signs
 * its account out in this browser. Rename and remove ask in the section's native <dialog>.
 */
export class VfProfiles extends HTMLElement {
  connectedCallback() {
    this.list = this.querySelector('ul');
    this.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = e.target.elements.name.value.trim();
      if (!name) return;
      add(name);
      location.reload();
    });
    this.list.addEventListener('click', (e) => this.act(e.target.closest('button')));
    this.live = this.querySelector(':scope > output');
    this.querySelector('button[name="export"]').addEventListener('click', () => this.export());
    this.querySelector('input[name="import"]').addEventListener('change', (e) => this.import(e.target));
    this.render();
  }

  label(p) { return p.name || t('profiles.default'); }

  act(button) {
    if (!button) return;
    const p = profiles().list.find((x) => x.id === button.value);
    if (!p) return;
    if (button.name === 'use') switchTo(p.id);
    else if (button.name === 'rename' || button.name === 'remove') this.ask(button.name, p);
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
      if (action === 'remove') this.remove(p);
      else if (field.value.trim()) { rename(p.id, field.value); this.render(); }
    }, { once: true });
    dialog.showModal();
    if (action === 'rename') field.select();
  }

  /** The current profile as a file (transfer.js). */
  export() {
    const p = profiles().list.find((x) => x.id === profiles().current);
    const body = JSON.stringify(exportProfile(this.label(p)), null, 1);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    a.download = `lpepfinder-${this.label(p).replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** A profile file (or an older watchlist export) merged into the current profile. */
  async import(input) {
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.live.textContent = tn('profiles.imported', importProfile(await file.text()));
    } catch {
      this.live.textContent = t('profiles.importError');
    }
    input.value = '';
  }

  /** Its account signed out in this browser (never on the server), its data gone; the page reloads if it was in use. */
  async remove(p) {
    if (p.did) await (await import('../lib/atproto/session.js')).signOut(p.did).catch(() => {});
    const wasCurrent = p.id === profiles().current;
    remove(p.id);
    if (wasCurrent) location.reload(); else this.render();
  }

  render() {
    const { current, list } = profiles();
    const handles = Object.fromEntries(accounts().map((a) => [a.did, a.handle]));
    this.list.replaceChildren(...list.map((p) => el('li', {}, attrs(el('vf-profile', {},
      el('button', { type: 'button', name: 'use', value: p.id, ariaPressed: String(p.id === current) },
        el('span', { textContent: this.label(p) }),
        el('small', { textContent: p.did && handles[p.did] ? t('profiles.account', { handle: handles[p.did] }) : t('profiles.local') })),
      attrs(el('button', { type: 'button', name: 'rename', value: p.id, textContent: t('profiles.rename') }), { kind: 'text' }),
      p.id !== DEFAULT ? attrs(el('button', { type: 'button', name: 'remove', value: p.id, textContent: t('profiles.remove') }), { kind: 'text' }) : null,
    ), { current: String(p.id === current) }))));
  }
}
customElements.define('vf-profiles', VfProfiles);
