/**
 * A one-line answer to "is the database actually connected?"
 *
 *   GET public → { store: "redis" | "file", ok: true/false, ... }
 *
 * WHY THIS EXISTS: with no database attached, this site still renders
 * perfectly — reads fall back to the starter content in data/seed.json. The
 * only symptom is that every save fails. That is a horrible thing to diagnose
 * from the outside, and it cost us an afternoon once already.
 *
 * So: open /api/health in a browser and it tells you plainly.
 *
 * It is PUBLIC, and safe to be. It reports which kind of store is in use and
 * whether a read worked — never a URL, never a token, never any of the
 * content. Nothing here is worth hiding, and a health check you have to log in
 * for is useless exactly when you need it.
 *
 * It does not write. Writing from an endpoint anybody can call would be a way
 * to make the site busy for free. To prove writing works, save something in
 * edit mode — that is the real test, and it now reports its own errors
 * properly.
 */

import { get, usingRedis, hasCredentials, forcedLocal, credentialsVia } from '../lib/kv.js';
import { ok, methodNotAllowed, withErrors } from '../lib/http.js';

export default withErrors(async (req, res) => {
  if (req.method?.toUpperCase() !== 'GET') return methodNotAllowed(res, ['GET']);

  /* Deployed on Vercel, or running on somebody's laptop? The file store is
     correct locally and impossible on Vercel, so the same answer means
     different things in the two places. */
  const deployed = process.env.VERCEL_ENV === 'production'
    || process.env.VERCEL_ENV === 'preview';

  let readable = false;
  let readError = null;
  try {
    /* Any key will do — we only care that the round trip works. A key that has
       never been written comes back null, which is a perfectly good answer. */
    await get('settings');
    readable = true;
  } catch (error) {
    readError = error.message;
  }

  const store = usingRedis ? 'redis' : 'file';
  const healthy = usingRedis ? readable : !deployed;

  /*
    "file" on a deployment has two completely different causes and they need
    completely different fixes, so say WHICH. Reporting only the symptom sent
    somebody hunting through the Upstash dashboard for a connection that was
    there all along.
  */
  let note;
  if (healthy) {
    note = usingRedis
      ? 'Connected to Redis. Saving will work.'
      : 'Local file store — correct on your own machine.';
  } else if (usingRedis) {
    note = 'The database is configured but could not be read. Check the Upstash '
      + 'dashboard, and that the integration is still connected.';
  } else if (hasCredentials) {
    note = 'The database credentials ARE set, but something is overriding them. '
      + 'Check for a TIC_LOCAL_STORE variable in this project and delete it — it '
      + 'is a local-development-only switch and must never be set on Vercel. '
      + 'Redeploy afterwards.';
  } else {
    note = 'NO DATABASE. The site will render, but nothing can be saved. '
      + 'In Vercel: Storage → Create Database → Upstash for Redis, connect it '
      + 'to this project, then REDEPLOY — environment variables only apply to '
      + 'the next build.';
  }

  return ok(res, {
    ok: healthy,
    store,
    readable,
    /* The two facts that separate the causes. Neither is a secret: whether a
       variable exists, never what is in it. */
    hasCredentials,
    forcedLocal,
    /* WHICH pair of variables was used. Names only — never a value. */
    credentialsVia,
    ...(readError ? { readError } : {}),

    /*
      THE NAMES of any database-ish variables this deployment can see, and
      nothing else — never a value, never a token, and only names matching the
      pattern below so this can never become a listing of everything.

      This exists because "the dashboard says connected but the site cannot
      see it" is otherwise unanswerable from outside: the integration may have
      named the variables something the code does not look for, or set them
      for the wrong environment. One glance here settles it.
    */
    databaseVarsPresent: Object.keys(process.env)
      .filter((name) => /(REDIS|UPSTASH|KV_|_KV|DATABASE|STORAGE)/i.test(name))
      .sort(),

    environment: process.env.VERCEL_ENV ?? 'local',
    note,
  });
});
