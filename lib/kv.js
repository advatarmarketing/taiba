/**
 * The data layer. This is the ONE file to swap if the site ever moves off Redis.
 *
 * Everything above it only ever calls `get(key)` / `set(key, value)` with plain
 * JSON values, so replacing the driver below with Postgres, Supabase, Mongo —
 * whatever — is a rewrite of this file and nothing else.
 *
 * Which driver runs:
 *   - Upstash Redis, when KV_REST_API_URL + KV_REST_API_TOKEN are set. The
 *     "Upstash for Redis" integration on the Vercel Marketplace fills those in
 *     for you.
 *   - Otherwise a local JSON file at .data/store.json, so `vercel dev` works
 *     before the integration exists. That file store is NOT durable on Vercel —
 *     each serverless instance gets its own throwaway filesystem.
 *
 * (Vercel KV was the obvious first choice but has been retired as a first-party
 * product. @upstash/redis is its direct successor and the API is the same shape.)
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';

/*
  FINDING THE DATABASE CREDENTIALS.

  This is fussier than it looks, because there are three ways it goes wrong
  and all three have happened here:

  1. AN EMPTY VARIABLE IS NOT A VARIABLE. `.env.example` lists the two names
     with nothing after the `=`, as a template should. Paste that file into
     Vercel wholesale and you get two variables that exist and are empty — and
     a bare `||` chain treats "" as set, so it stops there and never looks at
     the real ones. Empty is now the same as absent.

  2. THE INTEGRATION MAY ADD A PREFIX. Connect Upstash with a prefix and you
     get KV_REST_API_URL_KV_REST_API_URL rather than KV_REST_API_URL. So if
     the plain names yield nothing, anything ENDING in a known name is tried,
     pairing the URL with the token that carries the same prefix.

  3. THE READ-ONLY TOKEN IS NOT THE TOKEN. Upstash also supplies
     ..._KV_REST_API_READ_ONLY_TOKEN. Matching on the exact ending keeps us
     off it — picking it up would make every read work and every write fail,
     which is the most confusing failure of the lot.
*/
const nonEmpty = (value) =>
  (typeof value === 'string' && value.trim() ? value.trim() : '');

function findCredentials(env) {
  /* The names as they are supposed to be. */
  const pairs = [
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  ];
  for (const [urlName, tokenName] of pairs) {
    const url = nonEmpty(env[urlName]);
    const token = nonEmpty(env[tokenName]);
    if (url && token) return { url, token, via: `${urlName} + ${tokenName}` };
  }

  /* Prefixed by the integration. Pair by prefix so a URL is never married to
     some other database's token. */
  for (const [urlName, tokenName] of pairs) {
    for (const name of Object.keys(env)) {
      if (name === urlName || !name.endsWith(urlName)) continue;
      const url = nonEmpty(env[name]);
      if (!url) continue;
      const prefixed = name.slice(0, -urlName.length) + tokenName;
      const token = nonEmpty(env[prefixed]);
      if (token) return { url, token, via: `${name} + ${prefixed}` };
    }
  }
  return null;
}

const CREDENTIALS = findCredentials(process.env);

/** Which pair of variables was used — for /api/health. Names only. */
export const credentialsVia = CREDENTIALS?.via ?? null;

const URL_ENV = CREDENTIALS?.url ?? '';
const TOKEN_ENV = CREDENTIALS?.token ?? '';

/*
  Local development must never write to the live database. Newer Vercel CLIs
  pull the production Upstash credentials into `vercel dev` automatically — at
  which point every local test edit would land on the real site. So local dev
  always uses the file store:
    - VERCEL_ENV is "development" under `vercel dev`
    - TIC_LOCAL_STORE=1 in the local .env is a second, explicit guard
  Deployed functions (VERCEL_ENV "production" / "preview") are unaffected.
*/
/*
  TIC_LOCAL_STORE CANNOT BREAK A DEPLOYMENT.

  Its whole purpose is to stop `vercel dev` on somebody's laptop from writing
  to the live database. On a real production or preview deployment it has no
  job at all — and left able to act there it is a loaded gun, because it is
  the sort of variable that gets copied up with the rest of a .env file and
  then silently turns the live site read-only. (That is exactly what
  happened, once.)

  So it is honoured locally and IGNORED once deployed. If the credentials are
  there, they are used.
*/
const deployed = process.env.VERCEL_ENV === 'production'
  || process.env.VERCEL_ENV === 'preview';

export const forcedLocal = !deployed
  && (process.env.VERCEL_ENV === 'development' || process.env.TIC_LOCAL_STORE === '1');

export const hasCredentials = Boolean(URL_ENV && TOKEN_ENV);

const forceLocal = forcedLocal;

export const usingRedis = Boolean(URL_ENV && TOKEN_ENV) && !forceLocal;

/*
  A DEPLOYED SITE WITH NO DATABASE MUST SAY SO.

  Vercel's filesystem is read-only everywhere except /tmp, so the file store
  below cannot work on a deployment. Without this check the failure was
  horrible to diagnose: reads quietly returned nothing and fell back to the
  starter content, so the site LOOKED fine — and then every single save threw
  a read-only-filesystem error that surfaced as "Something went wrong."

  So a deployment with no Redis credentials is now a named, explicit error
  that says which variables are missing and where to set them.

  Reads are deliberately still allowed to fall back: a site that shows its
  starter content is worth more than a site that shows nothing at all, and it
  is the SAVE that needs to tell you the truth.
*/
const onVercel = deployed;

function noDatabaseError() {
  const error = new Error(
    'No database is connected to this deployment, so nothing can be saved. '
    + 'In Vercel: Storage → Create Database → Upstash for Redis, and connect it '
    + 'to this project. That sets KV_REST_API_URL and KV_REST_API_TOKEN for you. '
    + 'Redeploy afterwards — environment variables only apply to the next build.'
  );
  /* Safe to show the person who is logged in: it names no secret, and it is
     the only way they would ever find out what is wrong. */
  error.expose = true;
  error.status = 503;
  return error;
}

/* ---------------------------------------------------------------- Redis --- */

let redisClient = null;

async function redis() {
  if (!redisClient) {
    const { Redis } = await import('@upstash/redis');
    redisClient = new Redis({ url: URL_ENV, token: TOKEN_ENV });
  }
  return redisClient;
}

/* ----------------------------------------------------------- File store --- */

const FILE = path.join(process.cwd(), '.data', 'store.json');

async function readFileStore() {
  try {
    return JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
    return {};
  }
}

/*
  Written to a temporary file and then RENAMED into place.

  writeFile on its own truncates the file and then fills it, so anything that
  reads it in between gets half a file — and two writes that overlap produce
  one file with both of their contents in it, which is not valid JSON at all
  and takes the whole store with it. Renaming is atomic: readers see either
  the old file or the new one, never a half-written one.
*/
async function writeFileStore(store) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const temporary = `${FILE}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporary, JSON.stringify(store, null, 2), 'utf8');
  await rename(temporary, FILE);
}

/*
  ONE WRITE AT A TIME.

  The atomic rename above stops a half-written file, but not a lost write:
  two saves that overlap would both read the store, both add their own key to
  their own copy, and the second would write over the first. Every write joins
  the end of this queue instead, so read-change-write always runs whole.

  This only matters for the local file store. On Redis each key is written on
  its own and the problem does not arise.

  WHAT THIS DOES NOT FIX, and does not need to: each /api route reads its
  whole object, changes one field and writes it back. If two people pressed
  Save at the same instant, both would have read the same object and the
  second would land on top of the first — on Redis exactly as much as here.
  Nothing is corrupted; one edit is simply lost.

  That is an acceptable trade for a site with one editor, and fixing it
  properly would mean per-key locking. If this ever grows to several people
  editing at once, that is the thing to build.
*/
let writeQueue = Promise.resolve();

function queueWrite(job) {
  const next = writeQueue.then(job, job);
  /* Keep the chain alive after a failure, but hand the real result back to
     whoever asked for this write. */
  writeQueue = next.catch(() => {});
  return next;
}

/* ------------------------------------------------------------ Public API --- */

/** Read a key. Returns `null` when the key has never been written. */
export async function get(key) {
  if (usingRedis) {
    const raw = await (await redis()).get(key);
    if (raw == null) return null;
    // Upstash auto-parses JSON it recognises; strings come back as strings.
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  const store = await readFileStore();
  return key in store ? store[key] : null;
}

/** Write a key. Value must be plain JSON. Returns the value written. */
export async function set(key, value) {
  if (usingRedis) {
    await (await redis()).set(key, JSON.stringify(value));
    return value;
  }
  /* The file store cannot work on Vercel — see noDatabaseError above. */
  if (onVercel) throw noDatabaseError();
  await queueWrite(async () => {
    const store = await readFileStore();
    store[key] = value;
    await writeFileStore(store);
  });
  return value;
}

/** Read a key, falling back to `fallback` (and NOT writing it) when unset. */
export async function getOr(key, fallback) {
  const value = await get(key);
  return value == null ? fallback : value;
}

/** Read a collection, always returning an array. */
export async function getList(key) {
  const value = await get(key);
  return Array.isArray(value) ? value : [];
}
