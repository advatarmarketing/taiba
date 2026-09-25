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

/**
 * Stored settings, with the seed's defaults filled in for anything they have
 * never heard of.
 *
 * WHY THIS EXISTS, because it is not obvious and it cost a working site.
 *
 * The seed is the fallback for a key that has NEVER BEEN WRITTEN. That is the
 * right rule for a whole collection — a site with its own events should not
 * have the placeholder ones reappear. But `settings` is a single record, and
 * the moment anybody presses Save on any form, the whole record exists.
 *
 * From then on, every field ADDED TO THE CODE LATER arrives empty rather than
 * at its designed default, because the stored record predates it. That is how
 * a site that had once saved a contact email ended up with no iqamah.co.uk
 * page set, fell back to the hand-typed placeholder times, and looked for all
 * the world like the prayer times feed was broken.
 *
 * Merging the seed UNDERNEATH the stored record fixes the whole class of it:
 * anything already stored wins, and anything the stored record has never
 * heard of gets the value the site was designed with. Every field in the seed
 * is either empty or a deliberate starting value, so there is nothing there
 * that could overwrite a real decision.
 *
 * The merge is one level deep on purpose. A nested object the stored record
 * DOES have — `contact`, `social` — is its own business and is taken whole;
 * the sanitisers in api/settings.js already fill in missing keys inside them.
 */
export function settingsWithDefaults(stored) {
  const defaults = seedFor('settings') ?? {};
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return defaults;
  return { ...defaults, ...stored };
}
