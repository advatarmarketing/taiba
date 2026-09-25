/**
 * Starter content, used two ways:
 *   1. POST /api/seed writes all of it into the database in one go.
 *   2. Every public GET route falls back to it for any key that has never been
 *      written, so a brand-new deployment renders correctly before seeding.
 *
 * data/seed.json is bundled into the functions by the `includeFiles` line in
 * vercel.json — without that, this import would fail once deployed.
 */

import seedData from '../data/seed.json' with { type: 'json' };

/** Every key the site stores, mapped to its starting value. */
export const SEED = Object.freeze({
  settings: seedData.settings,
  events: seedData.events,
  services: seedData.services,
  clips: seedData.clips,
});

export const SEED_KEYS = Object.keys(SEED);

/** Deep clone, so a caller can never accidentally mutate the frozen seed. */
export function seedFor(key) {
  return structuredClone(SEED[key]);
}
