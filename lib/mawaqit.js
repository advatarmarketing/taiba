/**
 * MAWAQIT — where the prayer times actually come from.
 *
 * The centre already keeps its timetable in Mawaqit (mawaqit.net), which is
 * what drives the screen on the wall. This file reads that same timetable so
 * the website cannot disagree with the screen. Nobody types a time in twice.
 *
 * This is the ONLY file that knows anything about Mawaqit. Everything above it
 * asks for `{ name, begins, jamaah }` rows and does not care where they came
 * from — so if Mawaqit ever changes its page, or the centre moves to something
 * else, this is the file to rewrite and nothing else changes.
 *
 * HOW THE DATA IS READ
 *
 * A mosque's public page carries its entire configuration in the HTML, as a
 * `let confData = {…}` assignment — the same blob the Mawaqit screen app
 * reads. That includes the whole year's timetable, so we take a copy of the
 * year once and work out "today" ourselves from then on. See fetchMosque().
 *
 * There is a documented Mawaqit API as well, at /api/2.0/, but it needs a key
 * issued to the mosque. If the centre ever gets one, swapping to it is a
 * change to fetchMosque() alone — the shape everything else sees stays put.
 *
 * WHAT IS IN confData, and what we use:
 *
 *   calendar        12 months, each { "1": [...], "2": [...] } keyed by day.
 *                   Six times a day, in this order:
 *                     Fajr, Shuruq (sunrise), Zuhr, Asr, Maghrib, Isha
 *                   These are when each prayer BEGINS.
 *   iqamaCalendar   the same 12 months, but FIVE times a day — the same
 *                   prayers with sunrise left out, because nothing is prayed
 *                   in congregation at sunrise. These are the JAMA'AH times.
 *   jumua/2/3       Friday, as plain times.
 *   timeDisplayFormat  "12" or "24" — the mosque's own choice, which the site
 *                   follows rather than overriding.
 *
 * Verified against this mosque's page on 25 September 2026: the row at
 * calendar[8]["25"] matched the live `times` field exactly, including shuruq.
 */

/* Mawaqit's own order. Sunrise is second and is not a congregation. */
export const PRAYER_NAMES = ['Fajr', 'Sunrise', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];

/* Where each of the five jama'ah times lands in the six-slot day above. */
const IQAMA_SLOTS = [0, 2, 3, 4, 5];

/* Long enough that a slow reply is noticed, short enough that a hanging
   request cannot hold a serverless function open until the platform kills it. */
const TIMEOUT_MS = 8000;


/* ----------------------------------------------------------- The slug ---- */

/**
 * The mosque's slug, from whatever somebody pastes in.
 *
 * All four of these are the same mosque, and all four get pasted by real
 * people — the admin address most of all, because that is the page they are
 * looking at when they think to do it:
 *
 *   taiba-welfare-foundation-…
 *   https://mawaqit.net/en/taiba-welfare-foundation-…
 *   https://mawaqit.net/fr/taiba-welfare-foundation-…
 *   https://admin.mawaqit.net/ml/taiba-welfare-foundation-…
 *
 * Anything with a slash in it is treated as an address and the last segment is
 * taken; anything else is assumed to be the slug already.
 */
export function slugFrom(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';

  const withoutQuery = raw.split(/[?#]/)[0].replace(/\/+$/, '');
  const slug = withoutQuery.includes('/')
    ? withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1)
    : withoutQuery;

  /* Mawaqit slugs are lowercase words joined by hyphens. Refusing anything
     else keeps a pasted mistake from becoming a request to some other host. */
  return /^[a-z0-9][a-z0-9-]{2,150}$/.test(slug) ? slug : '';
}

export const publicUrl = (slug) => `https://mawaqit.net/en/${slug}`;


/* -------------------------------------------------------- Reading it ----- */

/**
 * Pull the confData object out of the page.
 *
 * Brace-matched rather than regex-matched. A lazy /\{.*?\}/ stops at the first
 * `}` followed by a `;` — and this blob contains free text written by the
 * mosque (the "flash" notice, the description), any of which may contain a
 * brace or a semicolon. Counting braces while skipping over string literals is
 * the only way to find the real end of it.
 */
export function extractConfData(html) {
  const opening = /(?:var|let|const)\s+confData\s*=\s*\{/.exec(html);
  if (!opening) {
    throw new Error('No confData found on the Mawaqit page — the page may have changed, or the slug may be wrong.');
  }

  const start = opening.index + opening[0].length - 1;   // sit on the '{'
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const char = html[i];

    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (inString) { if (char === '"') inString = false; continue; }
    if (char === '"') { inString = true; continue; }

    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(start, i + 1));
    }
  }

  throw new Error('The confData block on the Mawaqit page never closed.');
}


/* ------------------------------------------------------------- Times ----- */

/** "00:00" and "" both mean "not set" — never a prayer at midnight. */
const unset = (value) => {
  const time = String(value ?? '').trim();
  return !time || time === '00:00';
};

/** "05:21" → 321. Anything unreadable gives null. */
function minutesOf(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  return hours <= 23 && mins <= 59 ? hours * 60 + mins : null;
}

/**
 * Format a time the way the MOSQUE has chosen to show it.
 *
 * Mawaqit stores that choice as `timeDisplayFormat`, and this centre is set to
 * 24-hour — which is what is on the screen in the prayer hall. Following it
 * rather than imposing a house style is the whole point: somebody who checks
 * the website on the way out of the door should see the same characters they
 * just saw on the wall.
 */
function formatTime(value, format) {
  if (unset(value)) return '';
  const total = minutesOf(value);
  if (total == null) return String(value).trim();

  const hours = Math.floor(total / 60);
  const mins = String(total % 60).padStart(2, '0');

  if (format === '24') return `${String(hours).padStart(2, '0')}:${mins}`;

  const suffix = hours < 12 ? 'am' : 'pm';
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}.${mins}${suffix}`;
}

/**
 * A jama'ah cell, which Mawaqit allows to be either an absolute time or an
 * offset in minutes from the adhan — "+20". This mosque uses absolute times
 * throughout, but a mosque that switches to offsets should not break the site.
 */
function resolveIqama(cell, begins) {
  const raw = String(cell ?? '').trim();
  if (unset(raw)) return '';
  if (!raw.startsWith('+')) return raw;

  const offset = Number(raw.slice(1));
  const from = minutesOf(begins);
  if (!Number.isFinite(offset) || from == null) return '';

  const total = (from + offset) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}


/* --------------------------------------------------------- The fetch ----- */

/**
 * Fetch one mosque and reduce its page to the parts this site uses.
 *
 * THE WHOLE YEAR IS KEPT, not just today. It is the same single request either
 * way, and it means the site can work out today's times from its own cache for
 * the rest of the year — so a Mawaqit outage, or a change at their end, costs
 * nothing at all until the cache is next refreshed. There is no day on which
 * the prayer times can simply fail to appear.
 */
export async function fetchMosque(slug) {
  const clean = slugFrom(slug);
  if (!clean) throw new Error('That does not look like a Mawaqit mosque address.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let html;
  try {
    const response = await fetch(publicUrl(clean), {
      signal: controller.signal,
      headers: {
        /* Named honestly. A site reading a mosque's own published timetable
           should be identifiable if anyone at Mawaqit ever looks. */
        'User-Agent': 'TaibaIslamicCentreWebsite/1.0 (+https://github.com/advatarmarketing/taiba)',
        Accept: 'text/html',
      },
    });
    if (!response.ok) throw new Error(`Mawaqit answered ${response.status}.`);
    html = await response.text();
  } finally {
    clearTimeout(timer);
  }

  const conf = extractConfData(html);

  const calendar = Array.isArray(conf.calendar) ? conf.calendar : null;
  if (!calendar || calendar.length !== 12) {
    throw new Error('The Mawaqit page carried no yearly calendar.');
  }

  return {
    slug: clean,
    name: String(conf.name ?? conf.label ?? '').trim(),
    timezone: String(conf.timezone ?? 'Europe/London'),
    /* "12" or "24" — see formatTime(). */
    format: String(conf.timeDisplayFormat ?? '12') === '24' ? '24' : '12',
    calendar,
    iqamaCalendar: Array.isArray(conf.iqamaCalendar) ? conf.iqamaCalendar : [],
    /* Friday. jumuaAsDuhr means they pray Zuhr rather than a Jumu'ah, in
       which case there is nothing to show. */
    jumua: conf.jumuaAsDuhr
      ? []
      : [conf.jumua, conf.jumua2, conf.jumua3].filter((time) => !unset(time)),
    url: publicUrl(clean),
    fetchedAt: new Date().toISOString(),
  };
}


/* ------------------------------------------------------- Today's rows ---- */

/**
 * Which day it is WHERE THE MOSQUE IS, not where the server is.
 *
 * Vercel runs functions in UTC, and a visitor could be anywhere. Between
 * midnight and 1am British Summer Time, a UTC date is yesterday — so for an
 * hour every summer night the site would show the wrong day's timetable. The
 * mosque's own timezone is the only correct answer, and Intl gives it without
 * a date library.
 */
export function todayIn(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);

  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

/**
 * The six rows for one date, in the shape the rest of the site already uses:
 * `{ name, begins, jamaah }`, exactly like the hand-typed timetable.
 *
 * That sameness is deliberate. The page, the hero strip and the "which prayer
 * is next" highlight were all written against hand-typed rows and none of them
 * had to change to read these instead.
 */
export function rowsFor(mosque, date) {
  const { month, day } = date ?? todayIn(mosque.timezone);

  const begins = mosque.calendar?.[month - 1]?.[String(day)];
  if (!Array.isArray(begins) || begins.length < 6) return [];

  const iqama = mosque.iqamaCalendar?.[month - 1]?.[String(day)] ?? [];

  return PRAYER_NAMES.map((name, slot) => {
    const at = begins[slot];
    const which = IQAMA_SLOTS.indexOf(slot);
    /* Sunrise is not in the jama'ah list at all — which is right, and is why
       the table shows the time it comes in rather than an em dash. */
    const jamaah = which === -1 ? '' : resolveIqama(iqama[which], at);

    return {
      name,
      begins: formatTime(at, mosque.format),
      jamaah: formatTime(jamaah, mosque.format),
    };
  });
}

/** Friday, as the `{ label, time }` rows the Jumu'ah panel already renders. */
export function jumuaRows(mosque) {
  const times = mosque.jumua ?? [];
  if (!times.length) return [];
  if (times.length === 1) return [{ label: "Jumu'ah", time: formatTime(times[0], mosque.format) }];

  const ordinals = ['First jama’ah', 'Second jama’ah', 'Third jama’ah'];
  return times.map((time, index) => ({
    label: ordinals[index] ?? `Jama’ah ${index + 1}`,
    time: formatTime(time, mosque.format),
  }));
}
