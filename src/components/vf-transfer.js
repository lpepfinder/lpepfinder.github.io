import { exportProfile, importProfile } from '../lib/watch/transfer.js';
import { today } from '../lib/watch/store.js';
import { t, tn } from './i18n.js';

/**
 * <vf-transfer>: the list as a file, to move it to another browser without an account (transfer.js): Download makes
 * the file, Open a file merges one (or an older watchlist export) into this browser's list.
 */
export class VfTransfer extends HTMLElement {
  connectedCallback() {
    this.live = this.querySelector('output');
    this.querySelector('button[name="export"]').addEventListener('click', () => download(exportProfile(), `lpepfinder-${today()}.json`));
    this.querySelector('input[name="import"]').addEventListener('change', (e) => this.import(e.target));
  }

  async import(input) {
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.live.textContent = tn('transfer.imported', importProfile(await file.text()));
    } catch {
      this.live.textContent = t('transfer.importError');
    }
    input.value = '';
  }
}

/** A JSON file the browser saves. */
export function download(data, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
customElements.define('vf-transfer', VfTransfer);
