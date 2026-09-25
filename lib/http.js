/** Small helpers shared by every /api route. */

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export const ok = (res, body) => json(res, 200, body);
export const badRequest = (res, message) => json(res, 400, { error: message });
export const unauthorized = (res) => json(res, 401, { error: 'Not authorised.' });
export const notFound = (res, message = 'Not found.') => json(res, 404, { error: message });

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return json(res, 405, { error: `Method not allowed. Allowed: ${allowed.join(', ')}` });
}

/** Read + JSON-parse the request body, tolerating an already-parsed body. */
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    // Everything stored here is text; anything this large is a mistake or an attack.
    if (size > 1_000_000) throw new Error('Request body too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers?.cookie;
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Collapse whitespace and cap the length — used on every stored single-line string. */
export function clean(value, maxLength = 300) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/** Multi-line variant: keeps newlines, collapses runs of blank lines. */
export function cleanMultiline(value, maxLength = 5000) {
  if (value == null) return '';
  return String(value).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLength);
}

/**
 * Only allow URLs we are willing to put in an href or src.
 * Blocks javascript:, data:, and anything else that could execute.
 */
export function cleanUrl(value) {
  const raw = clean(value, 2000);
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function slugify(value, fallback = 'item') {
  const slug = String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

/** Stable-ish unique id. */
export function newId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Wrap a handler so an unexpected throw becomes a 500 instead of a hang. */
/*
  The last line of defence: anything a route throws is caught here so a single
  bad request can never take a function down.

  An unexpected error stays DELIBERATELY VAGUE to whoever asked — the details
  go to the log, not to the internet, because a raw stack trace tells a
  stranger about the inside of the site.

  The exception is an error explicitly marked `expose`. That flag is only set
  where the message is both safe to read and the only way anybody would work
  out what is wrong — a missing database being the one that matters. A person
  logged into edit mode, told "Something went wrong.", has nowhere to go.
*/
export function withErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(`[api] ${req.method} ${req.url}`, error);
      if (res.headersSent) return;
      if (error?.expose) return json(res, error.status ?? 500, { error: error.message });
      json(res, 500, { error: 'Something went wrong.' });
    }
  };
}
