/**
 * The sitemap, at /sitemap.xml — the list of every page on this site, for
 * Google and anything else that crawls it.
 *
 * It is BUILT WHEN IT IS ASKED FOR rather than written out by hand, which is
 * the whole point: add an event in edit mode and it is in the sitemap a minute
 * later, with no separate step to forget. Delete one and it is gone.
 *
 * The fixed pages are listed here. They have to be, because the real list of
 * them lives in app.js, which runs in the browser and cannot be read from a
 * server function without a build step. If you add a page to ROUTES there,
 * add it to FIXED_PAGES below as well.
 *
 * Served as XML, and cached for an hour: a crawler reading a sitemap a few
 * minutes out of date costs nothing, and re-querying the database for every
 * crawler that wanders past costs real money.
 */

import { get } from '../lib/kv.js';
import { seedFor } from '../lib/seed.js';
import { withErrors, methodNotAllowed } from '../lib/http.js';

/* path, and how important it is relative to the others (0 to 1). Keep this in
   step with ROUTES in app.js. */
const FIXED_PAGES = [
  { path: '/',             priority: '1.0', changefreq: 'weekly'  },
  /* Second only to the homepage, and it changes every month — it is the page
     people search for by name ("taiba prayer times"). */
  { path: '/prayer-times', priority: '0.9', changefreq: 'monthly' },
  { path: '/events',       priority: '0.9', changefreq: 'weekly'  },
  { path: '/services',     priority: '0.8', changefreq: 'monthly' },
  { path: '/donate',       priority: '0.7', changefreq: 'monthly' },
  { path: '/contact',      priority: '0.7', changefreq: 'yearly'  },
  { path: '/about',        priority: '0.6', changefreq: 'yearly'  },
];

/** Five characters that are not allowed to appear raw inside XML. */
const xml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

/**
 * Where this site actually lives.
 *
 * SITE_URL if it is set, because that is the real domain and is what should
 * appear in a sitemap. Failing that, the host the request came in on — which
 * is right on a Vercel preview and while working locally, and means the
 * sitemap is never broken just because an environment variable is missing.
 */
function origin(req) {
  const configured = (process.env.SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost';
  const proto = req.headers['x-forwarded-proto'] ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default withErrors(async (req, res) => {
  if (req.method?.toUpperCase() !== 'GET') return methodNotAllowed(res, ['GET']);

  const base = origin(req);

  const stored = await get('events');
  const events = Array.isArray(stored) ? stored : (seedFor('events') ?? []);

  const entries = FIXED_PAGES.map((page) => ({
    loc: base + page.path,
    changefreq: page.changefreq,
    priority: page.priority,
  }));

  for (const event of events) {
    /* An unpublished event is not on the site, so it has no business being in
       the list of the site's pages. */
    if (event?.published === false || !event?.slug) continue;
    entries.push({
      loc: `${base}/events/${event.slug}`,
      /* The event's own date is the closest thing it has to a "last changed",
         and it is more use to a crawler than today's date on every line. */
      lastmod: /^\d{4}-\d{2}-\d{2}$/.test(event.date ?? '') ? event.date : undefined,
      changefreq: 'monthly',
      priority: '0.6',
    });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <url>
    <loc>${xml(entry.loc)}</loc>${entry.lastmod ? `
    <lastmod>${xml(entry.lastmod)}</lastmod>` : ''}
    <changefreq>${xml(entry.changefreq)}</changefreq>
    <priority>${xml(entry.priority)}</priority>
  </url>`).join('\n')}
</urlset>
`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.end(body);
});
