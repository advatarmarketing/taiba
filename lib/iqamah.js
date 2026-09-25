/**
 * IQAMAH.CO.UK — where the prayer times come from.
 *
 * The centre is listed at iqamah.co.uk/taiba_welfare_foundation, and that
 * listing publishes the whole year as a plain CSV. This file reads it.
 *
 * This is the ONLY file that knows where the times come from. Everything above
 * it asks for `{ name, begins, jamaah }` rows and does not care — so if the
 * centre ever moves to another listing, this is the file to rewrite and
 * nothing else changes.
 *
 *
 * THE ADHAN TIMES ARE READ. THE IQAMAH TIMES ARE CALCULATED.
 *
 * That split is the whole point of this file, so it is worth being plain about
 * why. The CSV carries jamaat columns of its own and THEY ARE NOT USED. On the
 * day this was written they said Isha jama'ah was at 21:00 when the centre
 * prays it at 20:29, and Zuhr at 13:30 against an actual 13:17 — they are
 * whatever the upstream feed happened to hold, not what happens in the
 * building.
 *
 * So the times the sun decides — Fajr, sunrise, Zuhr, Asr, Maghrib, Isha —
 * are read from the file and always will be right. The times a person decides
 * are worked out from an offset per prayer, which somebody at the centre owns
 * and can change in edit mode in ten seconds:
 *
 *     Fajr     +15        Maghrib  +7
 *     Zuhr     +20        Isha     +20
 *     Asr      +15
 *
 * The offsets are applied when the page is DRAWN, not when the file is
 * fetched — see rowsFor(). Changing one takes effect on the next page load
 * without re-reading anything.
 *
 *
 * THE WHOLE YEAR ARRIVES AT ONCE, which is what makes the end of a month a
 * non-event: October is already in the file all through September. It also
 * means an outage at iqamah.co.uk costs nothing until the cache next
 * refreshes. The one thing to watch is the END OF THE YEAR — the file runs to
 * 31 December, and if a new one is not published, hasDay() starts returning
 * false and api/prayer.js says so rather than showing nothing.
 */

/* The six rows of a day, in order. Sunrise is not a congregation. */
export const PRAYER_NAMES = ['Fajr', 'Sunrise', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];

/*
  Which CSV column each row's ADHAN time comes from.

  `maghrib_iftari` rather than a "maghrib" column, because in this file the
  moment Maghrib comes in and the moment the fast opens are the same minute
  and it is only named once.
*/
const BEGINS_COLUMN = {
  Fajr: 'fajr_start',
  Sunrise: 'sunrise',
  Zuhr: 'zohr',
  Asr: 'asr',
  Maghrib: 'maghrib_iftari',
  Isha: 'esha',
};

/* The key each prayer's offset is stored under. Sunrise has none. */
export const OFFSET_KEYS = {
  Fajr: 'fajr',
  Zuhr: 'zuhr',
  Asr: 'asr',
  Maghrib: 'maghrib',
  Isha: 'isha',
};

/** What the centre uses today, and what a new site starts with. */
export const DEFAULT_OFFSETS = { fajr: 15, zuhr: 20, asr: 15, maghrib: 7, isha: 20 };

/* Nobody prays a congregation three hours after the adhan; a number that big
   is a typo, and clamping it beats rendering it. */
const MAX_OFFSET = 180;

const HOST = 'https://iqamah.co.uk';
const TIMEOUT_MS = 8000;


/* ----------------------------------------------------------- The slug ---- */

/**
 * The centre's slug, from whatever somebody pastes in.
 *
 *   taiba_welfare_foundation
 *   https://iqamah.co.uk/taiba_welfare_foundation
 *   iqamah.co.uk/taiba_welfare_foundation/
 *
 * Note the UNDERSCORES — iqamah.co.uk uses them where most sites use hyphens,
 * so both have to be allowed or the real slug gets rejected as malformed.
 */
export function slugFrom(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';

  const withoutQuery = raw.split(/[?#]/)[0].replace(/\/+$/, '');
  const slug = withoutQuery.includes('/')
    ? withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1)
    : withoutQuery;

  /* No dots and no slashes, so a pasted mistake can never point the fetch at
     another path. The host is fixed below in any case. */
  return /^[a-z0-9][a-z0-9_-]{2,150}$/i.test(slug) ? slug : '';
}

export const publicUrl = (slug) => `${HOST}/${slug}`;


/* ------------------------------------------------------------- Times ----- */

/** "" and "00:00" both mean "not set" — never a prayer at midnight. */
const unset = (value) => {
  const time = String(value ?? '').trim();
  return !time || time === '00:00';
};

/** "05:23" → 323. Anything unreadable gives null. */
export function minutesOf(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  return hours <= 23 && mins <= 59 ? hours * 60 + mins : null;
}

/** 323 → "05:23". Wraps past midnight rather than producing "24:10". */
const clockOf = (total) => {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};

/**
 * One offset, made safe to use.
 *
 * A blank box means "use the default", not "zero" — somebody clearing a field
 * to retype it should not briefly publish an iqamah at the same minute as the
 * adhan. Zero typed deliberately is still zero.
 */
function offsetFor(prayer, offsets) {
  const key = OFFSET_KEYS[prayer];
  if (!key) return null;                       // Sunrise

  const raw = offsets?.[key];
  const value = Number(raw);
  if (raw === '' || raw == null || !Number.isFinite(value)) return DEFAULT_OFFSETS[key];

  return Math.min(MAX_OFFSET, Math.max(0, Math.round(value)));
}


/* ------------------------------------------------------------- The CSV --- */

/**
 * A small CSV reader — enough for this file and no more.
 *
 * It handles quoted fields and both line endings, because a file written by
 * somebody else is not ours to make assumptions about, and it is twenty lines.
 * It does not handle embedded newlines inside quotes, which this file has no
 * reason to contain.
 */
export function parseCsv(text) {
  const lines = String(text ?? '')
    .replace(/^﻿/, '')            // a BOM would poison the first header
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) return [];

  const cell = (line) => {
    const out = [];
    let value = '';
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (quoted) {
        if (char === '"') {
          if (line[i + 1] === '"') { value += '"'; i += 1; }   // "" is one quote
          else quoted = false;
        } else value += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { out.push(value.trim()); value = ''; }
      else value += char;
    }
    out.push(value.trim());
    return out;
  };

  const headers = cell(lines[0]);
  return lines.slice(1).map((line) => {
    const values = cell(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}


/* --------------------------------------------------------- The fetch ----- */

async function getText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        /* Named honestly. A site reading a centre's own published timetable
           should be identifiable if anyone at iqamah.co.uk ever looks. */
        'User-Agent': 'TaibaIslamicCentreWebsite/1.0 (+https://github.com/advatarmarketing/taiba)',
        Accept: 'text/csv, application/json, text/plain',
      },
    });
    if (!response.ok) throw new Error(`${url.replace(HOST, '')} answered ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the centre's listing and reduce it to the parts this site uses.
 *
 * Two files: a small JSON describing the mosque (which NAMES its own CSV, so
 * the filename is never guessed) and the CSV itself. Only the adhan columns
 * are kept — the jamaat columns are deliberately dropped here rather than
 * ignored later, so there is no way for them to leak into the page by
 * accident.
 */
export async function fetchMosque(slug) {
  const clean = slugFrom(slug);
  if (!clean) throw new Error('That does not look like an iqamah.co.uk address.');

  const meta = JSON.parse(await getText(`${HOST}/data/mosques/${clean}.json`));

  /* The JSON names its own CSV. Fall back to the usual convention if it does
     not, but prefer being told. */
  const csvName = slugFrom(String(meta.csv ?? '').replace(/\.csv$/i, '')) || clean;
  const rows = parseCsv(await getText(`${HOST}/data/${csvName}.csv`));
  if (!rows.length) throw new Error('The timetable file was empty.');

  const days = {};
  for (const row of rows) {
    const date = String(row.date ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const day = {};
    for (const name of PRAYER_NAMES) {
      const time = row[BEGINS_COLUMN[name]];
      if (!unset(time)) day[name] = String(time).trim();
    }
    if (Object.keys(day).length) days[date] = day;
  }

  const dates = Object.keys(days).sort();
  if (!dates.length) throw new Error('The timetable file carried no usable dates.');

  return {
    slug: clean,
    name: String(meta.display_name ?? meta.association ?? '').trim(),
    timezone: String(meta.timezone || 'Europe/London'),
    address: String(meta.address ?? '').trim(),
    /* "13:15, 14:00" — one Friday sitting or several. */
    jumua: String(meta.jummah_times ?? '')
      .split(',')
      .map((time) => time.trim())
      .filter((time) => !unset(time)),
    days,
    /* Kept so api/prayer.js can say "the published file ends on …" rather
       than just failing when the year runs out. */
    covers: { from: dates[0], to: dates[dates.length - 1] },
    url: publicUrl(clean),
    fetchedAt: new Date().toISOString(),
  };
}


/* ------------------------------------------------------- Today's rows ---- */

/**
 * Which day it is WHERE THE CENTRE IS, not where the server is.
 *
 * Vercel runs functions in UTC and a visitor could be anywhere. Between
 * midnight and 1am British Summer Time a UTC date is still yesterday — so for
 * an hour every summer night the site would show the wrong day's timetable.
 * Intl gives the right answer without a date library.
 */
export function todayIn(timezone, now = new Date()) {
  /* en-CA formats as YYYY-MM-DD, which is the shape the CSV is keyed by. */
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Is there a row for this date? False at the end of the published year. */
export const hasDay = (mosque, date) => Boolean(mosque?.days?.[date]);

/**
 * The six rows for one date, in the shape the rest of the site already uses:
 * `{ name, begins, jamaah }`.
 *
 * THE OFFSETS ARE APPLIED HERE, at render time, against whatever is in
 * settings right now — never baked into the cached file. That is what lets
 * somebody change the Isha gap and see it on the next page load without any
 * fetching, and what keeps a year of cached adhan times valid however often
 * the offsets are edited.
 */
export function rowsFor(mosque, date, offsets) {
  const day = mosque?.days?.[date];
  if (!day) return [];

  return PRAYER_NAMES.map((name) => {
    const begins = day[name] ?? '';
    const offset = offsetFor(name, offsets);
    const from = minutesOf(begins);

    return {
      name,
      begins,
      /* Sunrise has no offset and no congregation. A prayer whose adhan time
         could not be read gets no iqamah either — better blank than invented. */
      jamaah: offset == null || from == null ? '' : clockOf(from + offset),
    };
  });
}

/** Friday, as the `{ label, time }` rows the Jumu'ah panel already renders. */
export function jumuaRows(mosque) {
  const times = mosque?.jumua ?? [];
  if (!times.length) return [];
  if (times.length === 1) return [{ label: "Jumu'ah", time: times[0] }];

  const ordinals = ['First jama’ah', 'Second jama’ah', 'Third jama’ah'];
  return times.map((time, index) => ({
    label: ordinals[index] ?? `Jama’ah ${index + 1}`,
    time,
  }));
}
