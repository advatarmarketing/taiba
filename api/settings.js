/**
 * Site-wide settings: the contact email, the footer's social links, and every
 * piece of media that isn't attached to a single event.
 *
 * Unlike events, there is only ever ONE of these, so it is a single object
 * rather than a list:
 *
 *   GET  public → { settings }
 *   PUT  admin  → merge changes in
 *
 * EVERY FIELD STARTS EMPTY, and empty is a designed state everywhere it is
 * used — an unset social link isn't rendered, an unset image shows a labelled
 * placeholder. The site is meant to look finished before any media exists.
 *
 * All media is a pasted URL. There are no file uploads anywhere on this site.
 */

import { get, set } from '../lib/kv.js';
import { seedFor } from '../lib/seed.js';
import {
  ok,
  badRequest,
  methodNotAllowed,
  readBody,
  clean,
  cleanMultiline,
  cleanUrl,
  withErrors,
} from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';

function cleanEmail(value) {
  const email = clean(value, 200).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

/** Digits only — wa.me wants an international number with no +, spaces or dashes. */
function cleanPhone(value) {
  const digits = clean(value, 40).replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

/**
 * Force every stored value into a known shape. Anything not listed here is
 * dropped, so a malformed or malicious body can't add fields of its own.
 */
/*
  The six values. The words and their lines live in the page markup (and are
  editable as text); only the background media for each is stored here. This
  list is the one place the keys are written down — keep it in step with
  VALUES in app.js.
*/
const VALUE_KEYS = [
  'prayer',
  'quran',
  'knowledge',
  'family',
  'service',
  'belonging',
];

/*
  The two full-width films — the ones that run the whole width of the screen at
  33:20, play themselves when you scroll to them and stop again when you leave.

    services  behind the heading above the table on /services
    break     the full-bleed break between the clips and the donate band

  Each one is three things: the film, the still to show before it (and instead
  of it, for anyone who has asked their device to reduce motion), and a line of
  alt text describing the footage for a screen reader.
*/
const FILM_KEYS = ['services', 'break'];

/*
  The weekly rhythm — the list under the table on Services. Three columns a
  line: the day, the time, and what happens. Stored as a list rather than as
  page text because the number of lines changes; edit mode shows it as one
  box, one line per row, columns separated by a bar.
*/
const MAX_RHYTHM_ROWS = 12;

/*
  THE PRAYER TIMETABLE, and the Friday times beside it.

  Both are lists of rows for the same reason the rhythm is: the number of
  lines changes. Six prayers most of the year, seven in Ramadan when Tarawih
  goes on the end; one Jumu'ah at most mosques and two or three at a busy one.

  THE TIMES ARE FREE TEXT AND ARE NEVER PARSED HERE. "1.15pm", "13:15" and
  "1:15 PM" are all stored exactly as typed and shown exactly as typed. The
  browser makes one attempt to read them, purely to highlight whichever prayer
  is next, and silently gives up on anything it cannot — see parseClock() in
  app.js. Nothing on the server depends on a time being machine-readable,
  which is what makes it safe to let a human type it the way they say it.

  The row caps are a limit on how much can be stored, not a design: they are
  there so a broken or malicious client cannot write a megabyte of rows into
  the settings record.
*/
const MAX_PRAYER_ROWS = 12;
const MAX_JUMUAH_ROWS = 6;

/*
  DONATION LINKS.

  Every one of these is a URL we paste in from somewhere else — Stripe payment
  links for the one-off and the five monthly amounts, and a LaunchGood campaign
  page. NOTHING about payment happens on this site: no card details are typed
  here, no keys are stored here, and there is no payment code anywhere in this
  repository. A donate button is a link, and the whole transaction happens on
  Stripe's or LaunchGood's own pages.

  That is deliberate, and it is the reason this is only six text fields.

  The five monthly amounts are in pounds, and the key for each is the amount
  with an `m` in front — £10 is `m10` — because an object key cannot start
  with a digit and be pleasant to work with. Changing the ladder is changing this
  one list; app.js reads the same numbers back out of the keys.
*/
const DONATE_TIERS = [5, 10, 25, 50, 100];
const tierKey = (amount) => `m${amount}`;

function cleanDonate(input) {
  const donate = input && typeof input === 'object' ? input : {};
  const monthly = donate.monthly && typeof donate.monthly === 'object' ? donate.monthly : {};
  return {
    oneOff: cleanUrl(donate.oneOff),
    launchgood: cleanUrl(donate.launchgood),
    monthly: Object.fromEntries(
      DONATE_TIERS.map((amount) => [tierKey(amount), cleanUrl(monthly[tierKey(amount)])])
    ),
  };
}

function cleanPrayer(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_PRAYER_ROWS).map((row) => ({
    name: clean(row?.name, 40),
    begins: clean(row?.begins, 24),
    jamaah: clean(row?.jamaah, 24),
  })).filter((row) => row.name);
}

function cleanJumuah(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_JUMUAH_ROWS).map((row) => ({
    label: clean(row?.label, 60),
    time: clean(row?.time, 24),
  })).filter((row) => row.label || row.time);
}

function cleanRhythm(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_RHYTHM_ROWS).map((row) => ({
    day: clean(row?.day, 40),
    time: clean(row?.time, 60),
    detail: clean(row?.detail, 160),
  })).filter((row) => row.day || row.time || row.detail);
}

function cleanFilm(input) {
  const film = input && typeof input === 'object' ? input : {};
  return {
    videoUrl: cleanUrl(film.videoUrl),
    posterUrl: cleanUrl(film.posterUrl),
    alt: clean(film.alt, 200),
  };
}

function sanitize(input) {
  const value = input && typeof input === 'object' ? input : {};
  const social = value.social ?? {};
  const hero = value.hero ?? {};
  const values = value.values ?? {};
  const welcome = value.welcome ?? {};
  const films = value.films ?? {};

  return {
    contact: {
      email: cleanEmail(value.contact?.email),
      /*
        The address, as several lines. After the prayer times it is the most
        important text on a mosque's website — it goes in the footer, on the
        Contact page, and into the "open in maps" link — so it is stored the
        way somebody writes it rather than split into five fields nobody fills
        in consistently.
      */
      address: cleanMultiline(value.contact?.address, 300),
      /*
        Shown exactly as typed; the dialling link strips the spaces itself.
        Deliberately NOT cleanPhone — that one is for the wa.me number, which
        has to be digits and nothing else, and putting a printed number through
        it would turn "020 8000 0000" into something nobody recognises.
      */
      phone: clean(value.contact?.phone, 40),
      // Used to build the wa.me link. Not shown as a phone number anywhere.
      whatsappNumber: cleanPhone(value.contact?.whatsappNumber),
    },
    social: {
      instagram: cleanUrl(social.instagram),
      facebook: cleanUrl(social.facebook),
      youtube: cleanUrl(social.youtube),
      // A WhatsApp community/group invite link, which is separate from the
      // "message us" number above.
      whatsapp: cleanUrl(social.whatsapp),
    },

    /*
      The homepage hero. The video plays behind the organisation's name; the
      poster is the still shown before it loads, if it fails, and instead of it
      entirely for anyone who has asked for reduced motion. With neither set,
      the hero shows a labelled "Add hero video" placeholder.
    */
    hero: {
      videoUrl: cleanUrl(hero.videoUrl),
      posterUrl: cleanUrl(hero.posterUrl),
      /* What the footage shows, in words. The hero sits behind the
         organisation's name, so this is the only description of it there is. */
      alt: clean(hero.alt, 200),
    },

    /*
      One background image or video per value — the six words that take over
      the screen in turn. Keyed by word so they can be set independently; any
      left empty simply show flat colour behind the word.
    */
    values: Object.fromEntries(
      VALUE_KEYS.map((key) => [key, cleanUrl(values[key])])
    ),

    /*
      The upright picture beside the welcome paragraph on the homepage, cut to
      the arch from the logo. Its own setting rather than part of the hero,
      because the two want completely different photographs: the hero wants
      the room full, and this wants the front of the building.
    */
    welcome: {
      imageUrl: cleanUrl(welcome.imageUrl),
      alt: clean(welcome.alt, 200),
    },

    /*
      The full-width films. Both start empty, and an empty one renders as a
      labelled "Add video" frame at the right shape rather than as a hole.
    */
    films: Object.fromEntries(
      FILM_KEYS.map((key) => [key, cleanFilm(films[key])])
    ),

    /*
      The picture that comes up when somebody pastes a link to this site into
      WhatsApp, or posts it anywhere else. Used for every page EXCEPT an
      event's, which uses the event's own picture.

      Landscape, and roughly 1200x630 — that is the shape every one of those
      platforms crops to.
    */
    shareImageUrl: cleanUrl(value.shareImageUrl),

    /*
      THE TIMETABLE. Six rows most of the year — see the note above — and the
      Friday times beside it.
    */
    prayer: cleanPrayer(value.prayer),
    jumuah: cleanJumuah(value.jumuah),

    /* The week, as shown under the service table. */
    rhythm: cleanRhythm(value.rhythm),

    /* Where the Support Us buttons point. All start empty, and an amount with
       no link set simply is not shown — see renderSupport() in app.js. */
    donate: cleanDonate(value.donate),
  };
}

export default withErrors(async (req, res) => {
  const method = req.method?.toUpperCase();

  if (method === 'GET') {
    const stored = await get('settings');
    return ok(res, { settings: sanitize(stored ?? seedFor('settings')) });
  }

  if (method !== 'PUT') return methodNotAllowed(res, ['GET', 'PUT']);
  if (!requireAuth(req, res)) return;

  const body = await readBody(req);
  if (!body || typeof body !== 'object') return badRequest(res, 'Expected a JSON body.');

  // Merge over what is stored, so a partial update can't blank the rest.
  const current = sanitize((await get('settings')) ?? seedFor('settings'));
  const incoming = body.settings ?? body;
  const merged = sanitize({
    ...current,
    ...incoming,
    contact: { ...current.contact, ...(incoming.contact ?? {}) },
    social: { ...current.social, ...(incoming.social ?? {}) },
    hero: { ...current.hero, ...(incoming.hero ?? {}) },
    welcome: { ...current.welcome, ...(incoming.welcome ?? {}) },
    values: { ...current.values, ...(incoming.values ?? {}) },
    /* One level deeper than the rest: each film is itself an object, so a form
       that changes only the poster must not blank the video URL beside it. */
    films: Object.fromEntries(FILM_KEYS.map((key) => [key, {
      ...(current.films?.[key] ?? {}),
      ...((incoming.films ?? {})[key] ?? {}),
    }])),
    /* Lists, not objects: an incoming one REPLACES the stored one, because
       that is what "I deleted a line" has to mean — and it is the difference
       between taking Tarawih off the timetable after Ramadan and being stuck
       with it until somebody edits the database by hand. */
    prayer: incoming.prayer ?? current.prayer,
    jumuah: incoming.jumuah ?? current.jumuah,
    rhythm: incoming.rhythm ?? current.rhythm,
    /* Two levels, like the films: a form that changes one monthly amount must
       not blank the other four. */
    donate: {
      ...current.donate,
      ...(incoming.donate ?? {}),
      monthly: {
        ...(current.donate?.monthly ?? {}),
        ...((incoming.donate ?? {}).monthly ?? {}),
      },
    },
  });

  await set('settings', merged);
  return ok(res, { settings: merged });
});
