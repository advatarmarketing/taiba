/**
 * Editable site text — every heading, paragraph, label and button marked with
 * `data-copy` in the page.
 *
 * Stored as ONE flat object of overrides:  { "home.hero.title": "…" }
 * Anything without an override shows the default wording written into the page
 * itself. So an empty object means "the site exactly as designed", and deleting
 * a key is how you undo an edit.
 *
 *   GET  public → { copy }
 *   PUT  admin  → { copy: { key: "new text" } } is merged in.
 *                 A value of null resets that key back to the original.
 */

import { get, set } from '../lib/kv.js';
import {
  ok,
  badRequest,
  methodNotAllowed,
  readBody,
  cleanMultiline,
  withErrors,
} from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';

const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const MAX_KEYS = 800;
const MAX_LENGTH = 1200;

async function readCopy() {
  const stored = await get('copy');
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
}

export default withErrors(async (req, res) => {
  const method = req.method?.toUpperCase();

  if (method === 'GET') return ok(res, { copy: await readCopy() });
  if (method !== 'PUT') return methodNotAllowed(res, ['GET', 'PUT']);
  if (!requireAuth(req, res)) return;

  const body = await readBody(req);
  const changes = body?.copy;
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    return badRequest(res, 'Expected { copy: { key: "text" } }.');
  }

  const copy = await readCopy();
  for (const [key, value] of Object.entries(changes)) {
    if (!KEY_PATTERN.test(key)) return badRequest(res, `Invalid copy key "${key}".`);
    if (value !== null && typeof value !== 'string') {
      return badRequest(res, `Copy for "${key}" must be text.`);
    }
    // Plain text only — it is escaped again when the page renders it. Newlines
    // are kept, so a heading can still be broken across two lines.
    const text = value === null ? '' : cleanMultiline(value, MAX_LENGTH);
    if (text) copy[key] = text;
    else delete copy[key];
  }

  if (Object.keys(copy).length > MAX_KEYS) return badRequest(res, 'Too many text overrides.');

  await set('copy', copy);
  return ok(res, { copy });
});
