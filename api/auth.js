/**
 * The edit-mode session.
 *
 *   GET    → { authed, configured }   the page asks this on load, to decide
 *                                     whether to render any edit controls
 *   POST   → { password }             correct password sets the session cookie
 *   DELETE →                          clears the cookie (log out)
 */

import {
  ok,
  json,
  methodNotAllowed,
  readBody,
  withErrors,
} from '../lib/http.js';
import {
  isAuthed,
  isConfigured,
  passwordMatches,
  setSessionCookie,
  clearSessionCookie,
} from '../lib/auth.js';

/*
  A very small rate limit on wrong passwords. Serverless instances don't share
  memory, so this slows down casual guessing rather than a determined
  distributed attack — the right trade-off for a single-password gate on a
  public information site.
*/
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(key) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.first > WINDOW_MS) {
    attempts.set(key, { first: now, count: 1 });
    return false;
  }
  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

export default withErrors(async (req, res) => {
  const method = req.method?.toUpperCase();

  if (method === 'GET') {
    return ok(res, { authed: isAuthed(req), configured: isConfigured() });
  }

  if (method === 'DELETE') {
    clearSessionCookie(res);
    return ok(res, { authed: false });
  }

  if (method !== 'POST') return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);

  if (!isConfigured()) {
    return json(res, 503, {
      error:
        'Edit mode is not set up. Add ADMIN_PASSWORD and SESSION_SECRET to the project environment variables.',
    });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (tooManyAttempts(ip)) {
    return json(res, 429, { error: 'Too many attempts. Try again later.' });
  }

  const body = await readBody(req);
  if (!passwordMatches(body?.password)) {
    return json(res, 401, { error: 'Incorrect password.' });
  }

  attempts.delete(ip);
  setSessionCookie(res);
  return ok(res, { authed: true });
});
