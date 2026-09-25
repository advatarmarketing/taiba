/**
 * Today's prayer times.
 *
 *   GET   public → { prayer: { source, times, jumua, mosque, fetchedAt, … } }
 *   POST  admin  → fetch Mawaqit again now, whatever the cache says
 *
 * WHERE THE TIMES COME FROM, in order of preference:
 *
 *   1. MAWAQIT, through the caches below. The centre already keeps its
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
  How old the stored copy may get before it is fetched again.

  Six hours, not six minutes. The timetable for the whole year is already in
  hand — a refresh is only ever picking up an EDIT the mosque has made, and
  those happen a few times a year. Fetching more often would put load on
  somebody else's server for nothing.
*/
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

/*
  THE SECOND CACHE, IN MEMORY, AND WHY IT EARNS ITS KEEP.

  A serverless instance is reused between requests for as long as it stays
  warm, so a module-level variable survives from one request to the next. That
  makes this a free front-stop in front of the database.

  It also covers the case that made it necessary. With NO database connected,
  every single page load used to go out to Mawaqit — which is both slow for
  the visitor and rude to somebody else's server. Now the first request on an
  instance fetches and the rest read this, so a site whose database is not
  wired up yet still behaves, at a few requests an hour rather than one per
  visitor.

  It is deliberately shorter-lived than the stored copy: memory is per
  instance, so a long life here would mean two instances disagreeing about
  the times for hours. Fifteen minutes is short enough that they converge and
  long enough to do the job.
*/
const MEMORY_MS = 15 * 60 * 1000;
let memory = null;      // { mosque, at, stored }

const ageOf = (value) => {
  const at = Date.parse(value ?? '');
  return Number.isFinite(at) ? Date.now() - at : Infinity;
};

const looksUsable = (mosque, slug) =>
  mosque?.slug === slug && Array.isArray(mosque?.calendar) && mosque.calendar.length === 12;

/** The hand-typed timetable, used only when Mawaqit has never worked. */
function manualFallback(settings, reason) {
  return {
    source: 'manual',
    reason,
    times: Array.isArray(settings?.prayer) ? settings.prayer : [],
    jumua: Array.isArray(settings?.jumuah) ? settings.jumuah : [],
    mosque: null,
    fetchedAt: null,
    stale: false,
  };
}

/**
 * Shape one mosque into the answer the browser wants.
 *
 * `cache` and `stored` are diagnostics, and they are here because the one
 * question that gets asked of this endpoint is "why is it showing the wrong
 * thing" — see "Is Mawaqit actually connected?" in the README. Neither is a
 * secret and neither is used to render anything.
 */
function present(mosque, { stale, cache, stored }) {
  return {
    source: 'mawaqit',
    times: rowsFor(mosque, todayIn(mosque.timezone)),
    jumua: jumuaRows(mosque),
    mosque: { name: mosque.name, url: mosque.url, slug: mosque.slug },
    fetchedAt: mosque.fetchedAt,
    /* True when we could not reach Mawaqit this time and are showing an older
       copy. The times are still right unless the mosque has edited them. */
    stale,
    cache,
    /* False means the copy is only in this instance's memory, because the
       database is not connected. Everything still works; nothing survives a
       cold start. */
    stored,
  };
}

/**
 * Keep a fetched mosque, in memory always and in the database if there is one.
 *
 * THE DATABASE WRITE IS ALLOWED TO FAIL, and that is the entire point of this
 * function existing. It used to be a bare `await set(...)` inside the same
 * try/catch as the fetch — so on a deployment with no database connected, the
 * write threw, a PERFECTLY GOOD set of times was thrown away with it, and the
 * site quietly showed the typed placeholders instead. It looked exactly like
 * Mawaqit being broken, and Mawaqit was fine.
 *
 * Caching is an optimisation. Losing it must never cost the thing it was
 * meant to be making faster.
 */
async function remember(mosque) {
  let stored = false;
  try {
    await set(CACHE_KEY, mosque);
    stored = true;
  } catch (error) {
    console.warn('[prayer] could not cache the timetable:', error.message);
  }

  /* `stored` is carried WITH the copy, not worked out from which driver is
     loaded. The question this field answers is "did this copy actually get
     written down", and only the write knows that. */
  memory = { mosque, at: Date.now(), stored };
  return stored;
}

/** The stored copy, if the database has one and it is for this mosque. */
async function fromStore(slug) {
  try {
    const stored = await get(CACHE_KEY);
    return looksUsable(stored, slug) ? stored : null;
  } catch (error) {
    console.warn('[prayer] could not read the cached timetable:', error.message);
    return null;
  }
}

export default withErrors(async (req, res) => {
  const method = req.method?.toUpperCase();
  if (method !== 'GET' && method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);

  /* A forced refresh changes what is stored, so it needs a live edit session.
     Reading is public — this is a public website. */
  const forced = method === 'POST';
  if (forced && !requireAuth(req, res)) return;

  const site = (await get('settings').catch(() => null)) ?? seedFor('settings') ?? {};

  /* Switched off by hand, or never set up: the typed timetable is the site's
     timetable and Mawaqit is not consulted at all. */
  const slug = slugFrom(site.mawaqitSlug);
  if (!slug) return ok(res, { prayer: manualFallback(site, 'No Mawaqit page is set.') });
  if (site.prayerSource === 'manual') {
    return ok(res, { prayer: manualFallback(site, 'Set to manual — Mawaqit is switched off.') });
  }

  /* ---- 1. This instance's memory ---------------------------------------- */
  if (!forced && looksUsable(memory?.mosque, slug) && Date.now() - memory.at < MEMORY_MS) {
    return ok(res, {
      prayer: present(memory.mosque, { stale: false, cache: 'memory', stored: memory.stored }),
    });
  }

  /* ---- 2. The database -------------------------------------------------- */
  const stored = await fromStore(slug);
  if (!forced && stored && ageOf(stored.fetchedAt) < MAX_AGE_MS) {
    memory = { mosque: stored, at: Date.now(), stored: true };
    return ok(res, { prayer: present(stored, { stale: false, cache: 'store', stored: true }) });
  }

  /* ---- 3. Mawaqit itself ------------------------------------------------ */
  try {
    const mosque = await fetchMosque(slug);
    const kept = await remember(mosque);
    return ok(res, { prayer: present(mosque, { stale: false, cache: 'fresh', stored: kept }) });
  } catch (error) {
    /*
      Mawaqit is unreachable, or has changed its page.

      An old copy of a year's timetable is worth far more than an error, so
      one is served if we have it anywhere, flagged as stale. Only when there
      has never been a successful fetch does this fall back to typed times.
    */
    const fallback = stored ?? (looksUsable(memory?.mosque, slug) ? memory.mosque : null);
    if (fallback) {
      return ok(res, {
        prayer: present(fallback, { stale: true, cache: stored ? 'store' : 'memory', stored: Boolean(stored) }),
      });
    }

    if (forced) {
      /* Somebody pressed "Refresh now" and is waiting for an answer, so tell
         them what actually went wrong rather than silently doing nothing. */
      return json(res, 502, { error: `Could not read Mawaqit: ${error.message}` });
    }

    return ok(res, { prayer: manualFallback(site, `Could not read Mawaqit: ${error.message}`) });
  }
});
