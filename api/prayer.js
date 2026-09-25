/**
 * Today's prayer times.
 *
 *   GET   public → { prayer: { source, times, jumua, mosque, fetchedAt, stale } }
 *   POST  admin  → fetch Mawaqit again now, whatever the cache says
 *
 * WHERE THE TIMES COME FROM, in order of preference:
 *
 *   1. MAWAQIT, through the cache below. The centre already keeps its
 *      timetable there and it is what drives the screen in the prayer hall,
 *      so the website reads the same source rather than asking anybody to
 *      type the same numbers in twice.
 *   2. THE CACHE, even when it is stale, if Mawaqit cannot be reached. A
 *      whole year is cached at once, so "stale" here means the mosque may
 *      have edited a jama'ah since — not that the times are missing.
 *   3. THE HAND-TYPED TIMETABLE in settings, if there has never been a
 *      successful fetch at all.
 *
 * There is no fourth case where the page has nothing to show. That is the
 * whole design: a mosque website that cannot answer "when is the next prayer"
 * has failed at the one job it has.
 *
 * WHY THE WHOLE YEAR IS CACHED. Mawaqit publishes the entire year's timetable
 * in one page, so fetching it costs exactly the same as fetching today. Today
 * is then worked out from our own copy, in the mosque's timezone — meaning a
 * Mawaqit outage is invisible here until the cache is next refreshed, which
 * can be days later.
 */

import { get, set } from '../lib/kv.js';
import { seedFor } from '../lib/seed.js';
import {
  ok,
  json,
  methodNotAllowed,
  withErrors,
} from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { fetchMosque, rowsFor, jumuaRows, slugFrom, todayIn } from '../lib/mawaqit.js';

const CACHE_KEY = 'mawaqit';

/*
  How old the copy may get before it is fetched again.

  Six hours, not six minutes. The timetable for the whole year is already in
  hand — a refresh is only ever picking up an EDIT the mosque has made, and
  those happen a few times a year. Fetching more often would put load on
  somebody else's server for nothing.
*/
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

const ageOf = (cached) => {
  const at = Date.parse(cached?.fetchedAt ?? '');
  return Number.isFinite(at) ? Date.now() - at : Infinity;
};

/** The hand-typed timetable, used only when Mawaqit has never worked. */
function manualFallback(settings) {
  const stored = Array.isArray(settings?.prayer) ? settings.prayer : [];
  return {
    source: 'manual',
    times: stored,
    jumua: Array.isArray(settings?.jumuah) ? settings.jumuah : [],
    mosque: null,
    fetchedAt: null,
    stale: false,
  };
}

/** Shape one cached mosque into the answer the browser wants. */
function present(cached, { stale }) {
  return {
    source: 'mawaqit',
    times: rowsFor(cached, todayIn(cached.timezone)),
    jumua: jumuaRows(cached),
    mosque: { name: cached.name, url: cached.url, slug: cached.slug },
    fetchedAt: cached.fetchedAt,
    /* True when we could not reach Mawaqit this time and are showing an older
       copy. The times are still right unless the mosque has edited them. */
    stale,
  };
}

async function settings() {
  return (await get('settings')) ?? seedFor('settings') ?? {};
}

export default withErrors(async (req, res) => {
  const method = req.method?.toUpperCase();
  if (method !== 'GET' && method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);

  /* A forced refresh changes what is stored, so it needs a live edit session.
     Reading is public — this is a public website. */
  if (method === 'POST' && !requireAuth(req, res)) return;

  const site = await settings();

  /* Switched off by hand, or never set up: the typed timetable is the site's
     timetable and Mawaqit is not consulted at all. */
  const slug = slugFrom(site.mawaqitSlug);
  if (!slug || site.prayerSource === 'manual') {
    return ok(res, { prayer: manualFallback(site) });
  }

  const cached = await get(CACHE_KEY);
  const usable = cached?.slug === slug && Array.isArray(cached?.calendar);
  const fresh = usable && ageOf(cached) < MAX_AGE_MS;

  /* Fresh enough, and nobody asked for a refresh. */
  if (fresh && method === 'GET') return ok(res, { prayer: present(cached, { stale: false }) });

  try {
    const mosque = await fetchMosque(slug);
    await set(CACHE_KEY, mosque);
    return ok(res, { prayer: present(mosque, { stale: false }) });
  } catch (error) {
    /*
      Mawaqit is unreachable, or has changed its page.

      An old copy of a year's timetable is worth far more than an error, so
      one is served if we have it, flagged as stale. Only when there has never
      been a successful fetch does this fall back to the typed times.
    */
    if (usable) return ok(res, { prayer: present(cached, { stale: true }) });

    if (method === 'POST') {
      /* Somebody pressed "Refresh now" and is waiting for an answer, so tell
         them what actually went wrong rather than silently doing nothing. */
      return json(res, 502, { error: `Could not read Mawaqit: ${error.message}` });
    }

    return ok(res, { prayer: manualFallback(site) });
  }
});
