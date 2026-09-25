/**
 * A factory for list-shaped routes (events, and anything else added later).
 * They all do the same four things; only the shape of one record differs, which
 * each route supplies as `sanitize`.
 *
 *   GET     public  → { items: [...] }
 *   POST    admin   → create one record from the body
 *   PUT     admin   → update one record by id, or replace the whole list when
 *                     the body is { items: [...] } (used for reordering)
 *   DELETE  admin   → remove the record at ?id=
 *
 * Adding a collection is therefore one small file in /api. For example:
 *
 *   // api/events.js
 *   import { collectionRoute } from '../lib/collection.js';
 *   import { clean, cleanUrl, slugify } from '../lib/http.js';
 *
 *   export default collectionRoute({
 *     key: 'events',
 *     idPrefix: 'event',
 *     sanitize: (event) => ({
 *       id: event.id,
 *       slug: slugify(event.slug || event.title, event.id),
 *       title: clean(event.title, 120),
 *       imageUrl: cleanUrl(event.imageUrl),
 *     }),
 *   });
 *
 * NOTE: nothing uses this yet. It is here so the first real collection is one
 * file away.
 */

import { get, set } from './kv.js';
import { seedFor } from './seed.js';
import {
  ok,
  badRequest,
  notFound,
  methodNotAllowed,
  readBody,
  newId,
  withErrors,
} from './http.js';
import { requireAuth } from './auth.js';

const ALLOWED = ['GET', 'POST', 'PUT', 'DELETE'];

/** Read a collection, falling back to the seed when it has never been written. */
export async function readCollection(key) {
  const stored = await get(key);
  if (Array.isArray(stored)) return stored;
  const seeded = seedFor(key);
  return Array.isArray(seeded) ? seeded : [];
}

export function collectionRoute({ key, idPrefix, sanitize }) {
  return withErrors(async (req, res) => {
    const method = req.method?.toUpperCase();

    // Reading is public — this is a public website.
    if (method === 'GET') {
      return ok(res, { items: await readCollection(key) });
    }

    if (!ALLOWED.includes(method)) return methodNotAllowed(res, ALLOWED);
    // Everything below CHANGES data, so it needs a live edit session.
    if (!requireAuth(req, res)) return;

    const items = await readCollection(key);

    if (method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object') return badRequest(res, 'Expected a JSON body.');
      const record = sanitize({ ...body, id: body.id || newId(idPrefix) }, items);
      if (items.some((item) => item.id === record.id)) {
        return badRequest(res, `A record with id "${record.id}" already exists.`);
      }
      items.push(record);
      await set(key, items);
      return ok(res, { item: record, items });
    }

    if (method === 'PUT') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object') return badRequest(res, 'Expected a JSON body.');

      // Bulk replace — used for reordering and whole-list edits.
      if (Array.isArray(body.items)) {
        const replaced = body.items.map((item) =>
          sanitize({ ...item, id: item.id || newId(idPrefix) }, items)
        );
        await set(key, replaced);
        return ok(res, { items: replaced });
      }

      const index = items.findIndex((item) => item.id === body.id);
      if (index === -1) return notFound(res, `No record with id "${body.id}".`);
      // Merge, so a partial update doesn't wipe the fields the browser didn't send.
      items[index] = sanitize({ ...items[index], ...body, id: items[index].id }, items);
      await set(key, items);
      return ok(res, { item: items[index], items });
    }

    // DELETE
    const id = new URL(req.url, 'http://localhost').searchParams.get('id');
    if (!id) return badRequest(res, 'Missing ?id=');
    const remaining = items.filter((item) => item.id !== id);
    if (remaining.length === items.length) return notFound(res, `No record with id "${id}".`);
    await set(key, remaining);
    return ok(res, { items: remaining });
  });
}
