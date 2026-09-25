/**
 * One-time content loader: writes data/seed.json into the database.
 *
 * DEVELOPMENT ONLY. Leave ALLOW_SEED unset (or delete this file) before the
 * site goes live. It is double-gated: ALLOW_SEED must be "1" AND the caller
 * must already be logged into edit mode.
 *
 *   POST /api/seed          → only writes keys that have never been set
 *   POST /api/seed?force=1  → overwrites every key (destroys existing content)
 */

import { get, set, usingRedis } from '../lib/kv.js';
import { SEED_KEYS, seedFor } from '../lib/seed.js';
import { ok, json, methodNotAllowed, withErrors } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';

export default withErrors(async (req, res) => {
  if (req.method?.toUpperCase() !== 'POST') return methodNotAllowed(res, ['POST']);

  if (process.env.ALLOW_SEED !== '1') {
    return json(res, 403, { error: 'Seeding is disabled. Set ALLOW_SEED=1 to enable it.' });
  }
  if (!requireAuth(req, res)) return;

  const force = new URL(req.url, 'http://localhost').searchParams.get('force') === '1';
  const written = [];
  const skipped = [];

  for (const key of SEED_KEYS) {
    if (!force && (await get(key)) != null) {
      skipped.push(key);
      continue;
    }
    await set(key, seedFor(key));
    written.push(key);
  }

  return ok(res, { written, skipped, store: usingRedis ? 'redis' : 'local-file' });
});
