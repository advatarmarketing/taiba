/**
 * Today's prayer times.
 *
 *   GET   public → { prayer: { source, times, jumua, mosque, fetchedAt, … } }
 *   POST  admin  → fetch the listing again now, whatever the cache says
 *
 * WHERE THE TIMES COME FROM, in order of preference:
 *
 *   1. IQAMAH.CO.UK, through the caches below. The centre is listed there and
 *      the listing publishes the whole year as a CSV, so the website reads it
 *      rather than asking anybody to type the same numbers in twice.
 *   2. THE CACHE, even when it is stale, if the listing cannot be reached. A
 *      whole year is cached at once, so "stale" here means the published file
 *      may have been edited since — not that the times are missing.
 *   3. THE HAND-TYPED TIMETABLE in settings, if there has never been a
 *      successful fetch at all.
 *
 * There is no fourth case where the page has nothing to show. That is the
 * whole design: a mosque website that cannot answer "when is the next prayer"
 * has failed at the one job it has.
 *
 * THE ADHAN TIMES ARE READ; THE IQAMAH TIMES ARE CALCULATED from an offset
 * per prayer that the centre owns and edits — see lib/iqamah.js. The offsets
 * live in settings and are applied when a row is built, so changing one takes
 * effect on the next page load with nothing refetched.
 *
 * WHY THE WHOLE YEAR IS CACHED. The listing publishes it in one file, so
 * fetching it costs the same as fetching today. Today is then worked out from
 * our own copy, in the centre's timezone — meaning the end of a month is a
 * non-event and an outage upstream is invisible until the cache next
 * refreshes, which can be days later.
 */

import { get, set } from '../lib/kv.js';
import { settingsWithDefaults } from '../lib/seed.js';
import {
  ok,
  json,
  methodNotAllowed,
  withErrors,
} from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import {
  fetchMosque,
  rowsFor,
  jumuaRows,
  slugFrom,
  todayIn,
  hasDay,
  DEFAULT_OFFSETS,
} from '../lib/iqamah.js';

const CACHE_KEY = 'iqamah';

/*
  How old the stored copy may get before it is fetched again.

  Six hours, not six minutes. The timetable for the whole year is already in
  hand — a refresh is only ever picking up an EDIT upstream, or next year's
  file appearing. Fetching more often would put load on somebody else's server
  for nothing.
*/
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

/*
  THE SECOND CACHE, IN MEMORY, AND WHY IT EARNS ITS KEEP.

  A serverless instance is reused between requests for as long as it stays
  warm, so a module-level variable survives from one request to the next. That
  makes this a free front-stop in front of the database.

  It also covers the case that made it necessary: with NO database connected,
  every page load would otherwise go out to iqamah.co.uk — slow for the
  visitor and rude to somebody else's server. Now the first request on an
  instance fetches and the rest read this.

  It is deliberately shorter-lived than the stored copy: memory is per
  instance, so a long life here would mean two instances disagreeing about the
  times for hours.
*/
const MEMORY_MS = 15 * 60 * 1000;
let memory = null;      // { mosque, at, stored }

const ageOf = (value) => {
  const at = Date.parse(value ?? '');
  return Number.isFinite(at) ? Date.now() - at : Infinity;
};

const looksUsable = (mosque, slug) =>
  mosque?.slug === slug && mosque?.days && typeof mosque.days === 'object';

/** The hand-typed timetable, used only when the listing has never worked. */
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
 * Shape one cached listing into the answer the browser wants.
 *
 * `cache`, `stored` and `offsets` are diagnostics, and they are here because
 * the one question ever asked of this endpoint is "why is it showing that" —
 * see "Is the feed actually connected?" in the README. None of them is a
 * secret and none is used to render anything.
 */
function present(mosque, { stale, cache, stored, offsets, today }) {
  return {
    source: 'iqamah',
    times: rowsFor(mosque, today, offsets),
    jumua: jumuaRows(mosque),
    mosque: { name: mosque.name, url: mosque.url, slug: mosque.slug },
    fetchedAt: mosque.fetchedAt,
    /* What the iqamah times were worked out with, so a wrong one can be
       traced to the setting rather than to the feed. */
    offsets,
    /* The span of the published file. Worth seeing when the year is nearly
       out and nobody has published the next one. */
    covers: mosque.covers ?? null,
    /* True when the listing could not be reached and this is an older copy.
       The times are still right unless the file has been edited. */
    stale,
    cache,
    /* False means the copy is only in this instance's memory, because the
       database is not connected. Everything works; nothing survives a cold
       start. */
    stored,
  };
}

/**
 * Keep a fetched listing, in memory always and in the database if there is one.
 *
 * THE DATABASE WRITE IS ALLOWED TO FAIL, and that is the entire point of this
 * function existing. It used to be a bare `await set(...)` inside the same
 * try/catch as the fetch — so on a deployment with no database connected, the
 * write threw, a PERFECTLY GOOD set of times was thrown away with it, and the
 * site quietly showed the typed placeholders instead.
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

  memory = { mosque, at: Date.now(), stored };
  return stored;
}

/** The stored copy, if the database has one and it is for this listing. */
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

  /* settingsWithDefaults, not `?? seed` — a settings record saved before a
     field existed is missing it, and an empty iqamahSlug reads as "switched
     off" rather than "never configured". See lib/seed.js. */
  const site = settingsWithDefaults(await get('settings').catch(() => null));
  const offsets = { ...DEFAULT_OFFSETS, ...(site.iqamahOffsets ?? {}) };

  /* Switched off by hand, or never set up: the typed timetable is the site's
     timetable and the listing is not consulted at all. */
  const slug = slugFrom(site.iqamahSlug);
  if (!slug) return ok(res, { prayer: manualFallback(site, 'No iqamah.co.uk page is set.') });
  if (site.prayerSource === 'manual') {
    return ok(res, { prayer: manualFallback(site, 'Set to manual — the live feed is switched off.') });
  }

  const shape = (mosque, extra) =>
    present(mosque, { offsets, today: todayIn(mosque.timezone), ...extra });

  /*
    A copy is only good enough if it actually covers TODAY. The published file
    runs to the end of the year, so on 1 January a perfectly valid cache is
    suddenly useless — and the right response is to go and look for the new
    one rather than to serve nothing.
  */
  const coversToday = (mosque) => mosque && hasDay(mosque, todayIn(mosque.timezone));

  /* ---- 1. This instance's memory ---------------------------------------- */
  if (!forced
    && looksUsable(memory?.mosque, slug)
    && coversToday(memory.mosque)
    && Date.now() - memory.at < MEMORY_MS) {
    return ok(res, { prayer: shape(memory.mosque, { stale: false, cache: 'memory', stored: memory.stored }) });
  }

  /* ---- 2. The database -------------------------------------------------- */
  const stored = await fromStore(slug);
  if (!forced && stored && coversToday(stored) && ageOf(stored.fetchedAt) < MAX_AGE_MS) {
    memory = { mosque: stored, at: Date.now(), stored: true };
    return ok(res, { prayer: shape(stored, { stale: false, cache: 'store', stored: true }) });
  }

  /* ---- 3. iqamah.co.uk itself ------------------------------------------- */
  try {
    const mosque = await fetchMosque(slug);
    const kept = await remember(mosque);

    /*
      Fetched fine, but the file does not reach today — which means the year
      has turned over and nobody upstream has published the next one. There is
      nothing to be done about it here, so say exactly that and let the typed
      fallback carry the page.
    */
    if (!coversToday(mosque)) {
      const to = mosque.covers?.to ?? 'an earlier date';
      const reason = `The published timetable only runs to ${to}, so it has no times for today.`;
      if (forced) return json(res, 502, { error: reason });
      return ok(res, { prayer: manualFallback(site, reason) });
    }

    return ok(res, { prayer: shape(mosque, { stale: false, cache: 'fresh', stored: kept }) });
  } catch (error) {
    /*
      The listing is unreachable, or has changed shape.

      An old copy of a year's timetable is worth far more than an error, so
      one is served if we have it anywhere — but only if it still covers
      today. Only when there is nothing usable does this fall back to the
      typed times.
    */
    const remembered = looksUsable(memory?.mosque, slug) ? memory.mosque : null;
    const fallback = [stored, remembered].find(coversToday) ?? null;

    if (fallback) {
      return ok(res, {
        prayer: shape(fallback, {
          stale: true,
          cache: fallback === stored ? 'store' : 'memory',
          stored: fallback === stored,
        }),
      });
    }

    if (forced) {
      /* Somebody pressed "Refresh now" and is waiting for an answer, so tell
         them what actually went wrong rather than silently doing nothing. */
      return json(res, 502, { error: `Could not read iqamah.co.uk: ${error.message}` });
    }

    return ok(res, { prayer: manualFallback(site, `Could not read iqamah.co.uk: ${error.message}`) });
  }
});
