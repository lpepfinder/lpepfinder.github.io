import { execFileSync } from 'node:child_process';
import { issueAction } from './rules.js';

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

/**
 * The one health issue, with the gh CLI (GH_TOKEN with issues: write): opened or updated while degraded,
 * commented and closed once healthy. Returns what was done.
 */
export function syncIssue({ degraded, body, day, label }) {
  const open = JSON.parse(gh('issue', 'list', '--label', label, '--state', 'open', '--json', 'number', '--limit', '20'))
    .map((i) => i.number).sort((a, b) => a - b);
  const { action, number } = issueAction(degraded, open);
  const title = `Site health: degraded (${day})`;
  if (action === 'create') {
    gh('label', 'create', label, '--color', 'B3261E', '--description', 'Daily site health report (Deploy workflow)', '--force');
    gh('issue', 'create', '--title', title, '--label', label, '--body', body);
  } else if (action === 'update') {
    gh('issue', 'edit', String(number), '--title', title, '--body', body);
  } else if (action === 'close') {
    gh('issue', 'comment', String(number), '--body', body);
    gh('issue', 'close', String(number), '--reason', 'completed');
  }
  return { action, number };
}
