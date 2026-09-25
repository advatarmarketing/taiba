/* ==========================================================================
   Taiba Islamic Centre — single-page app

   Vanilla JavaScript. No framework, no build step: this file is loaded
   straight by the browser and runs as-is. Editing it and refreshing is the
   entire development loop.

   How the page gets on screen:
     1. boot()           asks the server for the saved text and whether you are
                         logged in
     2. renderRoute()    picks the matching page, builds its HTML as a string,
                         and drops header + page + footer into <div id="app">
     3. applyCopy()      swaps in any text you've edited, before you see it

   Navigation never reloads the page — clicks on internal links are caught and
   handled here, and the address bar is updated with the History API.
   ========================================================================== */


/* --------------------------------------------------------------- Utils --- */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Make a value safe to drop into HTML. Used on EVERY dynamic value, without
 * exception — it is what stops saved text from being able to run as code.
 */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);

/**
 * Make a value safe to use as a link or an image source. Admin-authored content
 * is still not a reason to allow `javascript:` through; the API sanitises too,
 * and this is the second line of defence.
 */
function safeUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^(https?:|mailto:|tel:|\/)/i.test(raw)) return esc(raw);
  return '';
}

/*
  Cloudinary.

  Images are ALWAYS pasted URLs on this site — there are no file uploads
  anywhere. Paste a delivery URL straight out of the Cloudinary media library
  into any image field and it is served fit for the web: `f_auto` picks the
  best format the browser supports, `q_auto` picks a sensible quality, and
  `c_limit,w_…` caps the width.

  Without that, the URL points at the original upload — often several thousand
  pixels wide — which is slow to fetch and heavy for a phone to hold.

  `c_limit` only ever scales down, never up. A URL that already carries its own
  transformations is somebody being deliberate, so it is left exactly as pasted.
  Anything that isn't a Cloudinary URL passes straight through untouched.
*/
const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/(?:upload|fetch|private|authenticated))\/(.+)$/i;
const CLOUDINARY_TRANSFORM = /^[a-z]{1,3}_[^/]+(?:,[a-z]{1,3}_[^/]+)*\//i;

function cloudinaryFit(url, width) {
  const match = CLOUDINARY.exec(url);
  if (!match) return url;
  const [, base, kind, rest] = match;
  if (CLOUDINARY_TRANSFORM.test(rest)) return url;
  // Video keeps its own size — a width cap belongs to whoever cut the footage.
  const fit = kind.toLowerCase() === 'video' || !width
    ? 'f_auto,q_auto'
    : `f_auto,q_auto,c_limit,w_${width}`;
  return `${base}/${fit}/${rest}`;
}

/** A URL for an <img> or <video>: checked, and sized if it is a Cloudinary one. */
function assetUrl(value, width = 1200) {
  const raw = String(value ?? '').trim();
  if (!/^(https?:|\/)/i.test(raw)) return '';
  return esc(cloudinaryFit(raw, width));
}

const $  = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Read a nested value by dotted path: getPath(obj, 'contact.email'). */
const getPath = (object, path) =>
  path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), object);

/** Write a nested value by dotted path, creating objects on the way down. */
function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((acc, key) => (acc[key] ??= {}), object);
  target[last] = value;
  return object;
}


/* --------------------------------------------------------------- Icons --- */

/* One monoline SVG set, one visual style throughout. No emoji anywhere. */
const ICONS = {
  arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  arrowLeft:  '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  close:      '<path d="M6 6l12 12M18 6L6 18"/>',
  menu:       '<path d="M4 7h16M4 12h16M4 17h16"/>',
  check:      '<path d="M4 12.5l5 5L20 6.5"/>',
  alert:      '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  pencil:     '<path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4z"/>',
  mail:       '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  image:      '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-9 8"/>',
  film:       '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 12h18"/>',
  instagram:  '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1"/>',
  facebook:   '<path d="M14.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.5-1.5H18V3.9A19 19 0 0 0 15.6 3.8c-2.3 0-3.9 1.4-3.9 4V10H9v3h2.7v8z"/>',
  youtube:    '<rect x="2.5" y="6" width="19" height="12" rx="3.5"/><path d="M10.5 9.5l5 2.5-5 2.5z"/>',
  whatsapp:   '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.4 2.5 3 5.1 5.5 5.5l1-1.4 2 .9v1.8c-3.7.6-8.3-3.9-7.7-7.7h1.8l.9 2z"/>',
  trash:      '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  plus:       '<path d="M12 5v14M5 12h14"/>',
  lock:       '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  logout:     '<path d="M15 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9"/><path d="M14 12h7M18 8l3 4-3 4"/>',
  text:       '<path d="M5 6h14M5 6v-.5M9 18h6M12 6v12"/>',
  play:       '<path d="M8 5.5l10.5 6.5L8 18.5z"/>',
  arrowUp:    '<path d="M12 20V4M6 10l6-6 6 6"/>',
  arrowDown:  '<path d="M12 4v16M6 14l6 6 6-6"/>',
  search:     '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L21 21"/>',

  /* The three the mosque pages needed that a youth site never did. */
  clock:      '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
  pin:        '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  /* The arch from the logo, drawn as a line. Used where a section needs the
     mark itself rather than a picture — an empty prayer timetable, say. */
  arch:       '<path d="M5 21V10a7 7 0 0 1 14 0v11"/><path d="M9 21v-4a3 3 0 0 1 6 0v4"/>',
};

/**
 * Render an icon. `name` must be a key of ICONS — never user input.
 *
 * A name that isn't in the set is a typo, and silently drawing a tick instead
 * hides it: you end up with a "picture goes here" placeholder wearing a
 * checkmark and no obvious reason why. So it warns, and draws nothing.
 */
function icon(name, extraClass = '') {
  const inner = ICONS[name];
  if (!inner) {
    console.warn(`[icon] there is no icon called "${name}"`);
    return '';
  }
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
}


/* ------------------------------------------------------------ API layer --- */

/** One place where every request to /api goes through. */
async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',   // sends the login cookie
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

const api = {
  get:  (path)       => request(path),
  post: (path, body) => request(path, { method: 'POST',   body }),
  put:  (path, body) => request(path, { method: 'PUT',    body }),
  del:  (path)       => request(path, { method: 'DELETE' }),
};


/* ---------------------------------------------------------------- State --- */

/*
  Everything the running page knows. Fetched once, then reused — `invalidate`
  forces a refetch after something is saved.
*/
const state = {
  copy: null,            // { "home.hero.title": "…" } — your text overrides
  settings: null,        // the contact email, social links and site-wide media
  prayer: null,          // today's times, from Mawaqit — see api/prayer.js
  events: null,          // the events list — the menu counts these
  services: null,        // the rows in the table on Services
  clips: null,           // short films for the homepage grid
  pageMeta: null,        // a page's own title/description/picture, when it has one
  copyEditing: false,    // is "Edit text" switched on right now?
  authed: false,         // is there a valid edit-mode session?
  authConfigured: false, // has ADMIN_PASSWORD been set on the server at all?
};

/* Adding a collection is one line here and one line in `state` above. */
const CACHE_KEYS = {
  copy: '/api/copy',
  settings: '/api/settings',
  prayer: '/api/prayer',
  events: '/api/events',
  services: '/api/services',
  clips: '/api/clips',
};

/** How each endpoint's reply is unwrapped. Lists come back as { items }. */
function unwrap(key, payload) {
  if (key === 'copy') return payload.copy;
  if (key === 'settings') return payload.settings;
  if (key === 'prayer') return payload.prayer;
  return payload.items;
}

async function load(key) {
  if (state[key] != null) return state[key];
  state[key] = unwrap(key, await api.get(CACHE_KEYS[key]));
  return state[key];
}

const invalidate = (key) => { state[key] = null; };


/* ---------------------------------------------------------------- Toast --- */

/* A small message in the corner. Announced to screen readers via aria-live. */
const toastRegion = Object.assign(document.createElement('div'), { className: 'toast-region' });
toastRegion.setAttribute('role', 'status');
toastRegion.setAttribute('aria-live', 'polite');
document.body.append(toastRegion);

function toast(message, tone = 'ok') {
  const node = document.createElement('div');
  node.className = 'toast';
  node.dataset.tone = tone;
  node.innerHTML = `${icon(tone === 'ok' ? 'check' : 'alert')}<span>${esc(message)}</span>`;
  toastRegion.append(node);
  setTimeout(() => node.remove(), 4200);
}


/* ---------------------------------------------------------------- Modal --- */

let openModalCleanup = null;

/**
 * A dialog that traps keyboard focus inside itself. Escape closes it, clicking
 * the dark area outside closes it, and focus goes back to whatever opened it.
 */
function openModal({ title, subtitle = '', body, onMount, labelledBy = 'modal-title', className = '' }) {
  closeModal();

  const opener = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${esc(className)}" role="dialog" aria-modal="true" aria-labelledby="${esc(labelledBy)}"
         data-lenis-prevent>
      <div class="modal-head">
        <div>
          <h2 id="${esc(labelledBy)}">${esc(title)}</h2>
          ${subtitle ? `<p class="modal-sub">${esc(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Close dialog">${icon('close')}</button>
      </div>
      <div class="modal-body"></div>
    </div>`;

  const modal = $('.modal', backdrop);
  const bodyHost = $('.modal-body', backdrop);
  if (typeof body === 'string') bodyHost.innerHTML = body;
  else if (body instanceof Node) bodyHost.append(body);

  document.body.append(backdrop);
  document.body.style.overflow = 'hidden';

  /*
    Stop the smooth scroller while a dialog is up.

    `overflow: hidden` on the body does not hold Lenis: it animates the scroll
    position directly rather than letting the browser do it, so the page kept
    gliding along behind an open form. The menu overlay already does this —
    dialogs were simply missed.

    `data-lenis-prevent` on the panel handles the other half, letting the
    dialog itself scroll normally while this keeps the page still.
  */
  lenis?.stop();

  const focusables = () =>
    $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', modal)
      .filter((node) => node.offsetParent !== null);

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = focusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) closeModal();
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', onKeydown);

  openModalCleanup = () => {
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
    document.body.style.overflow = '';
    /* Give the page its smooth scrolling back. Safe to call when the menu is
       also open: closeMenu() starts it again too, and start() twice is a
       no-op. */
    lenis?.start();
    if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    openModalCleanup = null;
  };

  (focusables()[0] ?? modal).focus();
  onMount?.(bodyHost, closeModal);
  return closeModal;
}

function closeModal() {
  openModalCleanup?.();
}


/* ------------------------------------------------------------- Site copy --- */

/*
  THE data-copy SYSTEM — the thing that makes the site editable.

  Every fixed piece of text on the site carries a key:

      <h1 data-copy="home.hero.title">Taiba Islamic Centre</h1>

  The wording inside the tag is the DEFAULT. It lives in this file and is what
  every visitor sees until somebody edits it. When you edit it in edit mode, an
  override is saved against that key, and applyCopy() swaps it in immediately
  after every render — in the same tick, so there is never a flash of the old
  wording. Resetting deletes the override and the default comes back.

  Naming: "page.section.thing", lower case, dots. Keep them stable — renaming a
  key orphans whatever was saved against the old one.
*/

/** Saved text is plain text; a newline in it becomes a real line break. */
const renderCopy = (text) => esc(text).replace(/\n/g, '<br>');

/**
 * A stored block of writing, as paragraphs. A blank line starts a new one; a
 * single newline is just a line break. Escaped first, so nothing typed into an
 * event's write-up can ever run as code.
 */
const paragraphs = (text) => esc(text ?? '')
  .split(/\n{2,}/)
  .filter(Boolean)
  .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
  .join('');

function applyCopy(root = document) {
  const copy = state.copy ?? {};
  $$('[data-copy]', root).forEach((node) => {
    const value = copy[node.dataset.copy];
    if (typeof value === 'string' && value) node.innerHTML = renderCopy(value);
  });
}

/** A stable key fragment from a label: "Services" → "services". */
const copyKey = (value) =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Admin-only markup. Returns an empty string unless there is a live session, so
 * the edit controls are ABSENT from the page for visitors rather than merely
 * hidden with CSS. Every save is re-checked on the server regardless.
 */
const editOnly = (html) => (state.authed ? html : '');

const emptyState = (heading, message) => `
  <div class="empty-state">
    <h3>${esc(heading)}</h3>
    <p>${esc(message)}</p>
  </div>`;


/* ------------------------------------------------------------ Fragments --- */

/*
  Every navigation link on the site, in one place. The header deliberately
  shows NONE of them — it carries the logo, the Menu trigger and Donate, and
  everything else lives in the menu overlay. The footer lists them all.

  PRAYER TIMES IS FIRST, and that is not an accident. It is the reason most
  people open a mosque's website at all, so it is the first thing in the menu
  and the first thing in the footer.

  `count` names a collection in `state`; where it is set, the live number of
  records is shown beside the link. That is what makes "Events 3" real rather
  than a number somebody typed in and then forgot to update.
*/
const NAV_ITEMS = [
  { href: '/prayer-times', label: 'Prayer Times' },
  { href: '/services',     label: 'Services', count: 'services' },
  { href: '/events',       label: 'Events', count: 'events' },
  { href: '/about',        label: 'About' },
  { href: '/donate',       label: 'Donate' },
  { href: '/contact',      label: 'Contact' },
];

/*
  The footer's social row. `key` is the field in settings.social, so adding a
  network is one line here plus one line in api/settings.js.

  Facebook rather than TikTok: the people who need to know when the janazah
  is are on Facebook, and a mosque's noticeboard follows its congregation
  rather than the other way round.
*/
const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', icon: 'instagram' },
  { key: 'facebook',  label: 'Facebook',  icon: 'facebook' },
  { key: 'youtube',   label: 'YouTube',   icon: 'youtube' },
  { key: 'whatsapp',  label: 'WhatsApp',  icon: 'whatsapp' },
];


/* ----------------------------------------------------------------- Logo --- */

/*
  THE LOCKUP IS HALF PICTURE AND HALF TYPE.

  The arch is a picture, in one of two files named after the colour of the
  ARTWORK rather than the background it goes on:

    mark-light.png   white lines and pale gold — for a dark background
    mark-dark.png    navy and gold — for the parchment page

  The header uses the light one while it is transparent over a DARK hero, and
  the dark one the rest of the time; app.js swaps the `src` when the header
  changes state, and the height is fixed in CSS so the swap can never shift
  the layout by a pixel.

  "TAIBA / ISLAMIC CENTRE" beside it is NOT a picture. It is live text, set in
  the heading serif with the logo's own tracking — see .brand-name in
  styles.css. The artwork arrived 627px wide, which leaves those two words
  about 14px tall: fine for the stacked logo on the loading panel, soft at
  every size a header is drawn at. Type is sharp on any screen, scales with
  the layout, and is read by a search engine as the name of the organisation
  instead of as a rectangle.

  The image therefore carries alt="" — it would otherwise say the name a
  second time, immediately after the text that already says it. The link
  around the whole lockup has the aria-label.

  The width and height below are the arch file's REAL proportions. They are
  not the size it is drawn at (CSS decides that); they are there so the
  browser can reserve the right shape before the picture arrives, which is
  what stops the header jumping as it loads. If the artwork is replaced,
  scripts/make-logos.py prints the new numbers.
*/
const MARK_LIGHT = '/assets/mark-light.png';
const MARK_DARK = '/assets/mark-dark.png';

const brandMark = (variant = 'dark') => `
  <span class="brand-lockup">
    <img class="brand-mark" src="${variant === 'light' ? MARK_LIGHT : MARK_DARK}"
         alt="" width="318" height="418" decoding="async">
    <span class="brand-word">
      <span class="brand-name">Taiba</span>
      <span class="brand-sub">Islamic Centre</span>
    </span>
  </span>`;


/* --------------------------------------------------------------- Header --- */

/**
 * The fixed top bar. Everything about how it MOVES is in mountHeader() and
 * styles.css — this only lays out what is in it.
 */
function headerFragment() {
  return `
  <header class="header" data-hidden="false" data-transparent="false" data-on-dark="false">
    <div class="header-inner">
      <a class="brand" href="/" aria-label="Taiba Islamic Centre — home">${brandMark('dark')}</a>

      <div class="header-actions">
        <a class="header-cta" href="/donate" data-copy="header.donate">Donate</a>
        <button type="button" class="menu-trigger" data-menu-open
                aria-expanded="false" aria-controls="menu" data-copy="header.menu">Menu</button>
      </div>
    </div>
  </header>`;
}


/* ----------------------------------------------------------------- Menu --- */

/**
 * The full-screen overlay. Slides down from above the header and covers it.
 * The links are numbered here (--i) so the CSS can stagger them.
 */
function menuFragment(path) {
  const link = (item, index) => {
    /*
      A live count, where the link has one. It reads from whatever is already
      in `state` — if the collection hasn't loaded yet, no number is shown
      rather than a wrong one, and the menu re-renders once it arrives.
    */
    const records = item.count ? state[item.count] : null;
    const total = Array.isArray(records)
      ? records.filter((record) => record.published !== false).length
      : null;

    const count = total
      ? `<span class="menu-count" aria-label="${total} ${esc(item.label.toLowerCase())}">${total}</span>`
      : '';

    return `
      <li style="--i:${index}">
        <a class="menu-link" href="${item.href}"${item.href === path ? ' aria-current="page"' : ''}>
          <span data-copy="nav.${copyKey(item.label)}">${esc(item.label)}</span>${count}
        </a>
      </li>`;
  };

  return `
  <div class="menu" id="menu" data-open="false" role="dialog" aria-modal="true"
       aria-label="Site menu">
    <button type="button" class="menu-close" data-menu-close>
      ${icon('close')}<span data-copy="menu.close">Close</span>
    </button>

    <nav aria-label="Main">
      <ul class="menu-links">${NAV_ITEMS.map(link).join('')}</ul>
    </nav>
  </div>`;
}


/* --------------------------------------------------------------- Footer --- */

function footerFragment() {
  const settings = state.settings ?? {};
  const email = settings.contact?.email ?? '';
  const address = settings.contact?.address ?? '';
  const social = settings.social ?? {};

  /*
    A network with no URL saved yet is still shown, but greyed out and not
    clickable — so it is obvious there is a gap to fill, rather than the row
    silently being short.
  */
  const socialLink = ({ key, label, icon: name }) => {
    const url = safeUrl(social[key]);
    if (!url) {
      return `<span class="social-link" aria-disabled="true" role="img"
                    aria-label="${esc(label)} — not set up yet">${icon(name)}</span>`;
    }
    return `<a class="social-link" href="${url}" target="_blank" rel="noopener noreferrer"
               aria-label="${esc(label)}">${icon(name)}</a>`;
  };

  return `
  <footer class="footer">
    <div class="shell">
      <div class="footer-top">

        <div>
          <!-- The reversed lockup: the footer is navy. -->
          <a class="brand" href="/" aria-label="Taiba Islamic Centre — home">${brandMark('light')}</a>
          <p class="micro" style="margin-top:var(--space-2); max-width:28ch"
             data-copy="footer.tagline">A mosque and community centre — open for every prayer,
             and for everyone.</p>

          ${address ? `<p class="micro footer-address" style="margin-top:var(--space-1); max-width:28ch">${esc(address)}</p>` : ''}
        </div>

        <nav aria-label="Footer">
          <p class="footer-heading" data-copy="footer.heading.pages">Pages</p>
          <ul class="footer-links">
            ${NAV_ITEMS.map((item) =>
              `<li><a href="${item.href}" data-copy="nav.${copyKey(item.label)}">${esc(item.label)}</a></li>`).join('')}
          </ul>
        </nav>

        <div>
          <p class="footer-heading" data-copy="footer.heading.follow">Follow</p>
          <div class="socials">${SOCIAL_LINKS.map(socialLink).join('')}</div>
        </div>

        <div>
          <p class="footer-heading" data-copy="footer.heading.contact">Get in touch</p>
          ${email
            ? `<a class="text-link" href="mailto:${esc(email)}">${esc(email)}</a>`
            : `<p class="micro" data-copy="footer.email.empty">Email address not set yet.</p>`}
          ${editOnly(`
          <div style="margin-top:var(--space-1)">
            <button type="button" class="edit-chip" data-edit="contact-social">
              ${icon('pencil')} Contact &amp; social links
            </button>
          </div>`)}
        </div>

      </div>

      ${editOnly(`
      <div style="margin-top:var(--space-2)">
        <button type="button" class="edit-chip" data-edit="events">${icon('pencil')} Manage events</button>
        <button type="button" class="edit-chip" data-edit="prayer">${icon('clock')} Prayer timetable</button>
        <button type="button" class="edit-chip" data-edit="seo">${icon('search')} Page titles &amp; descriptions</button>
        <button type="button" class="edit-chip" data-edit="text-overrides">${icon('text')} Text you have changed</button>
      </div>`)}

      <div class="footer-bottom">
        <span>
          &copy; ${new Date().getFullYear()}
          <span data-copy="footer.legal">Taiba Islamic Centre</span>
        </span>

        <!-- The way in to edit mode. Visible to everyone; useless without the password. -->
        <button type="button" class="webdev-pill" data-webdev>
          ${icon('lock')}<span data-copy="footer.webdev">Web dev edit</span>
        </button>
      </div>
    </div>
  </footer>`;
}


/**
 * A placeholder page. Every route still uses this: a label, a heading, a line
 * of text, and a note saying the content isn't built yet. Each piece carries a
 * data-copy key, so text editing can be tried on any page.
 *
 * `data-hero` marks the section the header sits over while transparent, and
 * `data-hero-tone` tells the header whether that section is dark enough to
 * need the light logo and light text. These heroes are all pale for now, so
 * the tone is "light" — set it to "dark" on a hero once it carries a photo or
 * a video behind the text.
 */
function placeholderPage({ key, label, title, lede }) {
  return `
  <main id="main" class="page">
    <section class="shell" data-hero data-hero-tone="light"
             style="padding-block: calc(var(--unit) + var(--space-4)) var(--space-4)">
      <p class="label" data-reveal="text" data-copy="${esc(key)}.label">${esc(label)}</p>

      <h1 class="display-1" data-reveal="text" style="margin-top:var(--space-1)"
          data-copy="${esc(key)}.title">${esc(title)}</h1>

      <p class="prose" data-reveal="text" style="margin-top:var(--space-2)"
         data-copy="${esc(key)}.lede">${esc(lede)}</p>

      <p class="tiny" style="margin-top:var(--space-3)">
        This page has no sections yet — it is the routing skeleton.
        Everything above can already be edited in edit mode.
      </p>
    </section>
  </main>`;
}



/* ============================================================ Pages ======= */

/*
  Each page is a function returning an HTML string. They are `async` because
  real pages will load data before rendering; the placeholders have nothing to
  load yet.
*/

/*
  The homepage, in ten sections:

     1. Hero            the arch, the name, and today's prayer times docked
                        along the bottom of it
     2. Welcome         who we are, in a paragraph, beside one picture
     3. Prayer times    the full timetable, and Jumu'ah beside it
     4. Services        what the centre runs, as a grid of arches
     5. Featured event  the next one coming up, given the whole width
     6. Upcoming strip  up to four cards, laid out for however many there are
     7. Values          six words, one at a time, across a pinned screen
     8. Recent clips    a grid of short films; hidden while there are none
     9. Full-width film the break at 33:20, playing only while it is on screen
    10. Donate          the one big band of colour on the site

  THE ORDER IS THE ARGUMENT. Somebody arriving at a mosque's website wants one
  of three things: when is the next prayer, what is on, and how do I give. The
  first is answered before they scroll at all, the second twice over, and the
  third closes the page.

  EVERY piece of media here is a URL pasted in from edit mode, and every one
  has a designed empty state — see mediaSlot() below. Nothing on this page
  looks broken before the real photography exists.
*/


/*
  THE SIX VALUES. The words and their lines are DEFAULTS in the markup, each
  with its own data-copy key, so both can be rewritten in edit mode. Only the
  background media is stored, keyed by `key` — see api/settings.js.
*/
const VALUES = [
  { key: 'prayer',    word: 'Prayer',    line: 'Five times a day, every day.' },
  { key: 'quran',     word: "Qur'an",    line: 'Read, learned and lived.' },
  { key: 'knowledge', word: 'Knowledge', line: 'A class for every age.' },
  { key: 'family',    word: 'Family',    line: 'Room in it for everyone.' },
  { key: 'service',   word: 'Service',   line: 'To the street we stand on.' },
  { key: 'belonging', word: 'Belonging', line: 'A door that is always open.' },
];


/* ------------------------------------------------------------ The prayers --- */

/*
  THE TIMETABLE.

  Six rows, always the same six and always in this order, because that is the
  order of the day. The times themselves are stored as free text — see
  PRAYER_FIELDS — and are typed in by hand each month off the printed
  timetable the mosque already uses.

  FREE TEXT, AND NOT A CALCULATION. It would be perfectly possible to work
  these out in the browser from a latitude and a calculation method, and it
  would be the wrong thing to do: a mosque's jamaah times are a decision the
  imam makes, not an astronomical fact. They get rounded, they hold steady for
  a fortnight at a time, they move for Ramadan, and they are what is printed
  on the door. The website's job is to show the same numbers as the door.

  `jamaah` is the congregation time, `begins` is when the time comes in.
  Sunrise has no jamaah, which is why the table leaves that cell alone rather
  than showing an empty box.
*/
const PRAYERS = ['Fajr', 'Sunrise', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];

/** Sunrise is a time of day, not a prayer — nothing is prayed in congregation. */
const NO_JAMAAH = new Set(['sunrise', 'shuruq', 'shurooq', 'sunset']);

/**
 * Today's timetable, padded out to the six rows the table always shows.
 *
 * WHERE THE ROWS COME FROM. `state.prayer` is today's times read from the
 * centre's own Mawaqit page — the same timetable as the screen in the prayer
 * hall — and it is preferred whenever it is there. The hand-typed rows in
 * settings are the fallback for the one case where Mawaqit has never been
 * reachable at all. api/prayer.js decides between them; this function only
 * has to notice which arrived.
 *
 * A mosque that has filled in only Fajr still gets a complete table with five
 * rows waiting in it, rather than one lonely row that looks like the page is
 * broken. Anything beyond the six — Tarawih in Ramadan, say — is kept and
 * shown after them.
 */
function prayerRows(settings) {
  const live = Array.isArray(state.prayer?.times) ? state.prayer.times : [];
  const stored = live.length
    ? live
    : (Array.isArray(settings?.prayer) ? settings.prayer : []);
  const find = (name) => stored.find((row) =>
    String(row?.name ?? '').trim().toLowerCase() === name.toLowerCase());

  const known = PRAYERS.map((name) => {
    const row = find(name) ?? {};
    return { name, begins: row.begins ?? '', jamaah: row.jamaah ?? '' };
  });

  const extra = stored.filter((row) =>
    row?.name && !PRAYERS.some((name) => name.toLowerCase() === String(row.name).trim().toLowerCase()));

  return [...known, ...extra];
}

/** True once any time at all has been typed in. */
const hasPrayerTimes = (rows) => rows.some((row) => row.begins || row.jamaah);

/**
 * "6.15pm", "18:15", "6:15 PM" → minutes since midnight. Anything it cannot
 * read gives null, and the caller treats that as "no time here" rather than
 * guessing — a wrong "next prayer" is worse than none.
 */
function parseClock(value) {
  const match = /(\d{1,2})[:.](\d{2})\s*(am|pm)?/i.exec(String(value ?? ''));
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = (match[3] ?? '').toLowerCase();

  if (minute > 59 || hour > 23) return null;
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;

  return hour * 60 + minute;
}


/* ------------------------------------------------------------ Media slot --- */

/** True when a URL points at something a <video> should play rather than an <img>. */
const isVideoUrl = (url) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);

/**
 * A picture, a video, or a labelled placeholder saying what belongs there.
 *
 * This is the single most important helper on the page. Rayyan is adding all
 * the real media himself afterwards, so every slot has to READ as a deliberate
 * empty state rather than a hole — a dashed frame with an icon and the name of
 * what goes in it, the same idea as Advatar's "Asset coming soon" tiles.
 */
function mediaSlot({ url, poster = '', label, ratio = '', className = '', alt = '', cover = true }) {
  const style = ratio ? ` style="aspect-ratio:${ratio}"` : '';
  const fit = cover ? ' data-fit="cover"' : '';

  if (!url) {
    return `
      <div class="media media--empty ${className}"${style}${fit}>
        ${icon('image')}
        <span class="media-empty-label">${esc(label)}</span>
      </div>`;
  }

  if (isVideoUrl(url)) {
    /*
      muted + playsinline are what let a video autoplay at all on a phone —
      without both, iOS refuses and you get a black rectangle.
    */
    /* A <video> has nowhere to put alt text, so the description goes in a
       visually-hidden line beside it instead — read out, never seen. */
    return `
      <div class="media ${className}"${style}${fit}>
        <video autoplay muted loop playsinline preload="metadata"
               ${poster ? `poster="${assetUrl(poster, 1920)}"` : ''} aria-hidden="true">
          <source src="${assetUrl(url)}">
        </video>
        ${alt ? `<span class="visually-hidden">${esc(alt)}</span>` : ''}
      </div>`;
  }

  return `
    <div class="media ${className}"${style}${fit}>
      <img src="${assetUrl(url, 1400)}" alt="${esc(alt)}" loading="lazy" decoding="async">
    </div>`;
}


/* -------------------------------------------------- Full-width film ------- */

/*
  THE FULL-WIDTH FILM, built to the reference's measurements: a figure at
  33:20 running the whole width of the screen, with the film inside it cropped
  to fill.

  It does NOT autoplay. The video starts when the section scrolls into view and
  pauses the moment it leaves — which is the whole point, because a film
  playing quietly three screens above you costs exactly as much battery as one
  you are watching. mountFilms() does that part.

  Used twice:
    - behind the heading above the table on /services, darkened so the
      heading over it stays readable
    - as a full-bleed break between the values and the support band

  `overlay` is the HTML that sits on top. Passing any turns the scrim on.
*/

const FILM_SLOTS = [
  {
    key: 'services',
    title: 'Film behind the services heading',
    subtitle: 'The footage that loops behind the heading above the table on Services. It is darkened automatically so the words over it stay readable.',
  },
  {
    key: 'break',
    title: 'Full-width film on the homepage',
    subtitle: 'The break between the values and the support band. Nothing sits on top of this one, so it is shown as it is.',
  },
];

function filmSection({ slot, film, label, overlay = '', className = '' }) {
  const video = film?.videoUrl ?? '';
  const poster = film?.posterUrl ?? '';
  const alt = film?.alt ?? '';
  const hasMedia = Boolean(video || poster);

  /*
    A poster is not decoration. It is the first frame anyone sees, it is what
    is shown while the file downloads, and it is what stands in for the film
    entirely for a visitor who has asked their device to reduce motion. So
    when there is a film and no poster, edit mode says so.
  */
  const missingPoster = Boolean(video) && !poster;

  const inner = video
    ? `
      <video class="film-video" data-film-video loop muted playsinline preload="metadata"
             ${poster ? `poster="${assetUrl(poster, 1920)}"` : ''}>
        <source src="${assetUrl(video)}">
      </video>`
    : poster
      ? `<img class="film-video" src="${assetUrl(poster, 1920)}" alt="${esc(alt)}" loading="lazy" decoding="async">`
      : `
      <div class="film-empty">
        ${icon('film')}
        <span class="media-empty-label">${esc(label)}</span>
      </div>`;

  return `
  <section class="film-section ${className}">
    <figure class="film" data-film data-film-label="${esc(label)}"
            data-has-media="${hasMedia ? 'true' : 'false'}"
            data-has-overlay="${overlay ? 'true' : 'false'}"
            data-reveal ${overlay && hasMedia ? 'data-cursor="invert"' : ''}>
      ${inner}

      <!-- Darkens the film so white text on top of it stays readable. Only
           drawn when something is actually on top. -->
      ${overlay ? '<div class="film-scrim" aria-hidden="true"></div>' : ''}
      ${overlay ? `<div class="film-overlay"><div class="shell">${overlay}</div></div>` : ''}

      <!-- Describes the footage to anyone who cannot watch it. -->
      ${hasMedia && alt ? `<figcaption class="visually-hidden">${esc(alt)}</figcaption>` : ''}
    </figure>

    ${editOnly(`
    <div class="film-edit shell">
      <button type="button" class="edit-chip" data-edit="film-${esc(slot)}">
        ${icon('pencil')} ${hasMedia ? 'Change this film' : esc(label)}
      </button>
      ${missingPoster ? '<span class="tiny">No poster image set — the film has nothing to show while it loads.</span>' : ''}
    </div>`)}
  </section>`;
}


/* --------------------------------------------------------- Event helpers --- */

/*
  The categories to start with. NOT a fixed list: `category` is free text on
  the record, and the edit form offers these plus every one already in use as
  suggestions. Type a new one and it becomes a suggestion for the next event.
  Nothing in the code has to change to add one.
*/
const EVENT_CATEGORIES = ['Talk', 'Class', 'Community', 'Fundraiser', 'Youth', 'Ramadan'];

/** Everything above, plus whatever is actually in use, alphabetically. */
const eventCategories = () => [...new Set([
  ...EVENT_CATEGORIES,
  ...(state.events ?? []).map((event) => event.category).filter(Boolean),
])].sort((a, b) => a.localeCompare(b));

/** Today at midnight, so an event happening TODAY still counts as upcoming. */
function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/** "2026-10-02" → "2 October 2026". An unparseable or empty date gives ''. */
function formatEventDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Split the events into what's coming and what's been, each in the order you
 * would want to read them: upcoming soonest-first, past most-recent-first.
 *
 * THIS IS WORKED OUT EVERY TIME A PAGE IS DRAWN, from the date alone. There is
 * no stored "past" flag anywhere, so nothing ever has to be moved by hand when
 * an event goes by — it moves itself, overnight, on its own.
 *
 * Unpublished events are dropped here, once, so nothing further down has to
 * remember to check. An event with no date at all is treated as upcoming —
 * it is far more likely to be one somebody is still writing than one that has
 * already happened.
 */
function sortEvents(events) {
  const today = startOfToday();
  const live = (events ?? []).filter((event) => event.published !== false);

  const upcoming = live
    .filter((event) => !event.date || new Date(`${event.date}T00:00:00`) >= today)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

  const past = live
    .filter((event) => event.date && new Date(`${event.date}T00:00:00`) < today)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return { upcoming, past };
}

/**
 * The one event the homepage shows large: a flagged one if there is one still
 * to come, otherwise simply the next. With nothing ahead at all, the most
 * recent that has been — an old event reads better than an empty section.
 */
function pickFeatured({ upcoming, past }) {
  return upcoming.find((event) => event.featured) ?? upcoming[0] ?? past[0];
}


/* ------------------------------------------------------------ Event card --- */

/*
  HOW WIDE THE CARDS ARE, AND WHAT SHAPE THEIR PICTURES ARE, is worked out from
  how many there are — see "When there isn't much content yet" in the README.
  Both grids that show events use this, so they can never drift apart.

    `max`  the most columns this grid is allowed: 4 on the homepage strip,
           3 on the events page.

  Returned as plain values so the same sizing can be applied twice: written
  into the markup when the page is built, and written onto the element again
  when a filter changes how many cards are showing.
*/
function eventGridSizing(count, max = 4) {
  /* A grid that a filter has emptied is hidden, not shrunk — but it still has
     to be left describing something, so it is never told it holds zero. */
  const held = Math.max(1, count);
  const cols = Math.min(held, max);
  return {
    cols,
    /* One, two, or "more than two". The homepage strip names its exact count
       because four is a case of its own there; the listing does not, because
       beyond two it is always three across. */
    key: max === 4 ? String(held) : (held <= 2 ? String(held) : 'many'),
    /* Upright for a narrow card; landscape once a card is half the screen or
       wider, where 17:19 becomes a wall. */
    ratio: held > 2 ? '17 / 19' : '16 / 9',
  };
}

/** The sizing, as attributes for a grid being built. */
function eventGridAttrs(count, max = 4) {
  const { cols, key, ratio } = eventGridSizing(count, max);
  return `data-count="${key}" style="--cols:${cols}; --card-ratio:${ratio}"`;
}

/** The same sizing, applied to a grid already on the page. */
function sizeEventGrid(grid, count, max = 4) {
  const { cols, key, ratio } = eventGridSizing(count, max);
  grid.dataset.count = key;
  grid.style.setProperty('--cols', String(cols));
  grid.style.setProperty('--card-ratio', ratio);
}

/**
 * One event as a card. Used by the homepage strip and by both grids on the
 * events page, so a change to a card is a change everywhere.
 *
 * The picture's shape comes from --card-ratio on the grid rather than from the
 * card itself, which is what lets it change when a filter changes the number
 * of cards on screen without anything being re-rendered.
 */
function eventCard(event, { index = 0, more = false } = {}) {
  const date = formatEventDate(event.date);

  return `
  <a class="event-card" href="/events/${esc(event.slug)}" data-reveal style="--i:${index}"
     data-category="${esc(event.category ?? '')}">
    ${mediaSlot({
      url: event.imageUrl,
      label: 'Add an image',
      ratio: 'var(--card-ratio)',
      /* The headline is right underneath, so repeating it here would make a
         screen reader say the same words twice. Empty is the right answer
         until somebody writes a real description. */
      alt: event.imageAlt ?? '',
      className: 'event-card-media',
    })}

    <!--
      The words are wrapped so the card has exactly two parts, picture and
      text. That is what lets the single-card layout put them side by side
      with one grid rule rather than positioning three things individually.
    -->
    <div class="event-card-body">
      ${event.category
        ? `<p class="label event-card-label">${esc(event.category)}</p>`
        : `<p class="label event-card-label" data-copy="events.card.category">Event</p>`}
      ${date ? `<p class="event-card-date">${esc(date)}</p>` : ''}
      <h3 class="event-card-title">${esc(event.title)}</h3>
      ${more ? `<span class="link-arrow event-card-more">
        <span data-copy="events.card.more">Read more</span>${icon('arrowRight')}
      </span>` : ''}
    </div>
  </a>`;
}


/* ------------------------------------------------------------------ Hero --- */

function heroSection(settings) {
  const video = settings.hero?.videoUrl ?? '';
  const poster = settings.hero?.posterUrl ?? '';
  const alt = settings.hero?.alt ?? '';

  /*
    What actually goes behind the name, in order of preference:

      1. the video, with the poster as its first frame
      2. the poster on its own — no video set, OR the visitor has asked for
         reduced motion, in which case a silently looping film is exactly what
         they said they did not want
      3. a labelled placeholder

    The choice between 1 and 2 is made in the browser at mount time, not here,
    because this HTML is built once and the setting can change. mountHome()
    removes the video if it should not play. There is also an `error` handler
    there, so a URL that 404s falls back to the poster rather than showing
    black.
  */
  const media = video
    ? `
      <!--
        NO autoplay AND preload="none", both on purpose.

        The hero is the first thing on the page, so a film set to download
        itself here competes for bandwidth with the stylesheet, the font and
        the poster — the three things that decide how quickly the page appears.
        The poster is an image and arrives first; mountHeroVideo() starts the
        film afterwards, once the browser says the page has finished loading.
        Nobody sees the difference except on a slow phone, where it is the
        difference between a hero and a blank rectangle.
      -->
      <video class="hero-video" muted loop playsinline preload="none"
             ${poster ? `poster="${assetUrl(poster, 1920)}"` : ''} aria-hidden="true">
        <source src="${assetUrl(video)}">
      </video>
      ${alt ? `<span class="visually-hidden">${esc(alt)}</span>` : ''}`
    : poster
      ? `<img class="hero-video" src="${assetUrl(poster, 1920)}" alt="${esc(alt)}" decoding="async">`
      : `
      <div class="hero-empty">
        ${icon('film')}
        <span class="media-empty-label" data-copy="home.hero.empty">Add hero video</span>
      </div>`;

  return `
  <section class="hero" data-hero data-hero-tone="${video || poster ? 'dark' : 'light'}"
           data-has-media="${video || poster ? 'true' : 'false'}">

    <div class="hero-media">${media}</div>

    <!-- A wash over the film, so white text stays readable whatever is behind it. -->
    <div class="hero-scrim" aria-hidden="true"></div>

    <div class="hero-inner shell">
      <!--
        THE ARCH, drawn rather than photographed. It is the logo's own outline
        at the size of a doorway, sitting behind the name — the one piece of
        ornament on the site that is not a picture of something. aria-hidden,
        because it says nothing a screen reader has not already been told by
        the heading inside it.
      -->
      <svg class="hero-arch" viewBox="0 0 300 420" aria-hidden="true" focusable="false" preserveAspectRatio="none">
        <path d="M6 414V150C6 70 70 6 150 6s144 64 144 144v264" />
      </svg>

      <p class="label hero-label" data-reveal="text" data-copy="home.hero.label">Edgware &middot; London</p>

      <h1 class="display-1 display-strong hero-title" data-reveal="text" data-copy="home.hero.title">Taiba Islamic Centre</h1>

      <p class="hero-strap" data-reveal="text" data-copy="home.hero.strap">
        A house of prayer, a school, and a door that is open to the whole community.
      </p>

      <div class="hero-actions" data-reveal="text">
        <a class="btn btn--on-band" href="/prayer-times">
          <span data-copy="home.hero.cta">Prayer times</span>${icon('arrowRight')}
        </a>
        <a class="btn hero-btn-ghost" href="/services">
          <span data-copy="home.hero.cta2">What we offer</span>
        </a>
      </div>
    </div>

    <!--
      TODAY'S TIMES, DOCKED ALONG THE BOTTOM OF THE HERO.

      This is the single most important thing on the site and it is above the
      fold on every screen, which is the whole reason the hero is built the
      way it is rather than as one centred name.

      It is the same six rows as the table further down the page — see
      prayerRows() — so there is exactly one timetable on this site and no way
      for two copies of it to disagree.
    -->
    ${heroPrayerStrip(settings)}

    <!-- The scroll cue. A button, not decoration: clicking it moves the page. -->
    <button type="button" class="hero-cue" data-scroll-cue>
      <span data-copy="home.hero.cue">Scroll</span>
      <span class="hero-cue-line" aria-hidden="true"></span>
    </button>

    ${editOnly(`
    <div class="hero-edit">
      <button type="button" class="edit-chip" data-edit="hero">${icon('pencil')} Hero video &amp; poster</button>
      <button type="button" class="edit-chip" data-edit="prayer">${icon('clock')} Prayer times</button>
    </div>`)}
  </section>`;
}


/* ------------------------------------------------------- Prayer times ----- */

/*
  THE STRIP ACROSS THE BOTTOM OF THE HERO.

  Six cells, each a prayer and the time it is prayed in congregation — the
  jamaah, because that is the number somebody checking their phone on the way
  out of the door actually needs. Sunrise has no jamaah, so it shows when the
  time comes in instead.

  `data-prayer-cell` and the `name` attribute are read by mountPrayerTimes(),
  which marks whichever one is next. Nothing here depends on that running:
  with the script broken or the times unparseable, this is still a correct
  timetable with no highlight on it.
*/
function heroPrayerStrip(settings) {
  const rows = prayerRows(settings).slice(0, 6);

  if (!hasPrayerTimes(rows)) {
    /*
      No times typed in yet. A visitor gets NOTHING — an empty strip of six
      dashes across the hero is worse than a hero with no strip on it, because
      it looks like the times failed to load rather than like a site that is
      still being filled in. In edit mode it is there, with a way in.
    */
    return editOnly(`
      <div class="hero-prayer hero-prayer--empty">
        <p class="tiny">The prayer timetable is empty, so this strip is hidden from visitors.</p>
        <button type="button" class="edit-chip" data-edit="prayer">${icon('clock')} Add the times</button>
      </div>`);
  }

  const cell = (row) => {
    const quiet = NO_JAMAAH.has(row.name.toLowerCase());
    const time = (quiet ? row.begins : row.jamaah) || row.begins || row.jamaah;
    return `
      <div class="hero-prayer-cell" data-prayer-cell data-prayer-name="${esc(row.name)}"
           data-prayer-quiet="${quiet ? 'true' : 'false'}"
           data-prayer-minutes="${parseClock(quiet ? row.begins : (row.jamaah || row.begins)) ?? ''}">
        <span class="hero-prayer-name">${esc(row.name)}</span>
        <span class="hero-prayer-time">${esc(time || '—')}</span>
      </div>`;
  };

  return `
    <div class="hero-prayer" data-prayer-strip>
      <p class="label hero-prayer-label" data-copy="home.prayer.today">Today</p>
      <div class="hero-prayer-row">${rows.map(cell).join('')}</div>
      <a class="hero-prayer-all" href="/prayer-times">
        <span data-copy="home.prayer.all">Full timetable</span>${icon('arrowRight')}
      </a>
    </div>`;
}

/**
 * THE TABLE ITSELF, used on the homepage and again on /prayer-times.
 *
 * One function, two pages, so the two can never drift apart. `compact` drops
 * the "Begins" column — there is no room for three columns beside the Jumu'ah
 * panel on the homepage, and the jamaah is the one that matters.
 */
function prayerTable(settings, { compact = false } = {}) {
  const rows = prayerRows(settings);

  if (!hasPrayerTimes(rows)) {
    return `
      ${emptyState(
        'The timetable is empty',
        'Type this month\u2019s times in and they appear here, across the bottom of the homepage, and on the prayer times page.'
      )}
      ${editOnly(`<button type="button" class="edit-chip" data-edit="prayer">${icon('clock')} Add the times</button>`)}`;
  }

  const row = (entry, index) => {
    const quiet = NO_JAMAAH.has(entry.name.toLowerCase());
    return `
    <tr data-prayer-row data-prayer-name="${esc(entry.name)}"
        data-prayer-minutes="${parseClock(quiet ? entry.begins : (entry.jamaah || entry.begins)) ?? ''}"
        data-prayer-quiet="${quiet ? 'true' : 'false'}" style="--i:${index}">
      <th scope="row" class="prayer-name">${esc(entry.name)}</th>
      ${compact ? '' : `<td class="prayer-begins">${esc(entry.begins || '—')}</td>`}
      <td class="prayer-jamaah">${
        /*
          SUNRISE HAS NO CONGREGATION, and this cell used to repeat the time
          sunrise begins — which reads as "there is a jama'ah at 06:49", and
          there is not. Nobody prays together at sunrise; it is in the table
          because it is when Fajr runs out.

          So the cell is a dash, held back in the quiet colour, with the
          reason said in full for anyone using a screen reader — who would
          otherwise hear "dash" and be none the wiser.
        */
        quiet
          ? `<span class="prayer-none" aria-hidden="true">&mdash;</span>
             <span class="visually-hidden">No congregation at sunrise</span>`
          : esc(entry.jamaah || entry.begins || '—')
      }</td>
    </tr>`;
  };

  return `
  ${prayerCredit()}
  <table class="prayer-table" data-prayer-table>
    <caption class="visually-hidden">Prayer times at Taiba Islamic Centre</caption>
    <thead>
      <tr>
        <th scope="col" data-copy="prayer.col.prayer">Prayer</th>
        ${compact ? '' : '<th scope="col" data-copy="prayer.col.begins">Begins</th>'}
        <th scope="col" data-copy="prayer.col.jamaah">Jama&#39;ah</th>
      </tr>
    </thead>
    <tbody>${rows.map(row).join('')}</tbody>
  </table>`;
}

/**
 * Where these times came from, said out loud.
 *
 * Visitors get one quiet line naming Mawaqit and linking to the centre's page
 * there. That is not decoration: it tells somebody who spots a wrong time
 * exactly where it is wrong, which is the mosque's own Mawaqit account and
 * not this website.
 *
 * Edit mode gets the rest of the truth — when it was last read, and whether
 * what is on screen is a cached copy because Mawaqit could not be reached.
 */
function prayerCredit() {
  const feed = state.prayer;
  if (feed?.source !== 'mawaqit') {
    /* Typed by hand. Nothing to credit, but whoever is logged in should know
       that the live feed is not the thing they are looking at. */
    return editOnly(`
      <p class="prayer-credit prayer-credit--warn">${icon('alert')}
        <span>These are the typed fallback times. Mawaqit is switched off, or has never been reachable.</span>
      </p>`);
  }

  const when = feed.fetchedAt ? new Date(feed.fetchedAt) : null;
  const read = when && !Number.isNaN(when.getTime())
    ? when.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  return `
    <p class="prayer-credit">
      <span data-copy="prayer.credit">Times from</span>
      <a class="text-link" href="${safeUrl(feed.mosque?.url) || '#'}" target="_blank" rel="noopener noreferrer">Mawaqit</a>${
        editOnly(`<span class="prayer-credit-meta">${
          feed.stale
            ? `${icon('alert')} showing a cached copy — Mawaqit could not be reached`
            : `read ${esc(read)}`
        }</span>`)
      }
    </p>`;
}

/** The Jumu'ah panel — the one prayer people travel for. */
function jumuahPanel(settings) {
  /* Friday comes from Mawaqit too, where it is one or two or three sittings
     rather than a fixed shape — see jumuaRows() in lib/mawaqit.js. */
  const live = Array.isArray(state.prayer?.jumua) ? state.prayer.jumua : [];
  const rows = live.length
    ? live
    : (Array.isArray(settings?.jumuah) ? settings.jumuah : []);

  const body = rows.length
    ? `<dl class="jumuah-list">${rows.map((entry) => `
        <div class="jumuah-row">
          <dt>${esc(entry.label)}</dt>
          <dd>${esc(entry.time)}</dd>
        </div>`).join('')}</dl>`
    : editOnly(`<p class="tiny">No Jumu&#39;ah times set yet — this panel is hidden from visitors until there are.</p>`);

  if (!rows.length && !state.authed) return '';

  return `
  <aside class="jumuah" data-reveal>
    <p class="label jumuah-label" data-copy="prayer.jumuah.label">Friday</p>
    <h3 class="display-4 jumuah-title" data-copy="prayer.jumuah.title">Jumu&#39;ah</h3>
    ${body}
    <p class="tiny jumuah-note" data-copy="prayer.jumuah.note">
      The doors open half an hour before the khutbah. Please park considerately —
      the side streets are our neighbours&#39;.
    </p>
    ${editOnly(`<button type="button" class="edit-chip" data-edit="jumuah">${icon('pencil')} Edit Jumu&#39;ah</button>`)}
  </aside>`;
}

/**
 * The homepage's prayer section: the table on the left, Jumu'ah on the right.
 */
function prayerSection(settings) {
  return `
  <section class="section shell prayer-section" id="prayer-times">
    <div class="section-head">
      <div>
        <p class="label" data-reveal="text" data-copy="home.prayer.label">Prayer times</p>
        <h2 class="display-3" data-reveal="text" data-copy="home.prayer.title">Today at the centre</h2>
      </div>
      <a class="link-arrow" href="/prayer-times" data-reveal="text">
        <span data-copy="home.prayer.more">Month ahead</span>${icon('arrowRight')}
      </a>
    </div>

    <div class="prayer-grid">
      <div class="prayer-card" data-reveal>
        ${prayerTable(settings, { compact: false })}
        ${editOnly(`<div class="prayer-edit">
          <button type="button" class="edit-chip" data-edit="prayer">${icon('pencil')} Prayer times settings</button>
          <button type="button" class="edit-chip" data-edit="prayer-refresh">${icon('clock')} Refresh from Mawaqit</button>
        </div>`)}
      </div>

      ${jumuahPanel(settings)}
    </div>
  </section>`;
}

/**
 * Marks whichever prayer is next, on every timetable on the page at once.
 *
 * It runs on the minute rather than on a timer per row, and it is ENTIRELY
 * OPTIONAL: every time is already printed in the markup, so a browser that
 * never runs this shows a correct, unhighlighted timetable. Nothing here
 * invents a time — a row whose time could not be read is simply skipped.
 */
function mountPrayerTimes() {
  const cells = $$('[data-prayer-cell], [data-prayer-row]', app);
  if (!cells.length) return;

  const mark = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();

    /* Every time on the page that is still to come today, soonest first. The
       first of them is the next prayer. Sunrise is not a prayer, so it is
       never the one highlighted. */
    const ahead = cells
      .map((node) => ({ node, at: Number(node.dataset.prayerMinutes) }))
      .filter(({ node, at }) =>
        Number.isFinite(at) && node.dataset.prayerMinutes !== '' && node.dataset.prayerQuiet !== 'true');

    const soonest = ahead
      .filter(({ at }) => at >= minutes)
      .sort((a, b) => a.at - b.at)[0];

    /* Nothing left today — after Isha the next one is tomorrow's Fajr, which
       is the earliest time on the page. */
    const next = soonest ?? ahead.sort((a, b) => a.at - b.at)[0];

    cells.forEach((node) => node.removeAttribute('data-prayer-next'));
    next?.node.setAttribute('data-prayer-next', 'true');
  };

  mark();

  /* On the minute, then every minute. Lining up with the clock matters: a
     plain 60s interval started at 10:30:59 would update at 10:31:59, so the
     highlight would be up to a minute late all day. */
  let interval = null;
  const align = setTimeout(() => {
    mark();
    interval = setInterval(mark, 60_000);
  }, (60 - new Date().getSeconds()) * 1000);

  registerCleanup(() => { clearTimeout(align); clearInterval(interval); });
}


/* -------------------------------------------------------- Featured event --- */

function featuredEventSection({ upcoming, past }) {
  /* A flagged event if one is still to come, otherwise the next one. With
     nothing upcoming at all, the most recent one that has been — an empty
     section would be worse than an old one. */
  const event = pickFeatured({ upcoming, past });
  const isPast = !upcoming[0] && Boolean(past[0]);

  if (!event) {
    return `
    <section class="section shell">
      <p class="label" data-reveal="text" data-copy="home.featured.label">Next up</p>
      ${editOnly(`<div style="margin-top:var(--space-2)">
        <button type="button" class="edit-chip" data-edit="events">${icon('plus')} Add your first event</button>
      </div>`)}
      <div data-reveal="text" style="margin-top:var(--space-2)">
        ${emptyState('No events yet', 'Once an event is added it appears here, and on the Events page.')}
      </div>
    </section>`;
  }

  const date = formatEventDate(event.date);

  return `
  <section class="section featured">
    <div class="shell">
      <p class="label" data-reveal="text"
         data-copy="home.featured.${isPast ? 'label-past' : 'label'}">${isPast ? 'Most recently' : 'Next up'}</p>

      <a class="featured-inner" href="/events/${esc(event.slug)}">
        <div class="featured-media" data-reveal>
          ${mediaSlot({
            url: event.imageUrl,
            label: 'Add an image to this event',
            ratio: '16 / 9',
            alt: event.imageAlt ?? '',
          })}
        </div>

        <div class="featured-body">
          ${event.category ? `<p class="label" data-reveal="text">${esc(event.category)}</p>` : ''}
          ${date ? `<p class="featured-date" data-reveal="text">${esc(date)}${event.time ? ` · ${esc(event.time)}` : ''}</p>` : ''}
          <h2 class="display-2 featured-title" data-reveal="text">${esc(event.title)}</h2>
          ${event.summary ? `<p class="featured-summary prose" data-reveal="text">${esc(event.summary)}</p>` : ''}
          <span class="link-arrow" data-reveal="text">
            <span data-copy="home.featured.more">Read more</span>${icon('arrowRight')}
          </span>
        </div>
      </a>

      ${editOnly(`<div style="margin-top:var(--space-2)">
        <button type="button" class="edit-chip" data-edit="events">${icon('pencil')} Manage events</button>
      </div>`)}
    </div>
  </section>`;
}


/* -------------------------------------------------------- Upcoming strip --- */

/*
  THE STRIP IS BUILT FOR THE NUMBER OF EVENTS THAT ACTUALLY EXIST.

  A four-column grid holding two cards has a hole in it where the other two
  would be, and a hole reads as something failing to load. So the grid is told
  how many cards it is holding and uses exactly that many columns — the cards
  grow to fill the row instead of leaving a gap.

  The picture shape changes with them, which matters more than it sounds. A
  17:19 upright picture is right for a narrow card; the same shape on a card
  half the width of the screen is a wall. So:

    4 or 3 cards   upright, 17:19 — the reference's tile proportion
    2 cards        landscape, 16:9
    1 card         landscape, and the card turns on its side: picture left,
                   words right, the full width of the page

  Nothing is ever rendered into an empty cell.
*/
function upcomingSection({ upcoming, past }) {
  /* Whatever is shown large above is left out here. */
  const featured = pickFeatured({ upcoming, past });
  const rest = [...upcoming, ...past].filter((event) => event.id !== featured?.id).slice(0, 4);

  /*
    Nothing left over. A visitor sees no section at all — the featured event
    above is the whole of what's on, and that is a perfectly honest page. In
    edit mode it stays, because otherwise there would be no way in to add the
    second event.
  */
  if (!rest.length) {
    return editOnly(`
    <section class="section shell">
      <p class="label">What's on</p>
      ${emptyState(
        'One event so far',
        'Add a second and this row of cards appears under the featured event. It is built for one, two, three or four — the cards grow to fill whatever is there.'
      )}
      <button type="button" class="edit-chip" data-edit="events">${icon('plus')} Add another event</button>
    </section>`);
  }

  const count = rest.length;    // 1, 2, 3 or 4 — never more

  return `
  <section class="section shell">
    <div class="section-head">
      <p class="label" data-reveal="text" data-copy="home.upcoming.label">What's on</p>
      <a class="link-arrow" href="/events" data-reveal="text">
        <span data-copy="home.upcoming.all">All events</span>${icon('arrowRight')}
      </a>
    </div>

    <div class="event-grid" ${eventGridAttrs(count, 4)}>${rest.map((event, index) => eventCard(event, { index })).join('')}</div>
  </section>`;
}



/* ----------------------------------------------------------- Recent clips --- */

/*
  Short films, three across, each opening full size when you click it.

  A GRID, not a carousel — the reference site doesn't have one anywhere and
  neither does this. Nothing slides on its own, nothing needs arrows, and a
  visitor can see everything that is there at a glance.

  The tiles never play by themselves. Each shows its still with a play mark
  over it and only starts once somebody asks, which is the difference between
  a page with three films on it and a page that fights your phone.

  Sparse on purpose: with one clip the single tile takes the full width at
  33:20, with two they go landscape side by side, and only at three or more
  does it become the upright 17:19 grid. The section disappears completely
  while there are none.
*/

function clipsSection(clips) {
  const live = (clips ?? [])
    .filter((clip) => clip.published !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  /*
    Nothing to show: no section. In edit mode it stays visible, because a
    section that hides itself is also a section you can never add the first
    clip to.
  */
  if (!live.length) {
    return editOnly(`
    <section class="section shell">
      <p class="label">Recent clips</p>
      ${emptyState(
        'No clips yet',
        'Add one and this section appears on the homepage. Visitors never see it while it is empty.'
      )}
      <button type="button" class="edit-chip" data-edit="clips">${icon('plus')} Add a clip</button>
    </section>`);
  }

  const count = Math.min(live.length, 3);
  const ratio = live.length === 1
    ? 'var(--video-ratio)'
    : live.length === 2 ? '16 / 9' : 'var(--row-figure-ratio)';

  const tile = (clip, index) => {
    /*
      The still. A poster image if there is one; failing that the film's own
      first frame, which is what a <video> with preload="metadata" shows while
      paused. It is deliberately NOT given autoplay or loop — this is a
      photograph that happens to be made of video.
    */
    const thumb = clip.posterUrl
      ? `<img src="${assetUrl(clip.posterUrl, 900)}" alt="${esc(clip.alt || '')}" loading="lazy" decoding="async">`
      : clip.videoUrl
        ? `<video muted playsinline preload="metadata" tabindex="-1" aria-hidden="true"><source src="${assetUrl(clip.videoUrl)}"></video>`
        : `<span class="clip-missing">${icon('film')}<span class="media-empty-label">Add a video URL</span></span>`;

    const body = `
      <span class="clip-media media" data-fit="cover" style="aspect-ratio:${ratio}">
        ${thumb}
        ${clip.videoUrl ? `<span class="clip-play" aria-hidden="true">${icon('play')}</span>` : ''}
      </span>
      <!--
        A span, not an <h3>: the tile is a <button>, and a button may only
        contain phrasing content. The heading treatment is applied to the class
        in styles.css instead, so it still looks like every other title.
      -->
      <span class="clip-title">${esc(clip.title || 'Untitled clip')}</span>`;

    /* A tile with no film behind it is not a button — there is nothing for it
       to open. It still shows, so the gap in the record is visible. */
    return clip.videoUrl
      ? `<button type="button" class="clip" data-clip="${esc(clip.id)}" data-reveal style="--i:${index}">${body}</button>`
      : `<div class="clip clip--empty" data-reveal style="--i:${index}">${body}</div>`;
  };

  return `
  <section class="section shell">
    <div class="section-head">
      <p class="label" data-reveal="text" data-copy="home.clips.label">Recent clips</p>
      ${editOnly(`<button type="button" class="edit-chip" data-edit="clips">${icon('pencil')} Manage clips</button>`)}
    </div>

    <div class="clip-grid" data-clips data-count="${live.length}" style="--cols:${count}">
      ${live.map(tile).join('')}
    </div>
  </section>`;
}


/* ----------------------------------------------------------------- Values --- */

/*
  THE SIX WORDS.

  On a desktop this section PINS: it sticks to the screen while you keep
  scrolling, and each of the six words takes over in turn, crossfading over
  0.6s. The pinning and the "which word are we on" arithmetic are GSAP
  ScrollTrigger's job (see mountValues); the crossfade itself is a plain CSS
  transition, so it uses exactly the signature easing with no extra library.

  On a phone none of that happens. Pinning a section on a touch screen fights
  the scroll and leaves people stuck, so the same six words become six ordinary
  stacked panels that you simply scroll past.
*/
function valuesSection(settings) {
  const media = settings.values ?? {};

  const panel = (value, index) => `
    <article class="pillar" data-pillar="${esc(value.key)}" data-index="${index}"
             data-cursor="invert" data-reveal>
      <div class="pillar-media">
        ${mediaSlot({
          url: media[value.key],
          label: `Add media for ${value.word}`,
          className: 'pillar-media-inner',
        })}
      </div>

      <div class="pillar-scrim" aria-hidden="true"></div>

      <div class="pillar-body shell">
        <p class="label pillar-index">${String(index + 1).padStart(2, '0')}</p>
        <h3 class="display-1 pillar-word" data-copy="home.values.${value.key}.word">${esc(value.word)}</h3>
        <p class="pillar-line" data-copy="home.values.${value.key}.line">${esc(value.line)}</p>
      </div>
    </article>`;

  return `
  <section class="section values" data-values>
    <div class="shell values-head">
      <p class="label" data-reveal="text" data-copy="home.values.label">Our values</p>
      <h2 class="display-2" data-reveal="text" data-copy="home.values.title">What this house is for</h2>
      <hr class="rule" data-reveal="text">
      ${editOnly(`<div style="margin-top:var(--space-2)">
        <button type="button" class="edit-chip" data-edit="values">${icon('pencil')} Backgrounds for the six words</button>
      </div>`)}
    </div>

    <!--
      The stage is what gets pinned. Its height is set in CSS to one screen;
      the scroll distance that drives it is the .values-track below.
    -->
    <div class="values-track" data-values-track>
      <div class="values-stage" data-values-stage data-active="0">
        ${VALUES.map(panel).join('')}
      </div>

      <!-- Which word you are on. Hidden on mobile, where they simply stack. -->
      <div class="values-progress" aria-hidden="true">
        ${VALUES.map((_, index) => `<span data-dot="${index}"></span>`).join('')}
      </div>
    </div>
  </section>`;
}


/* ---------------------------------------------------------------- Welcome --- */

/*
  WHO WE ARE, IN A PARAGRAPH, BESIDE ONE PICTURE.

  Two columns on a desktop and one on a phone, and the picture is cut to the
  arch from the logo — the same shape as the tiles below it and the outline
  behind the name above it. Three uses of one shape is what makes it read as
  the building rather than as a decoration somebody liked.

  The picture is its own setting rather than part of the hero, because the two
  want completely different photographs: the hero wants the room full, and
  this wants the front of the building.
*/
function welcomeSection(settings) {
  const welcome = settings.welcome ?? {};

  return `
  <section class="section shell welcome">
    <div class="welcome-body">
      <p class="label" data-reveal="text" data-copy="home.welcome.label">Assalamu alaikum</p>

      <h2 class="display-2" data-reveal="text" data-copy="home.welcome.title">
        Welcome to Taiba
      </h2>

      <hr class="rule" data-reveal="text">

      <p class="prose welcome-lede" data-reveal="text" data-copy="home.welcome.lede">
        Taiba Islamic Centre is a mosque and a community centre. We are open for the
        five daily prayers and for Jumu&#39;ah, we teach the Qur&#39;an to children and
        adults through the week, and the rest of the time the doors are open to
        anybody who wants to come in.
      </p>

      <p class="prose" data-reveal="text" data-copy="home.welcome.body">
        Whether you have prayed here for years, have just moved into the area, or
        are not Muslim at all and simply want to look round — you are welcome. Come
        to a prayer, come to a class, or knock on the door and ask.
      </p>

      <p data-reveal="text" class="welcome-actions">
        <a class="link-arrow" href="/about">
          <span data-copy="home.welcome.link">More about the centre</span>${icon('arrowRight')}
        </a>
      </p>
    </div>

    <div class="welcome-media" data-reveal>
      <div class="arch welcome-arch">
        ${mediaSlot({
          url: welcome.imageUrl,
          label: 'Add a picture of the centre',
          ratio: '4 / 5',
          alt: welcome.alt ?? '',
        })}
      </div>
      ${editOnly(`<div style="margin-top:var(--space-1)">
        <button type="button" class="edit-chip" data-edit="welcome">${icon('pencil')} Welcome picture</button>
      </div>`)}
    </div>
  </section>`;
}


/* --------------------------------------------------------------- Services --- */

/*
  WHAT THE CENTRE RUNS, AS A GRID OF ARCHES.

  Up to six of them, read straight out of the same list the table on /services
  is built from — so adding a service in edit mode puts it on the homepage as
  well, in the same order, with no second place to remember.

  The grid is sized to how many there actually are, exactly like the event
  strips: three across at three or more, two at two, and at one the tile takes
  the width and turns on its side. A row of six columns with two things in it
  reads as something that failed to load.
*/
function servicesSection(services) {
  const live = (services ?? [])
    .filter((service) => service.published !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 6);

  if (!live.length) {
    return editOnly(`
    <section class="section shell">
      <p class="label">What we offer</p>
      ${emptyState(
        'Nothing listed yet',
        'Add a service — a class, a prayer, a funeral service — and it appears here and in the table on the Services page.'
      )}
      <button type="button" class="edit-chip" data-edit="services">${icon('plus')} Add the first one</button>
    </section>`);
  }

  const cols = Math.min(live.length, 3);

  const tile = (service, index) => `
    <li class="service-tile" data-reveal style="--i:${index}">
      <a class="service-tile-inner" href="/services#${esc(service.slug)}">
        <div class="arch service-tile-media">
          ${mediaSlot({
            url: service.imageUrl,
            label: 'Add a picture',
            ratio: 'var(--tile-ratio)',
            alt: service.imageAlt ?? '',
          })}
        </div>
        <div class="service-tile-body">
          ${service.type ? `<p class="label service-tile-type">${esc(service.type)}</p>` : ''}
          <h3 class="service-tile-title">${esc(service.name)}</h3>
          ${service.description ? `<p class="service-tile-line">${esc(service.description)}</p>` : ''}
        </div>
      </a>
    </li>`;

  return `
  <section class="section shell services-teaser">
    <div class="section-head">
      <div>
        <p class="label" data-reveal="text" data-copy="home.services.label">What we offer</p>
        <h2 class="display-3" data-reveal="text" data-copy="home.services.title">Through the week</h2>
      </div>
      <a class="link-arrow" href="/services" data-reveal="text">
        <span data-copy="home.services.all">Everything we run</span>${icon('arrowRight')}
      </a>
    </div>

    <ul class="service-grid" data-count="${live.length}"
        style="--cols:${cols}; --tile-ratio:${live.length === 1 ? '16 / 9' : '4 / 5'}">
      ${live.map(tile).join('')}
    </ul>

    ${editOnly(`<div style="margin-top:var(--space-2)">
      <button type="button" class="edit-chip" data-edit="services">${icon('pencil')} Manage services</button>
    </div>`)}
  </section>`;
}


/* ------------------------------------------------------------ Donate band --- */

/*
  The one large area of colour in the body of a page, and the last thing on
  every one of them. data-cursor="invert" turns the custom cursor pale for as
  long as it is over this band.

  The arch is drawn behind the words here as well — the same outline as the
  hero, at the other end of the page, so the two book-end each other.
*/
function donateSection() {
  return `
  <section class="cta-band" data-cursor="invert">
    <svg class="cta-arch" viewBox="0 0 300 420" aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <path d="M6 414V150C6 70 70 6 150 6s144 64 144 144v264" />
    </svg>

    <div class="shell cta-inner">
      <p class="label cta-label" data-reveal="text" data-copy="home.donate.label">Support the masjid</p>

      <h2 class="display-2" data-reveal="text" data-copy="home.donate.title">
        Keep the doors open
      </h2>

      <p class="prose cta-line" data-reveal="text" data-copy="home.donate.line">
        The lights, the heating, the carpets, the teachers. Everything given goes
        straight into running the centre.
      </p>

      <p data-reveal="text">
        <a class="btn btn--on-band btn--lg" href="/donate">
          <span data-copy="home.donate.cta">Give to the centre</span>${icon('arrowRight')}
        </a>
      </p>
    </div>
  </section>`;
}


/* --------------------------------------------------------------- Assemble --- */

async function renderHome() {
  /*
    All four are already loaded by boot(), so this is instant on a first visit
    and on every navigation afterwards. None of them is allowed to break the
    page: a failed request gives empty defaults, and every section has an
    empty state.
  */
  const [settings, events, services, clips] = await Promise.all([
    load('settings').catch(() => ({})),
    load('events').catch(() => []),
    load('services').catch(() => []),
    load('clips').catch(() => []),
  ]);

  const sorted = sortEvents(events);
  const site = settings ?? {};

  return `
  <main id="main" class="page page--home">
    ${heroSection(site)}
    ${welcomeSection(site)}
    ${prayerSection(site)}
    ${servicesSection(services)}
    ${featuredEventSection(sorted)}
    ${upcomingSection(sorted)}
    ${valuesSection(site)}
    ${clipsSection(clips)}
    ${filmSection({
      slot: 'break',
      film: site.films?.break,
      label: 'Add the full-width film',
    })}
    ${donateSection()}
  </main>`;
}

/* ------------------------------------------------------- Service table --- */

/*
  THE HOVER-IMAGE TABLE — the reference's "AROUND THE WORLD" rows, built to the
  measurements in the spec rather than to anything I invented.

    row height       59.5px          --row-height
    name             17px            --row-title
    picture          17:19, 18% of the row's width
                                     --row-figure-ratio, --row-figure-width

  A row is two columns and nothing else: the name on the left, the type on the
  right in blue. The description is stored but only shown on a phone, where the
  rows become stacked cards and there is room to read it.

  THE HOVER IS NOT CSS :hover. mountServiceRows() adds `is-active is-hover`
  to the row and every visual change hangs off those classes — the black band,
  the white text and the picture. That is how the reference does it, and it is
  what lets the picture be driven by a JS animation loop at the same time
  without the browser's own hover state fighting it.
*/
function serviceTable(services) {
  const live = (services ?? [])
    .filter((service) => service.published !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (!live.length) {
    return `
      ${emptyState(
        'No services listed yet',
        'Each one is a row in this table: a name, when it runs, and a picture that appears as you move along the row.'
      )}
      ${editOnly(`<button type="button" class="edit-chip" data-edit="services">${icon('plus')} Add the first service</button>`)}`;
  }

  const row = (service, index) => `
    <!--
      tabindex="0" makes the row a tab stop.

      On a desktop the picture is the reward for moving along the row, and
      without this a keyboard user could never get it — there is no cursor to
      follow and nothing here is a link or a button. Tabbing onto a row lights
      it up exactly as hovering does; the picture parks rather than tracking,
      because there is nothing to track.
    -->
    <li class="row" data-row tabindex="0" id="${esc(service.slug)}" style="--i:${index}">

      <!--
        FIRST in the markup on purpose. On a desktop it is positioned
        absolutely, so where it sits in the HTML makes no difference at all; on
        a phone it is an ordinary block, and being first is what puts the
        picture above the words with no reordering rules needed.
      -->
      ${service.imageUrl
        ? `<figure class="row-figure" data-row-figure>
             <img src="${assetUrl(service.imageUrl, 700)}" alt="${esc(service.imageAlt ?? '')}"
                  loading="lazy" decoding="async">
           </figure>`
        /*
          No picture yet. A visitor gets NO figure at all — unlike everywhere
          else on the site, a row without a picture is not a broken row, it is
          just a row, and it still lights up black exactly the same way. A
          dashed frame would be worse than nothing. In edit mode the frame is
          there, because that is the one place a gap needs to be visible.
        */
        : editOnly(`<figure class="row-figure" data-row-figure aria-hidden="true">
             <span class="row-figure-empty">${icon('image')}</span>
           </figure>`)}

      <div class="row-inner">
        <span class="row-name">${esc(service.name)}</span>
        <span class="row-type">${esc(service.type ?? '')}</span>
      </div>

      <!--
        The description is a card's worth of text on a phone and is not shown
        on the desktop row, which is two columns at 59.5px by design. It is
        still IN the page on a desktop, hidden with .visually-hidden rather
        than display:none — so a screen reader still reads it out with the
        row, instead of a whole sentence about the service existing only for
        people looking at a phone.
      -->
      ${service.description
        ? `<p class="row-description">${esc(service.description)}</p>`
        : ''}
    </li>`;

  return `
    <div class="table-head" aria-hidden="true">
      <span data-copy="services.col.name">Service</span>
      <span data-copy="services.col.type">When</span>
    </div>

    <ul class="rows" data-rows>${live.map(row).join('')}</ul>

    ${editOnly(`<div class="rows-edit">
      <button type="button" class="edit-chip" data-edit="services">${icon('pencil')} Manage services</button>
    </div>`)}`;
}


/* --------------------------------------------------------- Weekly rhythm --- */

/*
  The week, under the table. Stored as a list rather than as page text because
  the number of lines changes — edit mode shows the whole thing as one box, a
  line per row, columns separated by a bar.
*/
function rhythmSection(settings) {
  const rows = settings.rhythm ?? [];

  const list = rows.length
    ? `<dl class="rhythm-list">${rows.map((entry, index) => `
        <div class="rhythm-row" data-reveal="text" style="--i:${index}">
          <dt class="rhythm-day">${esc(entry.day)}</dt>
          <dd class="rhythm-time">${esc(entry.time)}</dd>
          <dd class="rhythm-detail">${esc(entry.detail)}</dd>
        </div>`).join('')}</dl>`
    : emptyState(
        'The week is not filled in yet',
        'Add a line per session — the day, the time, and what happens — and they appear here.'
      );

  return `
  <section class="section shell rhythm">
    <p class="label" data-reveal="text" data-copy="services.rhythm.label">The week</p>

    <h2 class="display-3 rhythm-title" data-reveal="text" data-copy="services.rhythm.title">
      A rhythm you can rely on
    </h2>

    <hr class="rule" data-reveal="text">

    <p class="prose rhythm-body" data-reveal="text" data-copy="services.rhythm.body">
      The prayers are the spine of the week and everything else is built around
      them. Term time and the school holidays run a little differently — the
      times below are the ones to count on.
    </p>

    ${list}

    <p class="tiny rhythm-note" data-reveal="text" data-copy="services.rhythm.note">
      Ramadan runs to its own timetable, and so do the two Eids. Check the events
      page, or ask at the office if you are coming for the first time.
    </p>

    ${editOnly(`<div style="margin-top:var(--space-2)">
      <button type="button" class="edit-chip" data-edit="rhythm">${icon('pencil')} Edit the week</button>
    </div>`)}
  </section>`;
}


/*
  SERVICES — an opening, a full-width film carrying the table's two-line
  heading, the table itself, and the week underneath it.
*/
async function renderServices() {
  const [settings, services] = await Promise.all([
    load('settings').catch(() => ({})),
    load('services').catch(() => []),
  ]);

  const site = settings ?? {};

  return `
  <main id="main" class="page page--services">
    <section class="shell page-head" data-hero data-hero-tone="light">
      <p class="label" data-reveal="text" data-copy="services.label">What we offer</p>

      <h1 class="display-2" data-reveal="text" data-copy="services.title">Our services</h1>

      <hr class="rule" data-reveal="text">

      <p class="prose" data-reveal="text" data-copy="services.lede">
        The five daily prayers and Jumu&#39;ah, Qur&#39;an and Arabic classes for children
        and adults, marriages, funerals, and the things a community needs from the
        building it shares.
      </p>
    </section>

    <!--
      The table's heading, two lines, over the film. The line break is part of
      the wording: edit it in edit mode with a return in it and it stays two
      lines.
    -->
    ${filmSection({
      slot: 'services',
      film: site.films?.services,
      label: 'Add the film behind this heading',
      overlay: `
        <h2 class="display-1 film-title" data-copy="services.film.title">Everything<br>we offer</h2>`,
    })}

    <section class="section shell">
      ${serviceTable(services)}
    </section>

    ${rhythmSection(site)}

    ${donateSection()}
  </main>`;
}

/* ========================================================= Prayer times == */

/*
  THE PAGE THE SITE EXISTS FOR.

  Everything on it is already on the homepage — the same table, out of the
  same six stored rows — but here it is given the whole width, with Jumu'ah
  beside it and the two notes that always get asked at the door underneath.

  There is no month grid and no calculation. See the comment above PRAYERS:
  these are the times the imam has set and somebody has typed in, which is
  the only version of them that is ever right.
*/
async function renderPrayerTimes() {
  const settings = (await load('settings').catch(() => ({}))) ?? {};

  return `
  <main id="main" class="page page--prayer">
    <section class="shell page-head" data-hero data-hero-tone="light">
      <p class="label" data-reveal="text" data-copy="prayer.label">Prayer times</p>

      <h1 class="display-2" data-reveal="text" data-copy="prayer.title">When we pray</h1>

      <hr class="rule" data-reveal="text">

      <p class="prose" data-reveal="text" data-copy="prayer.lede">
        The times below are the ones printed on the door. Jama&#39;ah is the
        congregation — come a few minutes before it and you will not be rushing.
      </p>

      ${editOnly(`<div style="margin-top:var(--space-2)">
        <button type="button" class="edit-chip" data-edit="prayer">${icon('clock')} Prayer times settings</button>
        <button type="button" class="edit-chip" data-edit="prayer-refresh">${icon('arrowDown')} Refresh from Mawaqit</button>
        <button type="button" class="edit-chip" data-edit="jumuah">${icon('pencil')} Jumu&#39;ah fallback</button>
      </div>`)}
    </section>

    <section class="section shell prayer-section prayer-section--page">
      <div class="prayer-grid">
        <div class="prayer-card prayer-card--large" data-reveal>
          ${prayerTable(settings)}
        </div>

        ${jumuahPanel(settings)}
      </div>

      <div class="prayer-notes">
        <div class="prayer-note" data-reveal="text">
          <h2 class="heading" data-copy="prayer.note.changes.title">The times change</h2>
          <p data-copy="prayer.note.changes.body">
            Fajr and Isha move week by week with the light, and the whole timetable
            changes for Ramadan and for the two Eids. Whatever is on this page is
            what is on the door today.
          </p>
        </div>

        <div class="prayer-note" data-reveal="text">
          <h2 class="heading" data-copy="prayer.note.first.title">Coming for the first time</h2>
          <p data-copy="prayer.note.first.body">
            Just come in. There is a shoe rack inside the door and space to make
            wudu. If you are not sure where to go or what to do, ask anybody
            standing near the entrance — it is a normal thing to be asked.
          </p>
        </div>
      </div>
    </section>

    ${donateSection()}
  </main>`;
}


/* ================================================================ Events == */

/*
  THE LISTING.

  Two groups, UPCOMING and PAST, worked out from the date every time the page
  is drawn — see sortEvents(). Nothing is ever moved by hand when an event goes
  by.

  The filter along the top hides and shows cards in place. It does not reload
  the page, it does not fetch anything, and it re-sizes both grids as it goes,
  so filtering down to a single event leaves one deliberate card rather than
  one narrow card and two gaps.
*/

function eventGroup({ key, heading, events, copyKey }) {
  if (!events.length) return '';

  return `
  <section class="event-group" data-group="${esc(key)}">
    <div class="section-head">
      <h2 class="label group-heading">
        <span data-copy="${esc(copyKey)}">${esc(heading)}</span>
        <span class="group-count" data-group-count>${events.length}</span>
      </h2>
    </div>

    <div class="event-grid" ${eventGridAttrs(events.length, 3)}>
      ${events.map((event, index) => eventCard(event, { index, more: true })).join('')}
    </div>
  </section>`;
}

async function renderEvents() {
  const events = (await load('events').catch(() => [])) ?? [];
  const { upcoming, past } = sortEvents(events);
  const total = upcoming.length + past.length;

  /* Only the categories actually in use — a filter for a category with nothing
     in it is a button that does nothing. */
  const categories = [...new Set([...upcoming, ...past]
    .map((event) => event.category)
    .filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const filterButton = (value, label, count) => `
    <button type="button" class="filter" data-filter="${esc(value)}"
            aria-pressed="${value === 'all' ? 'true' : 'false'}">
      ${esc(label)}<span class="filter-count">${count}</span>
    </button>`;

  const filters = categories.length > 1 ? `
    <div class="filters" data-filters role="group" aria-label="Filter by category">
      ${filterButton('all', 'All', total)}
      ${categories.map((category) => filterButton(
        category,
        category,
        [...upcoming, ...past].filter((event) => event.category === category).length
      )).join('')}
    </div>` : '';

  const body = total
    ? `
      ${filters}
      ${eventGroup({ key: 'upcoming', heading: 'Upcoming', events: upcoming, copyKey: 'events.upcoming' })}
      ${eventGroup({ key: 'past', heading: 'Been and gone', events: past, copyKey: 'events.past' })}`
    : `
      ${emptyState(
        'Nothing listed yet',
        'Add an event and it appears here, on the homepage, and in the number beside Events in the menu.'
      )}`;

  return `
  <main id="main" class="page page--events" data-events>
    <section class="shell page-head" data-hero data-hero-tone="light">
      <p class="label" data-reveal="text" data-copy="events.label">Events</p>

      <h1 class="display-1" data-reveal="text">
        <span data-copy="events.title">What's on</span><span class="title-count" data-live-count>${total}</span>
      </h1>

      <hr class="rule" data-reveal="text">

      <p class="prose" data-reveal="text" data-copy="events.lede">
        Talks, classes, iftars, fundraisers and open days at the centre — and
        everything that has already been.
      </p>

      ${editOnly(`<div style="margin-top:var(--space-2)">
        <button type="button" class="edit-chip" data-edit="event-new">${icon('plus')} Add event</button>
        <button type="button" class="edit-chip" data-edit="events">${icon('pencil')} Manage events</button>
      </div>`)}
    </section>

    <section class="section shell">${body}</section>
  </main>`;
}

/** The filter. No reload, no request — it hides cards and re-sizes the grids. */
function mountEvents() {
  const page = $('[data-events]', app);
  if (!page) return;

  const buttons = $$('[data-filter]', page);
  if (!buttons.length) return;

  const groups = $$('[data-group]', page);
  const liveCount = $('[data-live-count]', page);

  const apply = (value) => {
    buttons.forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.filter === value)));

    let shown = 0;

    groups.forEach((group) => {
      const cards = $$('.event-card', group);
      const visible = cards.filter((card) => {
        const match = value === 'all' || card.dataset.category === value;
        card.hidden = !match;
        return match;
      });

      shown += visible.length;

      /*
        Re-size for what is left. Without this, filtering a three-across grid
        down to one card leaves that card a third of the width with two empty
        columns beside it — which is the exact thing the sparse rules exist to
        prevent.
      */
      const grid = $('.event-grid', group);
      if (grid) sizeEventGrid(grid, visible.length, 3);

      /* Re-number the stagger, so the cards still arrive one after another
         rather than with gaps where the hidden ones were. */
      visible.forEach((card, index) => card.style.setProperty('--i', String(index)));

      const count = $('[data-group-count]', group);
      if (count) count.textContent = String(visible.length);

      /* A group with nothing left in it goes entirely, heading and all. */
      group.hidden = visible.length === 0;
    });

    if (liveCount) liveCount.textContent = String(shown);
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => apply(button.dataset.filter));
  });
}


/*
  ONE EVENT.

  `params.slug` comes from the address, e.g. /events/summer-camp.

  The two pictures do two different jobs and are shown in two different places:
  the landscape one is the hero across the top, and the square poster — the
  graphic you would send somebody on WhatsApp — sits beside the sign-up button
  rather than being stretched into a banner.
*/
async function renderEvent(params) {
  const events = (await load('events').catch(() => [])) ?? [];
  const event = events.find((record) => record.slug === params.slug);

  if (!event) {
    state.pageMeta = {
      title: 'Event not found',
      description: `Nothing is stored under "${params.slug}".`,
    };
    return `
    <main id="main" class="page">
      <section class="shell page-head" data-hero data-hero-tone="light">
        ${emptyState('We could not find that event', `Nothing is stored under "${params.slug}".`)}
        <p style="margin-top:var(--space-2)"><a class="btn" href="/events">All events</a></p>
      </section>
    </main>`;
  }

  /*
    What comes before and after, in date order across everything published —
    not upcoming and past separately, because the two are one timeline and
    stepping off the end of one into the other is exactly right.
  */
  const ordered = events
    .filter((record) => record.published !== false)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const here = ordered.findIndex((record) => record.id === event.id);
  const previous = here > 0 ? ordered[here - 1] : null;
  const next = here >= 0 && here < ordered.length - 1 ? ordered[here + 1] : null;

  /*
    An event's page describes itself.

    The tab, the search result and — the one people actually notice — the card
    that comes up when somebody pastes the link into WhatsApp all use the
    event's own title, summary and picture. None of it is a second copy to
    keep in step: it is the same three fields the event is edited with.
  */
  state.pageMeta = {
    title: event.title,
    description: event.summary || `${formatEventDate(event.date)} at ${event.location || 'Taiba Islamic Centre'}.`,
    image: event.imageUrl || event.posterUrl || '',
    type: 'article',
  };

  const date = formatEventDate(event.date);
  const hasImage = Boolean(event.imageUrl);

  /* The column beside the writing only exists if there is something to put in
     it. Without this, an event with no poster and no sign-up link leaves a
     340px hole down the right-hand side of the page. */
  const hasAside = Boolean(event.posterUrl || event.signUpUrl) || state.authed;

  const meta = [
    date && { label: 'Date', value: date, key: 'event.meta.date' },
    event.time && { label: 'Time', value: event.time, key: 'event.meta.time' },
    event.location && { label: 'Where', value: event.location, key: 'event.meta.where' },
  ].filter(Boolean);

  const step = (record, direction, fallback, copyKey) => record
    ? `<a class="event-step" href="/events/${esc(record.slug)}" data-step="${direction}">
         <span class="label">${direction === 'previous' ? icon('arrowLeft') : ''}<span data-copy="${esc(copyKey)}">${esc(fallback)}</span>${direction === 'next' ? icon('arrowRight') : ''}</span>
         <span class="event-step-title">${esc(record.title)}</span>
       </a>`
    : '<span class="event-step" aria-hidden="true"></span>';

  return `
  <main id="main" class="page page--event">

    <!-- The landscape picture, full width, with the header sitting over it. -->
    <section class="event-hero" data-hero data-hero-tone="${hasImage ? 'dark' : 'light'}">
      ${mediaSlot({
        url: event.imageUrl,
        label: 'Add the picture for this event',
        ratio: 'var(--video-ratio)',
        alt: event.imageAlt ?? '',
        className: 'event-hero-media',
      })}
    </section>

    <section class="shell event-head">
      <a class="link-arrow link-back" href="/events">
        ${icon('arrowLeft')}<span data-copy="event.back">All events</span>
      </a>

      ${event.category ? `<p class="label event-category" data-reveal="text">${esc(event.category)}</p>` : ''}

      <h1 class="display-2 event-title" data-reveal="text">${esc(event.title)}</h1>

      ${event.summary ? `<p class="prose event-summary" data-reveal="text">${esc(event.summary)}</p>` : ''}

      ${meta.length ? `
      <dl class="event-meta" data-reveal="text">
        ${meta.map((item) => `
          <div>
            <dt data-copy="${esc(item.key)}">${esc(item.label)}</dt>
            <dd>${esc(item.value)}</dd>
          </div>`).join('')}
      </dl>` : ''}

      ${editOnly(`<div style="margin-top:var(--space-2)">
        <button type="button" class="edit-chip" data-edit="event:${esc(event.id)}">${icon('pencil')} Edit this event</button>
      </div>`)}
    </section>

    <section class="shell event-main" data-aside="${hasAside ? 'true' : 'false'}">
      <div class="event-body" data-reveal="text">
        ${event.body
          ? paragraphs(event.body)
          : editOnly(emptyState('No write-up yet', 'Add one in "Edit this event" — blank lines between paragraphs.'))}
      </div>

      ${hasAside ? `
      <aside class="event-aside">
        ${event.posterUrl || state.authed ? `
        <div class="event-poster" data-reveal>
          <!--
            AN UPRIGHT FRAME, AND NOTHING IS EVER CROPPED.

            Two decisions here, and they are separate.

            The shape used to be 1:1. A real event poster is almost never
            square — the ones people make in Canva are upright, around 2:3 —
            so every one of them lost its sides. 2:3 is the shape posters
            actually come in.

            The picture is then fitted INSIDE that frame rather than filling
            it, so a poster that is some other shape is letterboxed on the
            pale blue rather than trimmed. A poster is a finished piece of
            artwork and cropping it loses the thing it was made to say. The
            hero above still crops, and should: that one is a photograph used
            as a band across the page, and a band has to be a band.

            The frame keeps a FIXED shape even though the picture inside it
            might be any shape, and that is the important part: it reserves
            its space before the picture arrives, so the page never jumps and
            lazy loading has a real box to measure.
          -->
          ${mediaSlot({
            url: event.posterUrl,
            label: 'Add the poster',
            ratio: '2 / 3',
            alt: event.posterAlt ?? '',
            cover: false,
          })}
        </div>` : ''}

        ${event.signUpUrl ? `
        <p class="event-signup" data-reveal="text">
          <a class="btn btn--primary" href="${safeUrl(event.signUpUrl)}" target="_blank" rel="noopener">
            <span data-copy="event.signup">Sign up</span>${icon('arrowRight')}
          </a>
        </p>` : ''}
      </aside>` : ''}
    </section>

    ${previous || next ? `
    <nav class="shell event-nav" aria-label="More events">
      ${step(previous, 'previous', 'Previous', 'event.previous')}
      ${step(next, 'next', 'Next', 'event.next')}
    </nav>` : ''}

    ${donateSection()}
  </main>`;
}

async function renderAbout() {
  return placeholderPage({
    key: 'about',
    label: 'About us',
    title: 'The centre',
    lede: 'A mosque, a school and a meeting place, run by the people who pray in it.',
  });
}

/* -------------------------------------------------------------- Donate --- */

/*
  THE MONEY LADDER.

  Five monthly amounts, in pounds, matching DONATE_TIERS in api/settings.js.
  Each one's link is stored under the key `m` + the amount — £10 is `m10`.

  Changing the ladder means changing BOTH lists. They are deliberately not
  shared: this file runs in the browser and that one runs on the server, and
  a shared file between them is a build step, which this site does not have.
*/
const DONATE_TIERS = [5, 10, 25, 50, 100];
const tierKey = (amount) => `m${amount}`;

/*
  The four things people offer that aren't money. All four are editable text —
  the headings and the lines under them — so the list can say whatever is
  actually useful at the time without anybody touching this file.
*/
const SUPPORT_WAYS = [
  {
    key: 'volunteering',
    title: 'Volunteer',
    body: 'Someone to lock up, to teach a class, to drive, to cook, to set out chairs before Jumu\u2019ah. An hour a week is a real contribution.',
  },
  {
    key: 'sponsor',
    title: 'Sponsor a day',
    body: 'Cover everything the centre costs to run for one day — the heating, the lights, the water, the cleaning — in somebody\u2019s name.',
  },
  {
    key: 'equipment',
    title: 'Give equipment',
    body: 'Qur\u2019ans, bookshelves, prayer mats, a projector for the classes. Good second-hand is as welcome as new.',
  },
  {
    key: 'skills',
    title: 'Lend a trade',
    body: 'An electrician, a plumber, a decorator, an accountant. A building this age always needs somebody who knows what they are looking at.',
  },
];

/**
 * One donate button. Every link off this page goes to Stripe or LaunchGood,
 * so every one of them opens in a new tab and carries rel="noopener" — which
 * stops the page we open from being able to touch this one.
 */
const donateLink = (href, label, classes = 'btn btn--primary') => `
  <a class="${classes}" href="${esc(href)}" target="_blank" rel="noopener">
    <span>${esc(label)}</span>${icon('arrowRight')}
  </a>`;

/**
 * Shown in edit mode where a donate button would be if the link were set.
 * Visitors never see this — they get nothing at all, because half a donation
 * block is worse than none.
 */
const missingLink = (what) => editOnly(`
  <p class="support-missing">${icon('alert')}
    <span>No link set for ${esc(what)} — it is hidden from visitors until there is one.</span>
  </p>`);


async function renderDonate() {
  const settings = (await load('settings').catch(() => ({}))) ?? {};
  const donate = settings.donate ?? {};
  const monthly = donate.monthly ?? {};

  /* Which amounts actually have a link behind them. An amount without one is
     not shown at all — a button that goes nowhere is worse than a shorter
     ladder. In edit mode every amount is shown, so you can see what is still
     to be filled in. */
  const tiers = DONATE_TIERS.map((amount) => ({ amount, href: monthly[tierKey(amount)] ?? '' }));
  const liveTiers = tiers.filter((tier) => tier.href);
  const shownTiers = state.authed ? tiers : liveTiers;

  const hasOneOff = Boolean(donate.oneOff);
  const hasLaunchgood = Boolean(donate.launchgood);
  const hasMonthly = liveTiers.length > 0;

  /* With nothing set up at all, a visitor gets the intention, the hadith and
     the other ways to help — which is still a page worth reading. The three
     money blocks appear as each one is filled in. */
  const hasAnyMoney = hasOneOff || hasMonthly || hasLaunchgood;

  return `
  <main id="main" class="page page--support">

    <!-- The navy band this page opens on, with the arch drawn across it. -->
    <section class="support-hero" data-hero data-hero-tone="dark" data-cursor="invert">
      <svg class="cta-arch" viewBox="0 0 300 420" aria-hidden="true" focusable="false" preserveAspectRatio="none">
        <path d="M6 414V150C6 70 70 6 150 6s144 64 144 144v264" />
      </svg>

      <div class="shell support-hero-inner">
        <p class="label support-hero-label" data-reveal="text" data-copy="support.label">Support the masjid</p>

        <h1 class="display-1 display-strong" data-reveal="text" data-copy="support.title">Give to the centre</h1>

        <p class="prose support-hero-line" data-reveal="text" data-copy="support.line">
          The heating, the lighting, the carpets, the water, the teachers and the
          repairs. A mosque costs something every single day it is open, and this is
          where that comes from.
        </p>
      </div>
    </section>

    <!-- The intention. First thing on the page after the heading, before any
         mention of money, because that is the order it belongs in. -->
    <section class="shell support-intention">
      <p class="label" data-reveal="text" data-copy="support.intention.label">Before you give</p>

      <p class="prose support-intention-note" data-reveal="text" data-copy="support.intention.note">
        Remember to make a good intention before you give.
      </p>

      <figure class="pull-quote" data-reveal="text">
        <blockquote>
          <p class="pull-quote-text" data-copy="support.hadith.text">Actions are according to
            intentions, and everyone will get what was intended.</p>
        </blockquote>
        <figcaption class="label pull-quote-source" data-copy="support.hadith.source">Bukhari &amp; Muslim</figcaption>
      </figure>
    </section>

    ${hasOneOff || state.authed ? `
    <section class="shell support-block" aria-labelledby="give-once">
      <p class="label" data-reveal="text" data-copy="support.once.label">One-time</p>

      <h2 class="display-3" id="give-once" data-reveal="text" data-copy="support.once.title">Give once</h2>

      <p class="prose" data-reveal="text" data-copy="support.once.line">
        Any amount, whenever you want to. Sadaqah, zakat or a one-off gift — it goes
        into the same pot as everything else and straight into running the centre.
      </p>

      <div class="support-actions" data-reveal="text">
        ${hasOneOff ? donateLink(donate.oneOff, 'Donate now', 'btn btn--primary btn--lg') : ''}
        ${hasOneOff ? '' : missingLink('the one-time donation')}
      </div>
    </section>` : ''}

    ${hasMonthly || state.authed ? `
    <section class="shell support-block" aria-labelledby="give-monthly">
      <p class="label" data-reveal="text" data-copy="support.monthly.label">Monthly</p>

      <h2 class="display-3" id="give-monthly" data-reveal="text" data-copy="support.monthly.title">Give every month</h2>

      <p class="prose" data-reveal="text" data-copy="support.monthly.line">
        A standing amount every month is the thing that lets the centre plan more than
        a fortnight ahead — and sadaqah jariyah does not stop when you do. Cancel it
        whenever you like: it is your own card, on your own Stripe page.
      </p>

      <!--
        The number of cards is written onto the grid, exactly like the event
        grids: however many amounts have a link, that is how many columns
        there are. Four amounts set up is four cards filling the row, not five
        columns with a hole in the last one.
      -->
      <ul class="tier-grid" data-count="${shownTiers.length}" style="--cols:${Math.max(1, shownTiers.length)}">
        ${shownTiers.map((tier) => `
        <li class="tier" data-reveal="text" ${tier.href ? '' : 'data-unset'}>
          <p class="tier-amount">£${tier.amount}</p>
          <p class="tier-period" data-copy="support.tier.period">a month</p>
          ${tier.href
            ? donateLink(tier.href, `Give £${tier.amount}`, 'btn tier-btn')
            : missingLink(`£${tier.amount} a month`)}
        </li>`).join('')}
      </ul>
    </section>` : ''}

    ${hasLaunchgood || state.authed ? `
    <section class="shell support-block" aria-labelledby="launchgood">
      <div class="support-panel">
        <p class="label" data-reveal="text" data-copy="support.launchgood.label">LaunchGood</p>

        <h2 class="display-4" id="launchgood" data-reveal="text" data-copy="support.launchgood.title">
          Give through LaunchGood
        </h2>

        <p class="prose" data-reveal="text" data-copy="support.launchgood.line">
          Our campaign page, if you would rather give there — or if you want to share
          it on and let other people give too.
        </p>

        <div class="support-actions" data-reveal="text">
          ${hasLaunchgood ? donateLink(donate.launchgood, 'Open our campaign', 'btn') : ''}
          ${hasLaunchgood ? '' : missingLink('the LaunchGood campaign')}
        </div>
      </div>
    </section>` : ''}

    <!--
      NOT EDITABLE, AND IT MUST STAY THAT WAY.

      A claim about charitable status is a claim about a LEGAL status, and Gift
      Aid in particular is a claim about somebody else's tax. Getting it wrong
      — by accident, in a hurry, by pasting in a sentence that sounded right —
      is not a typo.

      So this paragraph is the one thing on the page that cannot be rewritten
      from inside edit mode: it has no data-copy attribute, so there is nothing
      to click on and nothing to overwrite. Do not add one.

      WHOEVER PUTS THIS SITE LIVE: check this wording against the centre's
      actual registration before launch, and if it is wrong, change it HERE, in
      the code, with whoever runs the centre looking at it. If Taiba IS a
      registered charity, this is where the charity number goes and where a
      Gift Aid line would belong.
    -->
    ${hasAnyMoney || state.authed ? `
    <section class="shell support-legal">
      <p class="tiny">
        Taiba Islamic Centre is a registered non-profit. We are <strong>not</strong>
        registered with HMRC as a charity, so we cannot claim Gift Aid and donations to
        us are not tax-deductible. Everything given goes directly into running the
        centre.
      </p>
    </section>` : ''}

    <section class="shell support-block support-ways">
      <p class="label" data-reveal="text" data-copy="support.ways.label">Other ways to help</p>

      <h2 class="display-3" data-reveal="text" data-copy="support.ways.title">Not only money</h2>

      <p class="prose" data-reveal="text" data-copy="support.ways.line">
        Most of what keeps this building open was never paid for by anybody. If any of
        these is something you can offer, we would like to hear from you.
      </p>

      <ul class="ways-grid">
        ${SUPPORT_WAYS.map((way) => `
        <li class="way" data-reveal="text">
          <h3 class="way-title" data-copy="support.ways.${way.key}.title">${esc(way.title)}</h3>
          <p class="way-body" data-copy="support.ways.${way.key}.body">${esc(way.body)}</p>
        </li>`).join('')}
      </ul>

      <p class="support-actions" data-reveal="text">
        <a class="btn" href="/contact">
          <span data-copy="support.ways.cta">Get in touch</span>${icon('arrowRight')}
        </a>
      </p>
    </section>

    ${editOnly(`
    <section class="shell" style="padding-bottom:var(--space-3)">
      <button type="button" class="edit-chip" data-edit="donate-links">
        ${icon('pencil')} Donation links
      </button>
    </section>`)}
  </main>`;
}

/*
  CONTACT — the one placeholder page from the skeleton that has been built
  out, and the reason is the address.

  A mosque's website is read by somebody standing on a street trying to find
  the door, or trying to work out who to ring about a funeral at ten at night.
  Leaving that page as "this page has no sections yet" would be the single
  most expensive gap on the site.

  Every detail on it is already stored — the email, the phone number, the
  WhatsApp number, the address — so this adds no new plumbing at all. Each
  one is missing gracefully: an unset detail is simply not shown to a visitor,
  and in edit mode it is listed as a gap with a way in.
*/
async function renderContact() {
  const settings = (await load('settings').catch(() => ({}))) ?? {};
  const contact = settings.contact ?? {};

  const email = contact.email ?? '';
  const phone = contact.phone ?? '';
  const address = contact.address ?? '';
  const whatsapp = contact.whatsappNumber ?? '';

  /* A detail with nothing behind it. Visitors get nothing; edit mode gets a
     line saying what is missing, which is the whole point of showing it. */
  const gap = (what) => editOnly(`
    <p class="contact-gap">${icon('alert')}<span>No ${esc(what)} saved yet — it is hidden from visitors until there is one.</span></p>`);

  const block = (title, copyKey, body) => `
    <div class="contact-block" data-reveal="text">
      <h2 class="label contact-block-label" data-copy="${esc(copyKey)}">${esc(title)}</h2>
      ${body}
    </div>`;

  return `
  <main id="main" class="page page--contact">
    <section class="shell page-head" data-hero data-hero-tone="light">
      <p class="label" data-reveal="text" data-copy="contact.label">Contact</p>

      <h1 class="display-2" data-reveal="text" data-copy="contact.title">Come and find us</h1>

      <hr class="rule" data-reveal="text">

      <p class="prose" data-reveal="text" data-copy="contact.lede">
        The office is open around the prayers. For anything urgent — a janazah, a
        bereavement, somebody who needs help tonight — ring rather than email.
      </p>

      ${editOnly(`<div style="margin-top:var(--space-2)">
        <button type="button" class="edit-chip" data-edit="contact-social">${icon('pencil')} Contact details &amp; social links</button>
      </div>`)}
    </section>

    <section class="section shell contact-grid">
      ${block('Where we are', 'contact.where', address
        ? `<p class="contact-address">${paragraphs(address)}</p>
           <p class="contact-action">
             <a class="link-arrow" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(address)}"
                target="_blank" rel="noopener noreferrer">
               ${icon('pin')}<span data-copy="contact.map">Open in maps</span>
             </a>
           </p>`
        : gap('address'))}

      ${block('Ring us', 'contact.phone', phone
        ? `<p class="contact-line"><a class="text-link" href="tel:${esc(phone.replace(/[^+\d]/g, ''))}">${esc(phone)}</a></p>`
        : gap('phone number'))}

      ${block('Email', 'contact.email', email
        ? `<p class="contact-line"><a class="text-link" href="mailto:${esc(email)}">${esc(email)}</a></p>`
        : gap('email address'))}

      ${block('WhatsApp', 'contact.whatsapp', whatsapp
        ? `<p class="contact-line">
             <a class="text-link" href="https://wa.me/${esc(whatsapp)}" target="_blank" rel="noopener noreferrer">
               ${icon('whatsapp')}<span data-copy="contact.whatsapp.cta">Message the centre</span>
             </a>
           </p>`
        : gap('WhatsApp number'))}
    </section>

    <!--
      The times again, at the bottom of the page somebody landed on to find
      out when to come. The same table as everywhere else — see prayerTable().
    -->
    <section class="section shell contact-prayer">
      <div class="section-head">
        <div>
          <p class="label" data-reveal="text" data-copy="contact.prayer.label">Before you come</p>
          <h2 class="display-3" data-reveal="text" data-copy="contact.prayer.title">Today&#39;s times</h2>
        </div>
        <a class="link-arrow" href="/prayer-times" data-reveal="text">
          <span data-copy="contact.prayer.all">Full timetable</span>${icon('arrowRight')}
        </a>
      </div>

      <div class="prayer-card" data-reveal>${prayerTable(settings, { compact: true })}</div>
    </section>

    ${donateSection()}
  </main>`;
}


/*
  Any address that isn't a page.

  This used to fall back to the homepage, which is worse than it sounds: a
  mistyped or out-of-date link would quietly show the front page, so nobody —
  the visitor, or us — ever found out the link was wrong. Saying so is more
  use than pretending.
*/
async function renderNotFound() {
  return `
  <main id="main" class="page">
    <section class="shell page-head" data-hero data-hero-tone="light">
      <p class="label" data-reveal="text">Not found</p>
      <h1 class="display-2" data-reveal="text" style="margin-top:var(--space-1)">
        There is nothing here
      </h1>
      <p class="prose" data-reveal="text" style="margin-top:var(--space-2)">
        The address <code>${esc(window.location.pathname)}</code> isn't a page on this
        site. It may have been a typo, or something that has since moved.
      </p>
      <p data-reveal="text" style="margin-top:var(--space-3); display:flex; gap:var(--space-1); flex-wrap:wrap">
        <a class="btn" href="/">Back home</a>
        <a class="btn" href="/events">What's on</a>
      </p>
    </section>
  </main>`;
}

/* ------------------------------------------------------- Foundations ----- */

/*
  A development page, at /foundations, showing every token in use: the palette,
  the full type scale, the spacing steps, the cursor over light and dark, and
  staggered reveals.

  It is not linked from anywhere and is not part of the site. DELETE THIS
  FUNCTION AND ITS LINE IN `ROUTES` before the site goes live.
*/

/** One colour swatch with its value and what it is for. */
const swatch = (name, value, role, { dark = false } = {}) => `
  <div style="border:1px solid var(--hairline)">
    <div style="background:${value}; aspect-ratio:3/2"></div>
    <div style="padding:var(--space-1)">
      <p class="label" style="color:${dark ? 'var(--accent)' : 'var(--accent)'}">${esc(name)}</p>
      <p class="small-text" style="margin-top:4px"><code>${esc(value)}</code></p>
      <p class="micro" style="margin-top:4px">${esc(role)}</p>
    </div>
  </div>`;

/** One step of the type scale, shown at size with its token underneath. */
const typeStep = (token, sample, note) => `
  <div style="border-top:1px solid var(--hairline); padding-block:var(--space-2)">
    <p class="display" style="font-size:var(--${token})">${esc(sample)}</p>
    <p class="micro" style="margin-top:var(--space-1)">
      <code>--${esc(token)}</code> — ${esc(note)}
    </p>
  </div>`;

/** One step of the spacing scale, drawn to scale as a bar. */
const spaceStep = (token, px, use) => `
  <div style="display:grid; grid-template-columns:minmax(0,1fr) 200px 200px; gap:var(--space-1); align-items:center; border-top:1px solid var(--hairline); padding-block:12px">
    <div style="height:14px; width:${px}px; max-width:100%; background:var(--brand)"></div>
    <p class="micro"><code>--${esc(token)}</code> · ${px}px</p>
    <p class="micro">${esc(use)}</p>
  </div>`;

async function renderFoundations() {
  /*
    THE GOLD, AND WHY THE SMALL TEXT IS NOT THE LOGO'S GOLD.

    Contrast is measured against --page #FBF9F4. 4.5:1 is the accessibility
    minimum for text at the size the labels are actually set — 12px. The logo
    gold is a beautiful colour and it does not pass; the one the labels use is
    the same hue taken down until it does.
  */
  const candidates = [
    ['#B5812A', '3.27', 'the logo gold, measured off the artwork — fails AA as text'],
    ['#A8741F', '3.90', 'a first attempt at darkening it — still short'],
    ['#9E6E1D', '4.30', 'closer, and still under the line'],
    ['#96661A', '4.77', 'IN USE as --accent — the logo gold, nudged past AA'],
    ['#8A5E14', '5.45', 'more headroom, and starting to read as brown'],
    ['#0A2C6C', '12.6', 'the navy — passes easily, but a navy label reads as body text'],
  ];

  const candidateRow = ([hex, contrast, note]) => `
    <tr style="border-top:1px solid var(--hairline)">
      <td style="padding:10px 0"><span style="display:inline-block;width:36px;height:22px;background:${hex};vertical-align:middle;border:1px solid var(--hairline)"></span></td>
      <td style="padding:10px var(--space-1)"><code>${esc(hex)}</code></td>
      <td style="padding:10px var(--space-1)">${esc(contrast)}:1</td>
      <td style="padding:10px 0" class="micro">${esc(note)}</td>
    </tr>`;

  /* Blocks standing in for photographs, so reveals can be seen without assets. */
  const mediaBlock = (n) => `
    <figure data-reveal style="background:var(--brand); aspect-ratio:var(--row-figure-ratio); display:grid; place-items:center">
      <span class="display" style="color:var(--on-brand); font-size:var(--display-4)">${n}</span>
    </figure>`;

  return `
  <main id="main" class="page">

    <!-- ----------------------------------------------------------- Intro -->
    <!--
      A DARK hero, so the header's transparent state and the light/dark logo
      swap can actually be seen. The real pages all have pale heroes for now,
      so their header keeps the dark wordmark — see placeholderPage().
    -->
    <section data-hero data-hero-tone="dark" data-cursor="invert"
             style="background:var(--brand); color:var(--on-brand); padding-block: calc(var(--unit) + var(--space-4)) var(--space-4)">
      <div class="shell">
        <p class="label" data-reveal="text" style="color:var(--on-brand)">Development page — delete before launch</p>
        <h1 class="display-1" data-reveal="text" style="margin-top:var(--space-1)">Foundations</h1>
        <p class="prose" data-reveal="text" style="margin-top:var(--space-2); color:var(--on-brand)">
          Every token on one page. Move the mouse around: the circle is the custom
          cursor, it grows over links and buttons, and it is pale here because
          this band is marked data-cursor="invert". Scroll slowly — the scrolling
          itself is Lenis. Scroll down and the header turns solid and swaps its
          arch from the light artwork to the dark one.
        </p>
      </div>
    </section>

    <!-- --------------------------------------------------------- Colour -->
    <section class="shell" style="padding-block:var(--space-3)">
      <p class="label">01 — Colour</p>
      <h2 class="display-3" style="margin-top:var(--space-1)">Navy, gold, parchment</h2>
      <p class="prose" style="margin-top:var(--space-2)">
        Every one of these came off the logo.
        <strong style="font-weight:var(--weight-medium)">--brand</strong> is for large fills,
        <strong style="font-weight:var(--weight-medium)">--gold</strong> for decoration at size —
        rules, arches, icons — and
        <strong style="font-weight:var(--weight-medium)">--accent</strong>, a deeper cut of the
        same gold, for small text. They are not interchangeable: --brand on a 12px
        label reads as body text, and --gold at that size does not meet the
        contrast minimum at all.
      </p>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:var(--space-2); margin-top:var(--space-3)">
        ${swatch('--brand', '#0A2C6C', 'donate band, footer, menu, loading panel')}
        ${swatch('--brand-deep', '#061D4A', 'pressed state on top of --brand')}
        ${swatch('--gold', '#B5812A', 'rules, arches, icons — never small text')}
        ${swatch('--gold-soft', '#E2C185', 'gold that has to work on navy')}
        ${swatch('--accent', '#96661A', 'labels, link text, the When column')}
        ${swatch('--page', '#FBF9F4', 'the page itself')}
        ${swatch('--sand', '#F3EDE1', 'a section that steps forward')}
        ${swatch('--ink', '#10141C', 'all body and heading text')}
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:var(--space-2); margin-top:var(--space-2)">
        <div style="background:var(--accent-soft); padding:var(--space-2); border:1px solid var(--hairline)">
          <p class="label">--accent-soft</p>
          <p class="micro" style="margin-top:6px">A wash for hover backgrounds and quiet panels. Never for text.</p>
        </div>
        <div style="background:var(--accent-soft-hover); padding:var(--space-2); border:1px solid var(--hairline)">
          <p class="label">--accent-soft-hover</p>
          <p class="micro" style="margin-top:6px">The same wash, one step stronger.</p>
        </div>
      </div>
    </section>

    <!-- ------------------------------------------- Accent alternatives -->
    <section class="shell" style="padding-block:var(--space-3)">
      <p class="label">01b — Choosing the accent</p>
      <h2 class="display-4" style="margin-top:var(--space-1)">Why the labels are not the logo gold</h2>
      <p class="prose" style="margin-top:var(--space-2)">
        Contrast is measured against the page colour; 4.5:1 is the accessibility
        minimum for text at this size. The logo gold is the top row. The one
        actually in use is the fourth — the same hue, dark enough to read, and
        the full-strength gold is still used everywhere contrast is not the
        question.
      </p>

      <table style="width:100%; border-collapse:collapse; margin-top:var(--space-2); font-size:var(--small)">
        <thead>
          <tr>
            <th style="text-align:left; padding-bottom:8px"></th>
            <th style="text-align:left; padding:0 var(--space-1) 8px" class="label">Hex</th>
            <th style="text-align:left; padding:0 var(--space-1) 8px" class="label">Contrast</th>
            <th style="text-align:left; padding-bottom:8px" class="label">Notes</th>
          </tr>
        </thead>
        <tbody>${candidates.map(candidateRow).join('')}</tbody>
      </table>

      <p style="margin-top:var(--space-2)">
        The same label, in each candidate, at the size it will actually be used:
      </p>
      <div style="display:flex; flex-wrap:wrap; gap:var(--space-2); margin-top:var(--space-1)">
        ${candidates.map(([hex]) => `
          <span style="font-size:var(--label); font-weight:var(--weight-medium); letter-spacing:var(--track-label); text-transform:uppercase; color:${hex}">
            Prayer hall · ${esc(hex)}
          </span>`).join('')}
      </div>
    </section>

    <!-- ----------------------------------------------------------- Type -->
    <section class="shell" style="padding-block:var(--space-3)">
      <p class="label">02 — Type</p>
      <h2 class="display-3" style="margin-top:var(--space-1)">Cormorant and Jakarta</h2>
      <p class="prose" style="margin-top:var(--space-2)">
        Cormorant Garamond at 500 and 600 for every heading — the classical serif
        the wordmark is drawn in. Plus Jakarta Sans at 400 and 500 for everything
        else. Headings are MIXED CASE: this face is built around its capitals and
        setting whole lines in them wastes them. The only uppercase on the site is
        the 12px label, tracked to 0.16em, which is the logo&#39;s own spacing.
      </p>

      <div style="margin-top:var(--space-3)">
        ${typeStep('display-1', 'Taiba', 'hero — reaches 11vw')}
        ${typeStep('display-2', 'Welcome to Taiba', 'section openers')}
        ${typeStep('display-3', 'Qur\u2019an classes', 'sub-sections')}
        ${typeStep('display-4', 'Every Friday, 1.15pm', 'card and row headings')}
        ${typeStep('heading', 'The smallest heading', 'the last step')}
      </div>

      <div style="border-top:1px solid var(--hairline); padding-top:var(--space-2); margin-top:var(--space-1)">
        <p class="body-text">Body — 17px at line-height 1.35, weight 400. This is the default for everything.</p>
        <p class="small-text" style="margin-top:var(--space-1)">Small — 15px. Nav links and the footer.</p>
        <p class="micro" style="margin-top:var(--space-1)">Micro — 13px. Captions, meta, the edit interface.</p>
        <p class="label" style="margin-top:var(--space-1)">Label — 12px uppercase, in the accent</p>
        <p class="prose" style="margin-top:var(--space-2)">
          Prose — the same 17px but at line-height 1.62 and capped at 62 characters.
          1.35 is right for interface text, but a long paragraph set that tight is
          hard to read, so there is a looser step for proper reading copy.
        </p>
        <p style="margin-top:var(--space-2)">
          A <a class="text-link" href="/foundations">link in the accent</a> sits in
          running text like this, and darkens on hover rather than lightening,
          because a lighter gold drops below the contrast minimum.
        </p>
      </div>
    </section>

    <!-- -------------------------------------------------------- Spacing -->
    <section class="shell" style="padding-block:var(--space-3)">
      <p class="label">03 — Spacing</p>
      <h2 class="display-4" style="margin-top:var(--space-1)">Everything off one 64px unit</h2>
      <div style="margin-top:var(--space-2)">
        ${spaceStep('space-1', 16, 'inside a component')}
        ${spaceStep('space-2', 32, 'between components')}
        ${spaceStep('space-3', 64, 'between groups — the base unit')}
        ${spaceStep('space-4', 128, 'between sections')}
        ${spaceStep('space-5', 192, 'around a section that needs air')}
      </div>
      <p class="micro" style="margin-top:var(--space-2)">
        The header is 64px tall and the main grid gap is 64px. Same number, on purpose.
      </p>
    </section>

    <!-- --------------------------------------------------------- Cursor -->
    <section class="shell" style="padding-block:var(--space-3)">
      <p class="label">04 — Cursor</p>
      <h2 class="display-4" style="margin-top:var(--space-1)">Light area</h2>
      <p class="prose" style="margin-top:var(--space-2)">
        The circle is 16px, filled with --accent, and chases the pointer at 15% of
        the remaining distance each frame. Over the next three it scales to 2.5×.
      </p>
      <div style="display:flex; flex-wrap:wrap; gap:var(--space-2); margin-top:var(--space-2)">
        <a class="btn" href="/foundations">A link</a>
        <button type="button" class="btn">A button</button>
        <span class="btn" data-cursor-grow>A span with data-cursor-grow</span>
      </div>
    </section>

    <section data-cursor="invert" style="background:var(--brand); color:var(--on-brand); padding-block:var(--space-4); margin-top:var(--space-2)">
      <div class="shell">
        <p class="label" style="color:var(--on-brand)">04b — data-cursor="invert"</p>
        <h2 class="display-2" style="margin-top:var(--space-1)">Dark band</h2>
        <p class="prose" style="margin-top:var(--space-2); color:var(--on-brand)">
          This whole section carries data-cursor="invert", so the circle turns
          white anywhere inside it — including over the button below, where it is
          both white and scaled up. The attribute goes on the band, not on every
          element in it: the cursor walks up the tree to find it.
        </p>
        <div style="margin-top:var(--space-2)">
          <button type="button" class="btn" style="border-color:var(--on-brand); color:var(--on-brand)">
            A button on the dark band
          </button>
        </div>
        <p class="micro" style="margin-top:var(--space-3); color:var(--on-brand); opacity:0.7">
          This is also the one place --brand is used as a large fill, which is what it is for.
        </p>
      </div>
    </section>

    <!-- -------------------------------------------------------- Reveals -->
    <section class="shell" style="padding-block:var(--space-4)">
      <p class="label">05 — Scroll reveal</p>
      <h2 class="display-4" style="margin-top:var(--space-1)">Text rises, media only fades</h2>

      <div style="margin-top:var(--space-3)">
        <p class="display-4" data-reveal="text">First line.</p>
        <p class="display-4" data-reveal="text">Second, 0.1s later.</p>
        <p class="display-4" data-reveal="text">Third, 0.2s later.</p>
        <p class="display-4" data-reveal="text">Fourth, 0.3s later.</p>
      </div>

      <p class="micro" style="margin-top:var(--space-2)">
        Each of those is data-reveal="text" — it fades in and rises 20px. The
        stagger is automatic: app.js numbers the siblings and the CSS turns that
        into a 0.1s gap.
      </p>

      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:var(--space-2); margin-top:var(--space-4)">
        ${[1, 2, 3, 4, 5].map(mediaBlock).join('')}
      </div>

      <p class="micro" style="margin-top:var(--space-2)">
        And those are plain data-reveal — opacity only, no movement. A photograph
        sliding upward looks cheap, so media never travels.
      </p>
    </section>

    <!-- ----------------------------------------------------- What to tune -->
    <section class="shell" style="padding-block:var(--space-3) var(--space-5)">
      <p class="label">06 — What to tune</p>
      <h2 class="display-4" style="margin-top:var(--space-1)">And where it lives</h2>
      <ul class="prose" style="margin-top:var(--space-2); display:grid; gap:var(--space-1); max-width:70ch">
        <li><strong style="font-weight:var(--weight-medium)">--accent</strong> — styles.css, part 1. The one value most worth arguing about. Alternatives are in the table above.</li>
        <li><strong style="font-weight:var(--weight-medium)">--display-1</strong> — the 13vw middle number. Try 11vw or 15vw with a real headline in place; it reads very differently with two words than with six.</li>
        <li><strong style="font-weight:var(--weight-medium)">--line-loose</strong> — 1.5, my addition for reading copy. Not from the spec.</li>
        <li><strong style="font-weight:var(--weight-medium)">--cursor-lerp</strong> — 0.15. Higher is snappier, lower floatier. Read by app.js from the CSS.</li>
        <li><strong style="font-weight:var(--weight-medium)">--cursor-grow</strong> — 2.5×.</li>
        <li><strong style="font-weight:var(--weight-medium)">--reveal-delay</strong> — 0.1s. Doubles as the stagger gap, so raising it slows the whole cascade.</li>
        <li><strong style="font-weight:var(--weight-medium)">Lenis options</strong> — app.js, mountLenis(). Currently the defaults.</li>
      </ul>
    </section>

  </main>`;
}


/* ================================================================= SEO ==== */

/*
  WHAT SEARCH ENGINES AND WHATSAPP SEE.

  This site draws every page with JavaScript into one index.html, which means
  the <title> and the meta tags in that file are only ever the starting point —
  they have to be rewritten as you move from page to page. That is what this
  section does.

  Three audiences, all reading the same tags:

    the browser tab       <title>
    search engines        <title>, <meta name="description">, <link rel="canonical">
    WhatsApp / X / etc.   the og: and twitter: tags, especially og:image

  Every page's title and description can be rewritten in edit mode without
  touching this file — see the "Page titles & descriptions" chip. The overrides
  live in the same store as every other text edit on the site, under keys
  beginning `seo.`, so they show up in "Text you have changed" and can be reset
  the same way as anything else.

  An event's page is the exception, and deliberately: its title, description
  and picture come from the event itself, because they are already editable
  there and keeping a second copy in step by hand is exactly the sort of job
  nobody ever does.
*/

const SITE_NAME = 'Taiba Islamic Centre';

/*
  The address the site is served from, used to build the absolute URLs that
  og:image and canonical both require — a relative path in either one is
  ignored. Taken from the browser, so it is right in every environment without
  anything being configured: localhost while you work, the preview URL on a
  Vercel preview, and the real domain in production.
*/
const siteOrigin = () => window.location.origin;
const absolute = (path) => (path ? new URL(path, siteOrigin()).href : '');

/** Cut a description down to something a search engine will actually show. */
function trimMeta(text, limit = 160) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  /* Cut at the last space before the limit, so the snippet never ends
     mid-word. */
  const cut = flat.slice(0, limit - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')) || cut}…`;
}

/** Set (or create) one <meta>. `attr` is 'name' for meta tags, 'property' for og:. */
function setMetaTag(attr, key, content) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) { tag?.remove(); return; }
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Rewrite every tag for the page now on screen.
 *
 * `image` is optional. Without one the site-wide sharing picture is used, so
 * a link to any page still comes up with something rather than a grey box.
 */
function applyMeta({ title, description, image = '', type = 'website' }) {
  /*
    "— Taiba Islamic Centre" goes on the end, unless the title already says it.

    The bare `title === SITE_NAME` test this started as was not enough: the
    moment somebody typed "Taiba Islamic Centre — Edgware" into the title box,
    the tab read "…Edgware — Taiba Islamic Centre". Checking for the name
    anywhere in the title is what makes the box safe to type into.
  */
  const full = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
  const url = absolute(window.location.pathname);
  const picture = absolute(image || (state.settings?.shareImageUrl ?? ''));
  const text = trimMeta(description);

  document.title = full;
  setMetaTag('name', 'description', text);
  setCanonical(url);

  setMetaTag('property', 'og:type', type);
  setMetaTag('property', 'og:site_name', SITE_NAME);
  setMetaTag('property', 'og:title', full);
  setMetaTag('property', 'og:description', text);
  setMetaTag('property', 'og:url', url);
  setMetaTag('property', 'og:image', picture);

  /* summary_large_image gives the wide picture card; without a picture it
     would render as a big empty frame, so it steps down to the small one. */
  setMetaTag('name', 'twitter:card', picture ? 'summary_large_image' : 'summary');
  setMetaTag('name', 'twitter:title', full);
  setMetaTag('name', 'twitter:description', text);
  setMetaTag('name', 'twitter:image', picture);
}

/**
 * The title and description for a route, with any edit-mode override applied.
 * Returns the defaults written into the ROUTES table when nothing is stored.
 */
function metaFor(route) {
  const copy = state.copy ?? {};
  return {
    title: copy[`seo.${route.key}.title`] || route.title,
    description: copy[`seo.${route.key}.description`] || route.description,
  };
}

/* ============================================================ Router ====== */

/*
  A list rather than a lookup table, because one of the routes has a parameter
  in it. The FIRST pattern that matches wins, so order matters: '/events' must
  come before '/events/:slug' would ever be a problem — it isn't here, because
  the two have different numbers of segments.
*/
/*
  Each route carries the two things a search engine wants — a title and a
  description — and a `key`, which is the name its edit-mode overrides are
  stored under (`seo.home.title`, and so on). The wording here is the DEFAULT;
  anything typed into the "Page titles & descriptions" form wins over it.

  Titles leave "— Taiba Islamic Centre" off: applyMeta() adds it. Writing it
  into each one by hand is how you end up with "Events — Taiba Islamic Centre
  — Taiba Islamic Centre".
*/
const ROUTES = [
  {
    path: '/', key: 'home', title: 'Taiba Islamic Centre',
    description: 'A mosque and community centre in Edgware. Daily prayers and Jumu\u2019ah, Qur\u2019an and Arabic classes, funerals, marriages, and a door that is open to everybody.',
    render: renderHome, mount: mountHome,
  },
  {
    /*
      The most-visited page on any mosque's website, so it is second in this
      list, second in the menu and the first thing under the hero. Its mount
      is the one that highlights whichever prayer is next.
    */
    path: '/prayer-times', key: 'prayer', title: 'Prayer Times',
    description: 'Today\u2019s prayer times at Taiba Islamic Centre in Edgware — Fajr, Zuhr, Asr, Maghrib and Isha, with jama\u2019ah times and Jumu\u2019ah.',
    render: renderPrayerTimes, mount: mountPrayerTimes,
  },
  {
    path: '/services', key: 'services', title: 'Services',
    description: 'What the centre offers: daily prayers and Jumu\u2019ah, Qur\u2019an and Arabic classes for children and adults, marriages, funerals and community work.',
    render: renderServices, mount: mountServices,
  },
  {
    path: '/events', key: 'events', title: 'Events',
    description: 'Everything coming up at Taiba Islamic Centre — talks, classes, iftars, fundraisers and open days — and everything that has already been.',
    render: renderEvents, mount: mountEvents,
  },
  {
    /* This one's title, description and picture come from the event itself —
       see renderEvent(). The wording here is only the fallback. */
    path: '/events/:slug', key: 'event', title: 'Event',
    description: 'An event at Taiba Islamic Centre.',
    render: renderEvent,
  },
  {
    path: '/about', key: 'about', title: 'About',
    description: 'About Taiba Islamic Centre: a mosque, a school and a meeting place in Edgware, run by the people who pray in it.',
    render: renderAbout,
  },
  {
    path: '/donate', key: 'donate', title: 'Donate',
    description: 'Support the masjid. Give once or monthly through Stripe or LaunchGood — or help with your time, your trade, or equipment the centre needs.',
    render: renderDonate,
  },
  {
    path: '/contact', key: 'contact', title: 'Contact',
    description: 'Where to find Taiba Islamic Centre in Edgware, and how to reach the office — by phone, email or WhatsApp.',
    render: renderContact, mount: mountPrayerTimes,
  },

  /* Development only — the design system on one page. Delete this line and
     renderFoundations() before the site goes live. */
  {
    path: '/foundations', key: 'foundations', title: 'Foundations',
    description: 'The design system on one page. Development only.',
    render: renderFoundations,
  },
];

/* Not in ROUTES, because nothing should ever match it — it is what is shown
   when nothing else does. */
const NOT_FOUND = {
  path: '*', key: 'not-found', title: 'Not found',
  description: 'That address is not a page on this site.',
  render: renderNotFound,
};

/* The pages the "Page titles & descriptions" form offers, and the ones the
   sitemap lists. Neither the event template nor the development page belongs
   in either. */
const INDEXABLE_ROUTES = ROUTES.filter(
  (route) => !route.path.includes(':') && route.key !== 'foundations'
);

/**
 * Find the route for an address, pulling out any `:name` parts.
 * '/events/summer-camp' against '/events/:slug' gives { slug: 'summer-camp' }.
 */
function matchRoute(pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);

  for (const route of ROUTES) {
    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== parts.length) continue;

    const params = {};
    const matched = pattern.every((segment, index) => {
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = decodeURIComponent(parts[index]);
        return true;
      }
      return segment === parts[index];
    });

    if (matched) return { route, params };
  }
  return null;
}

/* Listeners owned by the page currently on screen, torn down on every move. */
let cleanups = [];
const registerCleanup = (fn) => cleanups.push(fn);

const app = $('#app');

async function renderRoute(pathname, { restoreScroll = false } = {}) {
  const match = matchRoute(pathname);
  const route = match?.route ?? NOT_FOUND;
  const params = match?.params ?? {};

  // Tidy up whatever the last page left behind.
  if (activeCopyEdit) finishCopyEdit({ save: false });
  cleanups.forEach((fn) => fn());
  cleanups = [];
  closeModal();
  /* Navigating closes the menu. Focus is not restored to the trigger, because
     the trigger is part of the page about to be thrown away. */
  closeMenu({ restoreFocus: false });

  app.setAttribute('aria-busy', 'true');

  /*
    The name in the browser tab, and everything a search engine or WhatsApp
    reads with it.

    Most pages are happy with the title and description in the ROUTES table. A
    page about one particular thing — an event — wants its own, so it sets
    pageMeta while it renders and that is used instead. Cleared here so that
    the last page's details can never leak onto this one.
  */
  state.pageMeta = null;

  let pageHtml;
  try {
    pageHtml = await route.render(params);
  } catch (error) {
    // A page that fails to load should still leave a usable site around it.
    console.error(error);
    pageHtml = `
      <main id="main" class="page">
        <section class="shell" style="padding-block: var(--space-4)">
          ${emptyState("We couldn't load this page", error.message)}
          <p style="margin-top: var(--space-2)"><a class="btn" href="/">Back home</a></p>
        </section>
      </main>`;
  }

  app.innerHTML =
    headerFragment() + menuFragment(pathname) + pageHtml + footerFragment();
  applyCopy(app);                 // your edits, before the browser paints
  app.removeAttribute('aria-busy');
  applyMeta(state.pageMeta ?? metaFor(route));

  mountHeader();
  mountMenu();
  mountReveals();
  mountFilms();                 // any page may carry a full-width film
  route.mount?.();              // anything this page in particular needs
  if (state.authed) mountEditHandlers();

  /* Anchor links within a page, e.g. /services#mentoring. */
  const hash = window.location.hash;
  if (hash) {
    const target = document.getElementById(hash.slice(1));
    if (target) {
      scrollTo(target);
      return;
    }
  }
  /* A new page starts at the top, and instantly — animating the jump between
     two different pages just looks like a glitch. */
  if (!restoreScroll) scrollTo(0, { immediate: true });
}

function navigate(path, { replace = false } = {}) {
  const url = new URL(path, window.location.origin);
  const samePage = url.pathname === window.location.pathname;

  if (replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);

  if (samePage && url.hash) {
    const target = document.getElementById(url.hash.slice(1));
    if (target) scrollTo(target);
    return;
  }
  renderRoute(url.pathname);
}

/*
  Take scroll restoration off the browser.

  By default a browser puts you back where you were when you reload — which is
  wrong for a site like this one. The page it restores you into hasn't been
  built yet, so it restores a position in the OLD page, every reveal below that
  point fires while you can't see it, and by the time you scroll down there the
  animations have already happened. renderRoute() decides where the scroll
  should be instead.
*/
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/* Catch clicks on internal links, so navigating never reloads the page. */
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;
  // Let the browser handle modified clicks (new tab, download, and so on).
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  if (link.target === '_blank' || link.hasAttribute('download')) return;

  const href = link.getAttribute('href');
  if (!href || !href.startsWith('/')) return;

  event.preventDefault();
  navigate(href);
});

/* The browser's back and forward buttons. */
window.addEventListener('popstate', () =>
  renderRoute(window.location.pathname, { restoreScroll: true }));


/* -------------------------------------------------- Chrome behaviours --- */

/*
  The header has two jobs, and they are kept completely separate so they can
  never interfere with one another:

    1. HIDE ON THE WAY DOWN, RETURN ON THE WAY UP.
       Scrolling down past 100px takes it away. ANY upward movement brings it
       straight back, with no threshold at all — if you flick up even slightly
       you want the navigation, immediately.

    2. TRANSPARENT OVER THE HERO, SOLID AFTERWARDS.
       While the bar sits over the page's hero section it has no background, so
       the hero runs right up underneath it. Once the hero has scrolled by, a
       solid --page background slides in behind the bar.

  Both are just attributes on the element. Everything that actually moves or
  fades is the 0.3s CSS transition in styles.css — there is no animation code
  here at all, which is why the two can never fight.
*/

const HEADER_HEIGHT = 64;
const HIDE_AFTER = 100;   // don't hide until we are this far down the page

/**
 * Subscribe to "the page scrolled", and return a function that unsubscribes.
 *
 * WHY THIS ISN'T JUST addEventListener('scroll'): when Lenis is running it
 * animates the scroll position itself, and the browser's own scroll event is
 * not a reliable way to hear about it. Lenis emits its own event instead, so
 * anything that reacts to scrolling has to listen to whichever one is actually
 * in charge.
 *
 * Both are attached, deliberately. Lenis can be started and stopped at any
 * time — plug in a mouse, change the reduce-motion setting — and this way
 * nothing has to be torn down and rebuilt when that happens. Being called
 * twice for one scroll is harmless: every handler below just reads the current
 * position and sets an attribute from it.
 */
function onScrollChange(handler) {
  window.addEventListener('scroll', handler, { passive: true });
  lenis?.on('scroll', handler);

  return () => {
    window.removeEventListener('scroll', handler);
    lenis?.off('scroll', handler);
  };
}

function mountHeader() {
  const header = $('.header', app);
  if (!header) return;

  const hero = $('[data-hero]', app);
  /* A pale hero keeps the dark arch and dark text; a dark one flips both. */
  const heroIsDark = hero?.dataset.heroTone === 'dark';
  /* Only the ARCH is a picture — the two words beside it are live text and
     change colour with the bar, in CSS. See brandMark(). */
  const mark = $('.brand-mark', header);

  /*
    Where the hero ends. Measured rather than watched with an observer: a
    number compared against the scroll position cannot get out of step, and it
    costs nothing. Re-measured on resize, because the hero's height changes
    with the width.
  */
  let heroBottom = 0;
  const measure = () => {
    heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 0;
  };

  let lastY = window.scrollY;
  let transparent = null;   // null so the first pass always applies a value

  const onScroll = () => {
    const y = window.scrollY;

    /* --- 1. Direction ---------------------------------------------------- */
    if (y > lastY && y > HIDE_AFTER) {
      header.dataset.hidden = 'true';        // going down, and far enough in
    } else if (y < lastY) {
      header.dataset.hidden = 'false';       // any upward movement at all
    }
    lastY = y;

    /* --- 2. Over the hero, or past it ------------------------------------ */
    // The bar is "over the hero" until the hero's bottom edge reaches it.
    const overHero = y < heroBottom - HEADER_HEIGHT;
    if (overHero === transparent) return;    // nothing changed; do no work
    transparent = overHero;

    header.dataset.transparent = String(overHero);
    header.dataset.onDark = String(overHero && heroIsDark);

    /*
      Swap the arch to match. The reversed artwork only while the bar is
      transparent over a DARK hero — over a pale one, white lines would be
      invisible, which is worse than not swapping at all.
    */
    if (mark) {
      const wanted = overHero && heroIsDark ? MARK_LIGHT : MARK_DARK;
      if (!mark.src.endsWith(wanted)) mark.src = wanted;
    }
  };

  measure();
  onScroll();

  const unsubscribe = onScrollChange(onScroll);
  window.addEventListener('resize', measure);
  registerCleanup(() => {
    unsubscribe();
    window.removeEventListener('resize', measure);
  });
}


/* ------------------------------------------------------------ The menu --- */

/*
  The overlay sits above the header and covers it, so the header does not have
  to move out of the way — it simply stays where it is underneath.

  While it is open the menu behaves like a dialog: the page behind it doesn't
  scroll, Tab cycles inside it rather than wandering into the hidden page
  behind, Escape closes it, and closing puts focus back on whatever opened it.
*/

let menuTeardown = null;
let menuOpener = null;

/*
  NOTE ON NAMING: the flag on <body> is `data-menu`, NOT `data-menu-open`.
  `data-menu-open` marks the trigger BUTTON, and an attribute of that name on
  <body> would be picked up by `[data-menu-open]` as well.
*/
function openMenu() {
  const menu = $('.menu', app);
  if (!menu || menu.dataset.open === 'true') return;

  menuOpener = document.activeElement;

  menu.dataset.open = 'true';
  document.body.dataset.menu = 'open';
  $('[data-menu-open]', app)?.setAttribute('aria-expanded', 'true');

  /* Lenis keeps animating the page behind the panel otherwise. */
  lenis?.stop();

  const focusables = () =>
    $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', menu)
      .filter((node) => node.offsetParent !== null);

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== 'Tab') return;

    const nodes = focusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', onKeydown);
  menuTeardown = () => document.removeEventListener('keydown', onKeydown);

  /*
    Move focus into the panel, so Escape is not the only way back out.

    The panel is visibility:hidden until the `data-open` attribute set above
    takes effect, and nothing inside a hidden subtree can be focused — calling
    focus() too early does nothing at all and quietly leaves focus behind on
    the trigger. Reading offsetHeight forces the browser to apply the change
    first, which makes this deterministic rather than a race.

    The retry on the next frame covers browsers that still defer it.
  */
  const closeButton = $('[data-menu-close]', menu);
  void menu.offsetHeight;          // forces the style/layout flush
  closeButton?.focus();

  if (closeButton && document.activeElement !== closeButton) {
    requestAnimationFrame(() => {
      if (menu.dataset.open === 'true') closeButton.focus();
    });
  }
}

function closeMenu({ restoreFocus = true } = {}) {
  const menu = $('.menu', app);
  menuTeardown?.();
  menuTeardown = null;

  document.body.dataset.menu = 'closed';
  lenis?.start();

  if (!menu || menu.dataset.open !== 'true') {
    menuOpener = null;
    return;
  }

  menu.dataset.open = 'false';
  $('[data-menu-open]', app)?.setAttribute('aria-expanded', 'false');

  if (restoreFocus && menuOpener instanceof HTMLElement && document.contains(menuOpener)) {
    menuOpener.focus();
  }
  menuOpener = null;
}

function mountMenu() {
  $('[data-menu-open]', app)?.addEventListener('click', openMenu);
  $('[data-menu-close]', app)?.addEventListener('click', () => closeMenu());
  /* Following a link closes it — renderRoute() calls closeMenu() on the way. */
}


/* ------------------------------------------------------- The preloader --- */

/*
  Lifting the blue panel.

  The panel is on screen from the very first frame because index.html put
  <html data-loading> there before the browser painted. Taking that attribute
  off is what makes it slide up and away, on the same 0.6s curve as the menu.

  It is removed exactly once, whatever happens afterwards: navigating around
  the site must never bring it back. If something above threw and the page
  never rendered, the safety timer in index.html removes it anyway.
*/
function dismissPreloader() {
  if (!document.documentElement.hasAttribute('data-loading')) return;

  let lifted = false;
  const lift = () => {
    if (lifted) return;
    lifted = true;
    document.documentElement.removeAttribute('data-loading');
  };

  /*
    Two frames of breathing space, so the first page is painted UNDERNEATH the
    panel before it lifts — otherwise the panel slides away to reveal a page
    that is still assembling itself.
  */
  requestAnimationFrame(() => requestAnimationFrame(lift));

  /*
    ...and a timer that lifts it regardless.

    A browser stops handing out animation frames to a page it isn't drawing —
    a background tab, a hidden panel — so on its own the line above would leave
    someone who opened the site in a background tab staring at a blue screen
    when they finally switched to it. Whichever of the two fires first wins;
    `lifted` makes sure the second one does nothing.
  */
  setTimeout(lift, 250);
}


/**
 * Scroll reveal.
 *
 *   data-reveal          fades in           — use on MEDIA (opacity only)
 *   data-reveal="text"   fades in and rises — use on headings and copy
 *
 * Siblings stagger automatically: within any one parent, the first revealing
 * element gets --i:0, the next --i:1, and so on, which the CSS turns into a
 * 0.1s gap between each. Set style="--i:3" yourself to override the order.
 */
function mountReveals() {
  const nodes = $$('[data-reveal]', app);
  if (!nodes.length) return;

  /*
    Number the siblings. Grouping by parent rather than numbering the whole
    page means a section further down starts its own count at zero, instead of
    inheriting a two-second delay from everything above it.
  */
  const seen = new Map();
  nodes.forEach((node) => {
    if (node.style.getPropertyValue('--i')) return;   // an explicit order wins
    const index = seen.get(node.parentElement) ?? 0;
    node.style.setProperty('--i', String(index));
    seen.set(node.parentElement, index + 1);
  });

  /*
    With "reduce motion" on — or on a browser too old for IntersectionObserver
    — show everything at once. Never leave content stuck at opacity 0 because
    a nicety didn't load.
  */
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.setAttribute('data-revealed', ''));
    return;
  }

  const revealAll = () => nodes.forEach((node) => node.setAttribute('data-revealed', ''));

  let observerHasFired = false;

  const observer = new IntersectionObserver((entries) => {
    observerHasFired = true;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.setAttribute('data-revealed', '');
      observer.unobserve(entry.target);   // reveal once, then forget it
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

  nodes.forEach((node) => observer.observe(node));

  /*
    FAILSAFE. Everything with data-reveal starts at opacity 0 and is only made
    visible by the observer above — so if that observer never reports, the page
    is simply blank, with all the content sitting there invisible. That is the
    worst failure this system can have, and "a visitor sees the words without
    the fade" is a far better outcome than "a visitor sees nothing".

    A working browser reports within a frame or two, so: if nothing has come
    back after a second and a half, stop waiting and show everything.

    The visibility check is the important part. A browser deliberately stops
    reporting intersections for a page it isn't drawing — a background tab, a
    hidden panel — so the countdown only runs while the page is actually on
    screen. Without that, opening the site in a background tab and coming back
    to it later would find every animation already spent.
  */
  let failsafe = null;

  const armFailsafe = () => {
    clearTimeout(failsafe);
    failsafe = setTimeout(() => {
      if (observerHasFired) return;
      console.warn('[reveal] IntersectionObserver never reported — showing everything.');
      observer.disconnect();
      revealAll();
    }, 1500);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') armFailsafe();
  };

  if (document.visibilityState === 'visible') armFailsafe();
  document.addEventListener('visibilitychange', onVisibilityChange);

  registerCleanup(() => {
    clearTimeout(failsafe);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    observer.disconnect();
  });
}


/* ------------------------------------------------------------ Full films --- */

/*
  THE FILMS PLAY ONLY WHILE YOU CAN SEE THEM.

  This is the one behaviour the reference site is explicit about, and it is
  worth understanding: the video carries no `autoplay` attribute at all. It
  starts when its figure scrolls into view and pauses the moment it leaves. A
  film three screens further down the page costs nothing until you reach it,
  which on a phone is the difference between a page that drains a battery and
  one that doesn't.

  Called for every page, not just the homepage, so a film added to any page
  later is handled without anybody having to remember this exists.
*/
function mountFilms() {
  const figures = $$('[data-film]', app);
  if (!figures.length) return;

  figures.forEach((figure) => {
    const video = $('[data-film-video]', figure);
    if (!video) return;

    const poster = video.getAttribute('poster');

    /** Swap the film for its poster still. */
    const showPoster = () => {
      if (!poster || !video.isConnected) return false;
      const image = document.createElement('img');
      image.className = 'film-video';
      image.src = poster;
      image.alt = '';
      image.decoding = 'async';
      video.replaceWith(image);
      return true;
    };

    /*
      The film will not play: a bad URL, a format this browser can't read.
      The poster stands in for it; with no poster, the labelled empty frame
      does, because an invisible failure is the one kind you never fix.
    */
    const giveUp = () => {
      if (!video.isConnected) return;
      if (showPoster()) return;
      const empty = document.createElement('div');
      empty.className = 'film-empty';
      empty.innerHTML = `${icon('film')}<span class="media-empty-label">${esc(figure.dataset.filmLabel ?? 'Add video')}</span>`;
      figure.dataset.hasMedia = 'false';
      video.replaceWith(empty);
    };

    /*
      Reduced motion. A film looping on its own is exactly what that setting
      asks us not to do, so it is never started. If there is a poster it is
      shown instead; if there isn't, the video element stays where it is,
      paused, and shows its own first frame — which is all a poster ever was.
    */
    if (prefersReducedMotion()) {
      showPoster();
      return;
    }

    /* A bad URL fires `error` on the <source>, not on the <video>. */
    video.addEventListener('error', giveUp, { once: true });
    $('source', video)?.addEventListener('error', giveUp, { once: true });

    const play = () => {
      const started = video.play();
      if (started?.catch) started.catch(() => { /* autoplay refused: the still stands */ });
    };

    /* No IntersectionObserver (a very old browser): just play it. Worse for
       the battery, better than a frozen frame. */
    if (!('IntersectionObserver' in window)) {
      play();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!video.isConnected) return;
        if (entry.isIntersecting) play();
        else video.pause();
      });
    }, { threshold: 0.25 });

    observer.observe(figure);

    registerCleanup(() => {
      observer.disconnect();
      video.pause();
    });
  });
}


/* ----------------------------------------------------------- Home mount --- */

function mountHome() {
  mountHeroVideo();
  mountScrollCue();
  /* Both timetables on this page — the strip across the hero and the table
     further down — are marked by the one call. */
  mountPrayerTimes();
  mountClips();
  mountValues();
}

/*
  The hero video.

  Two things can go wrong with a background film, and both leave a black
  rectangle where the hero should be:

    1. the visitor has asked for reduced motion, and a silently looping film is
       exactly what they said they did not want
    2. the URL is wrong, or the file will not play on this browser

  In both cases the poster still is shown instead. The video element is removed
  outright rather than hidden, so nothing is downloaded that will not be seen.
*/
function mountHeroVideo() {
  const hero = $('.hero', app);
  const video = $('.hero-video', hero ?? app);
  if (!hero || !video || video.tagName !== 'VIDEO') return;

  const poster = video.getAttribute('poster');

  /** Swap the <video> for its poster, or for the empty state if there isn't one. */
  const fallBackToPoster = () => {
    if (!video.isConnected) return;
    if (poster) {
      const image = document.createElement('img');
      image.className = 'hero-video';
      image.src = poster;
      image.alt = '';
      image.decoding = 'async';
      video.replaceWith(image);
    } else {
      hero.dataset.hasMedia = 'false';
      hero.dataset.heroTone = 'light';
      video.remove();
    }
  };

  if (prefersReducedMotion()) {
    fallBackToPoster();
    return;
  }

  /* A bad URL fires `error` on the <source>, not on the <video>. */
  video.addEventListener('error', fallBackToPoster, { once: true });
  $('source', video)?.addEventListener('error', fallBackToPoster, { once: true });

  /*
    START IT, BUT NOT YET.

    The markup carries no `autoplay` and preload="none", so nothing of the
    film has been fetched at this point — the poster is doing the work and the
    page has had the bandwidth to itself. Only once the browser reports the
    page fully loaded do we switch preloading on and press play.

    Some browsers refuse autoplay even when muted. play() rejects when that
    happens, and the still is a perfectly good hero, so take it.
  */
  const start = () => {
    if (!video.isConnected) return;
    video.preload = 'auto';
    const started = video.play();
    if (started?.catch) started.catch(fallBackToPoster);
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

/** The "Scroll" cue: clicking it moves the page past the hero. */
function mountScrollCue() {
  const cue = $('[data-scroll-cue]', app);
  const hero = $('.hero', app);
  if (!cue || !hero) return;

  cue.addEventListener('click', () => {
    scrollTo(hero.offsetTop + hero.offsetHeight - HEADER_HEIGHT);
  });
}


/* ------------------------------------------------------------- Values --- */

/*
  Six words, one screen.

  On a desktop the stage is PINNED — it stays put while the page keeps
  scrolling underneath — and the scroll position picks which of the six words
  is showing. GSAP's ScrollTrigger does the pinning and gives us a 0-to-1
  progress figure; all this code does with it is work out an index and write it
  onto the stage as `data-active`.

  That split is deliberate. The crossfade itself is a plain CSS transition
  (0.6s on the signature curve), so the timing is identical to every other
  transition on the site and does not depend on GSAP's easing at all.

  On a phone, none of it runs. A pinned section on a touch screen fights the
  scroll and leaves people feeling stuck, so the six panels simply stack and
  you scroll past them like anything else. gsap.matchMedia() sets this up and,
  just as importantly, tears it down again if the window is resized across the
  breakpoint.
*/
function mountValues() {
  const section = $('[data-values]', app);
  const stage = $('[data-values-stage]', app);
  const track = $('[data-values-track]', app);
  if (!section || !stage || !track) return;

  const dots = $$('.values-progress span', section);

  /**
   * Light the right word, and the right dot. Cheap enough to call every frame.
   *
   * `force` exists for the very first call: the stage is already rendered with
   * data-active="0", so the change check below would skip it and the first dot
   * would never be lit until you scrolled to the second word.
   */
  const setActive = (index, { force = false } = {}) => {
    const clamped = Math.max(0, Math.min(VALUES.length - 1, index));
    if (!force && stage.dataset.active === String(clamped)) return;
    stage.dataset.active = String(clamped);
    dots.forEach((dot, i) => { dot.dataset.on = String(i === clamped); });
  };

  setActive(0, { force: true });

  if (!gsapReady || !motionAllowed()) {
    /*
      No GSAP, a touch screen, or reduced motion: the panels stack. Every word
      has to be visible at once, which is what data-mode="stacked" switches the
      CSS over to.
    */
    section.dataset.mode = 'stacked';
    return;
  }

  const media = window.gsap.matchMedia();

  media.add('(min-width: 861px)', () => {
    section.dataset.mode = 'pinned';

    const trigger = window.ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      /*
        One extra screen of scrolling per word. The stage stays pinned for the
        whole distance, so six words means the page scrolls six screens while
        nothing appears to move except the words themselves.
      */
      end: () => `+=${window.innerHeight * VALUES.length}`,
      pin: stage,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        /*
          progress runs 0→1 across all six. Multiplying by the count and
          flooring gives the index; the 0.999 stops a progress of exactly 1
          from landing one past the end.
        */
        setActive(Math.floor(Math.min(self.progress, 0.999) * VALUES.length));
      },
    });

    /* matchMedia's cleanup: runs when the window crosses back under 861px. */
    return () => {
      trigger.kill();
      section.dataset.mode = 'stacked';
    };
  });

  media.add('(max-width: 860px)', () => {
    section.dataset.mode = 'stacked';
  });

  /*
    Kill everything on navigating away. Without this, a pinned ScrollTrigger
    left behind on a page that no longer exists keeps recalculating against
    stale elements, and the next page's scrolling goes strange.
  */
  registerCleanup(() => media.revert());
}


/* ---------------------------------------------------------------- Clips --- */

/** Open one clip full size. The dialog, its focus trap and Escape are all
    openModal's — this only supplies what goes inside it. */
function openClip(clip) {
  openModal({
    title: clip.title || 'Clip',
    className: 'modal--lightbox',
    body: `
      <div class="lightbox">
        <video class="lightbox-video" controls playsinline preload="auto"
               ${clip.posterUrl ? `poster="${assetUrl(clip.posterUrl, 1600)}"` : ''}>
          <source src="${assetUrl(clip.videoUrl)}">
        </video>
        ${clip.alt ? `<p class="tiny">${esc(clip.alt)}</p>` : ''}
      </div>`,
    onMount(host) {
      /*
        Start it. Somebody clicked a play mark to get here, so this is a
        reaction to a real gesture and not an autoplay — but a browser can
        still refuse, and then the controls are right there.
      */
      const video = $('.lightbox-video', host);
      const started = video?.play();
      if (started?.catch) started.catch(() => { /* they can press play */ });
    },
  });
}

function mountClips() {
  const grid = $('[data-clips]', app);
  if (!grid) return;

  const clips = state.clips ?? [];

  $$('[data-clip]', grid).forEach((button) => {
    button.addEventListener('click', () => {
      const clip = clips.find((record) => record.id === button.dataset.clip);
      if (clip?.videoUrl) openClip(clip);
    });
  });
}


/* ------------------------------------------------------- Service rows --- */

/*
  THE PICTURE THAT TRAILS THE CURSOR.

  Two things are kept completely separate here, which is what makes the whole
  interaction tractable:

    1. WHICH ROW IS LIT is a class. `is-active is-hover` goes on the row on
       mouseenter and comes off on mouseleave, and every visual change — the
       black band, the white text, the picture appearing — is a CSS transition
       keyed to that class. None of it is animated by this code. That is also
       why moving from one row to the next crossfades on its own: the outgoing
       row starts its 0.4s fade out at the same moment the incoming one starts
       its 0.4s fade in.

    2. WHERE THE PICTURE IS is a number, moved a little closer to the cursor on
       every frame. `current += (target - current) * 0.12` is the whole of it.
       Twelve per cent of the remaining distance per frame means the picture
       never quite catches up, which is what makes it trail rather than stick.

  The position is SHARED by every row and is never reset. Sliding from one row
  to the next therefore keeps the picture exactly where it was and carries on
  from there, so the two pictures crossfade in place instead of one jumping in
  from the left.

  None of this exists below 768px. Not the listeners, not the loop — the rows
  are stacked cards there with their pictures already showing, and there is no
  pointer to follow anyway.
*/

/* How much of the remaining distance the picture covers each frame. Lower is
   heavier: 0.12 is roughly a fifth of a second to arrive. */
const ROW_LERP = 0.12;

/* How long the loop keeps running after the pointer leaves the table — long
   enough for the picture to finish fading out while still drifting. */
const ROW_COAST_MS = 600;

function mountServiceRows() {
  const list = $('[data-rows]', app);
  if (!list) return;

  const rows = $$('[data-row]', list);
  if (!rows.length) return;

  /*
    768px is the line in the spec. Below it the rows are cards with the
    picture already showing, so there is nothing to reveal and this whole
    function is skipped — and so is every listener it would have attached.
  */
  if (!window.matchMedia('(min-width: 768px)').matches) return;

  const figures = rows.map((row) => $('[data-row-figure]', row));
  const cleanups = [];

  /* ------------------------------------------------------- Keyboard ----- */

  /*
    Tab onto a row and it lights up exactly as hovering does — same black
    band, same white text, same 0.4s picture fade, because all three hang off
    the same `is-active` class.

    What it does NOT get is `is-hover`, and it does not start the animation
    loop: there is no cursor to trail, so the picture is simply placed. It
    goes at 62% of the row, which is where the eye is by the time it has read
    the name and reached the type at the far end.
  */
  const PARK = 0.62;

  rows.forEach((row, index) => {
    const figure = figures[index];

    const onFocus = () => {
      if (figure) {
        const box = row.getBoundingClientRect();
        const width = figure.offsetWidth || box.width * 0.18;
        figure.style.left = `${Math.max(0, Math.min(box.width - width, box.width * PARK - width / 2))}px`;
      }
      row.classList.add('is-active');
    };
    const onBlur = () => row.classList.remove('is-active');

    row.addEventListener('focus', onFocus);
    row.addEventListener('blur', onBlur);
    cleanups.push(() => {
      row.removeEventListener('focus', onFocus);
      row.removeEventListener('blur', onBlur);
    });
  });

  /* -------------------------------------------------------- Pointer ----- */

  /*
    Everything below is the cursor-tracking half, and it is gated separately.
    `hover: hover` with `pointer: fine` catches the case the width test can't:
    a large touch screen, which has the wide layout but no cursor to follow.
    A keyboard user on that device still gets everything above.
  */
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || prefersReducedMotion()) {
    registerCleanup(() => cleanups.forEach((fn) => fn()));
    return;
  }

  let target = null;     // where the cursor is, measured from the row's left edge
  let current = null;    // where the picture actually is
  let activeRow = null;
  let frame = null;
  let coastUntil = 0;

  const step = () => {
    frame = requestAnimationFrame(step);

    if (target != null) {
      /* The first frame places the picture rather than animating to it, so it
         appears where the cursor is instead of flying in from the left. */
      if (current == null) current = target;
      current += (target - current) * ROW_LERP;

      const left = `${current}px`;
      figures.forEach((figure) => { if (figure) figure.style.left = left; });
    }

    /* Nothing lit and the last picture has finished fading: stop burning
       frames until the pointer comes back. */
    if (!activeRow && performance.now() > coastUntil) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };

  const startLoop = () => {
    if (frame) return;
    coastUntil = performance.now() + ROW_COAST_MS;
    frame = requestAnimationFrame(step);
  };

  rows.forEach((row, index) => {
    const figure = figures[index];

    const move = (event) => {
      const box = row.getBoundingClientRect();
      const width = figure?.offsetWidth || box.width * 0.18;
      /* Centred on the cursor, and clamped so the picture can never hang off
         either end of the row. */
      target = Math.max(0, Math.min(box.width - width, event.clientX - box.left - width / 2));
    };

    const enter = (event) => {
      activeRow = row;
      move(event);
      row.classList.add('is-active', 'is-hover');
      startLoop();
    };

    const leave = () => {
      row.classList.remove('is-active', 'is-hover');
      if (activeRow !== row) return;
      activeRow = null;
      coastUntil = performance.now() + ROW_COAST_MS;
    };

    row.addEventListener('mouseenter', enter);
    row.addEventListener('mousemove', move);
    row.addEventListener('mouseleave', leave);

    cleanups.push(() => {
      row.removeEventListener('mouseenter', enter);
      row.removeEventListener('mousemove', move);
      row.removeEventListener('mouseleave', leave);
    });
  });

  registerCleanup(() => {
    cleanups.forEach((fn) => fn());
    if (frame) cancelAnimationFrame(frame);
  });
}

/** Everything /services needs of its own. */
function mountServices() {
  mountServiceRows();
}


/* ==================================================== Motion foundation === */

/*
  Three things live here, and all three are switched off in the same two
  situations: on a touch screen, and when the visitor has asked their device
  for reduced motion.

    Lenis   — smooth scrolling
    GSAP    — the animation engine, registered and ready but not yet animating
    Cursor  — the small blue circle that replaces the arrow

  `prefersReducedMotion()` is checked live rather than cached, because someone
  can change the setting without reloading.
*/

/** True on a phone or tablet: no hover, and a finger rather than a pointer. */
const isTouchDevice = () =>
  window.matchMedia('(hover: none)').matches ||
  window.matchMedia('(pointer: coarse)').matches;

/** The one gate all three behaviours pass through. */
const motionAllowed = () => !prefersReducedMotion() && !isTouchDevice();


/* ------------------------------------------------------------- GSAP ------ */

/*
  Registered once, at load. Nothing is animated yet — this is the foundation
  step, and the first scroll-linked animation will be written against it.

  ScrollTrigger has to be registered with GSAP before it can be used, and doing
  it here means no section ever has to remember to.
*/
let gsapReady = false;

/*
  THE LIBRARIES ARE FETCHED ONLY IF THEY WILL BE USED.

  Lenis, GSAP and ScrollTrigger come to 117 KiB, and every one of them exists
  for the same visitor: somebody on a desktop, with a mouse, who has not asked
  their device to reduce motion. On a phone Lenis is deliberately off (the
  phone's own momentum scrolling is better) and the one thing ScrollTrigger
  pins is the desktop values — so all three used to be downloaded, parsed
  and never called, on exactly the device that can least afford it.

  motionAllowed() is the same gate the rest of the motion code uses, so there
  is no second rule here to keep in step with the first.

  If a file fails to load, nothing throws: setupGsap() and mountLenis() both
  already check for their library before touching it, because a missing vendor
  file was always a possibility. The site loses smooth scrolling and a pinned
  section; it does not lose anything a reader needs.
*/
function loadScript(src) {
  return new Promise((resolve) => {
    const tag = document.createElement('script');
    tag.src = src;
    tag.onload = resolve;
    tag.onerror = () => {
      console.warn(`[motion] ${src} did not load. Animation is reduced; the site still works.`);
      resolve();
    };
    document.head.appendChild(tag);
  });
}

async function loadMotionLibraries() {
  if (!motionAllowed()) return;

  /* Lenis and GSAP are independent, so they go together. ScrollTrigger is a
     GSAP plugin and registers itself against it, so it waits. */
  await Promise.all([
    loadScript('/vendor/lenis.min.js'),
    loadScript('/vendor/gsap.min.js'),
  ]);
  await loadScript('/vendor/ScrollTrigger.min.js');
}

function setupGsap() {
  if (!window.gsap || !window.ScrollTrigger) {
    /* On a phone this is the expected state, not a fault — the libraries were
       never asked for. Only say something when they SHOULD have been there. */
    if (motionAllowed()) {
      console.warn('[motion] GSAP did not load — check /vendor. Animation is off; the site still works.');
    }
    return;
  }
  window.gsap.registerPlugin(window.ScrollTrigger);
  gsapReady = true;
}


/* ------------------------------------------------------------ Lenis ------ */

/*
  Lenis intercepts the wheel and animates the scroll position, which is what
  gives the page its weight. We do NOT hand-roll this — a hand-rolled smooth
  scroll breaks anchor links, the scrollbar, and keyboard paging.

  It is deliberately absent on touch: phones already have momentum scrolling
  that feels better than anything we would add, and Lenis fights it.
*/
let lenis = null;
let lenisTick = null;

function mountLenis() {
  if (lenis || !motionAllowed() || !window.Lenis) return;

  lenis = new window.Lenis();   // defaults are the right starting point

  if (gsapReady) {
    /*
      The canonical GSAP + Lenis wiring, and the order matters:
        1. tell ScrollTrigger to recalculate whenever Lenis scrolls
        2. drive Lenis from GSAP's ticker, so both run on ONE animation loop
           rather than two competing ones
        3. turn off lag smoothing, which would otherwise make GSAP skip time
           after a slow frame and jump the scroll
    */
    lenis.on('scroll', window.ScrollTrigger.update);
    lenisTick = (time) => lenis.raf(time * 1000);   // GSAP gives seconds, Lenis wants ms
    window.gsap.ticker.add(lenisTick);
    window.gsap.ticker.lagSmoothing(0);
  } else {
    // No GSAP: run Lenis on its own animation loop instead.
    const raf = (time) => {
      lenis?.raf(time);
      if (lenis) lenisTick = requestAnimationFrame(raf);
    };
    lenisTick = requestAnimationFrame(raf);
  }
}

function destroyLenis() {
  if (!lenis) return;
  if (gsapReady && typeof lenisTick === 'function') window.gsap.ticker.remove(lenisTick);
  else if (typeof lenisTick === 'number') cancelAnimationFrame(lenisTick);
  lenis.destroy();
  lenis = null;
  lenisTick = null;
}

/** Scroll to a position or element. Uses Lenis when it's running, else native. */
function scrollTo(target, { immediate = false } = {}) {
  if (lenis) return lenis.scrollTo(target, { immediate });
  const behavior = immediate || prefersReducedMotion() ? 'auto' : 'smooth';
  if (typeof target === 'number') window.scrollTo({ top: target, behavior });
  else target?.scrollIntoView({ behavior });
}


/* ----------------------------------------------------------- Cursor ------ */

/*
  A 16px circle that chases the pointer. Our addition, not on the reference.

  How it moves: on every animation frame it travels 15% of the remaining
  distance to the mouse. That is a "lerp" — linear interpolation — and it is
  what produces the slight lag that makes the circle feel like an object with
  weight rather than a sprite glued to the pointer. A higher number is snappier,
  a lower one is floatier. The value is --cursor-lerp in styles.css.

  Two states:
    - over a, button or [data-cursor-grow] it scales up (--cursor-grow)
    - over anything inside [data-cursor="invert"] it turns white, so it stays
      visible on a dark band

  The element is never created at all on touch or under reduced motion, so
  there is nothing to hide and the ordinary arrow is left alone.
*/
let cursorTeardown = null;

function mountCursor() {
  if (cursorTeardown || !motionAllowed()) return;

  const styles = getComputedStyle(document.documentElement);
  const LERP = Number(styles.getPropertyValue('--cursor-lerp')) || 0.15;
  const GROW = Number(styles.getPropertyValue('--cursor-grow')) || 2.5;

  const dot = document.createElement('div');
  dot.className = 'cursor';
  dot.setAttribute('aria-hidden', 'true');
  dot.dataset.ready = 'false';
  dot.dataset.invert = 'false';
  document.body.append(dot);
  document.body.dataset.cursor = 'on';

  // Where the mouse is, and where the circle currently is. They chase.
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let x = mouseX;
  let y = mouseY;

  let scale = 1;
  let targetScale = 1;
  let frame = null;

  const onMove = (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;

    if (dot.dataset.ready === 'false') {
      // First move: jump straight there rather than flying in from the corner.
      x = mouseX;
      y = mouseY;
      dot.dataset.ready = 'true';
    }

    /*
      What is under the pointer right now. elementFromPoint is used rather than
      mouseover/mouseout because the circle has to react to the area it is
      OVER, including areas with no event listeners of their own — and because
      closest() then walks up the tree for us, so marking a whole dark band
      with data-cursor="invert" covers everything inside it.
    */
    const under = document.elementFromPoint(mouseX, mouseY);
    dot.dataset.invert = String(Boolean(under?.closest('[data-cursor="invert"]')));
    targetScale = under?.closest('a, button, [data-cursor-grow]') ? GROW : 1;
  };

  const onLeave = () => { dot.dataset.ready = 'false'; };
  const onEnter = () => { if (dot.isConnected) dot.dataset.ready = 'true'; };

  const tick = () => {
    // Move 15% of the way there, every frame.
    x += (mouseX - x) * LERP;
    y += (mouseY - y) * LERP;
    scale += (targetScale - scale) * LERP;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    frame = requestAnimationFrame(tick);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  document.addEventListener('pointerenter', onEnter);
  frame = requestAnimationFrame(tick);

  cursorTeardown = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('pointerenter', onEnter);
    dot.remove();
    delete document.body.dataset.cursor;
    cursorTeardown = null;
  };
}

function destroyCursor() {
  cursorTeardown?.();
}


/* --------------------------------------------- Responding to a change ---- */

/*
  Someone can turn "reduce motion" on, or plug in a mouse, without reloading.
  When that happens, start or stop all three accordingly.
*/
function watchMotionPreference() {
  const queries = [
    window.matchMedia('(prefers-reduced-motion: reduce)'),
    window.matchMedia('(hover: none)'),
    window.matchMedia('(pointer: coarse)'),
  ];

  const sync = () => {
    if (motionAllowed()) {
      mountLenis();
      mountCursor();
    } else {
      destroyLenis();
      destroyCursor();
    }
  };

  queries.forEach((query) => query.addEventListener('change', sync));
}


/* ========================================================= Edit mode ===== */

/*
  Everything below only ever runs behind a valid login cookie. The edit controls
  are not merely hidden from logged-out visitors — they are never put on the
  page at all, and every save is re-authorised on the server anyway.
*/

function setAuthed(authed) {
  state.authed = authed;
  /* Named `edit-mode`, NOT `edit`: `data-edit` is what an edit chip uses, and
     a `data-edit` on <body> would be picked up by the chip selector below. */
  document.body.dataset.editMode = String(authed);
  if (!authed) {
    state.copyEditing = false;
    document.body.dataset.copyEditing = 'false';
    finishCopyEdit({ save: false });
  }
  renderEditBar();
}

/** The floating bar along the bottom, visible only once logged in. */
function renderEditBar() {
  $('.edit-bar')?.remove();
  if (!state.authed) return;

  const bar = document.createElement('div');
  bar.className = 'edit-bar';
  bar.innerHTML = `
    <span>Edit mode</span>
    <button type="button" class="btn btn--sm" data-copy-toggle aria-pressed="${state.copyEditing}">
      ${icon('pencil')}<span>Edit text</span>
    </button>
    <button type="button" class="icon-btn" data-logout aria-label="Log out of edit mode">
      ${icon('logout')}
    </button>`;

  bar.querySelector('[data-copy-toggle]').addEventListener('click', (event) => {
    setCopyEditing(!state.copyEditing);
    event.currentTarget.setAttribute('aria-pressed', String(state.copyEditing));
  });

  bar.querySelector('[data-logout]').addEventListener('click', async () => {
    await api.del('/api/auth');
    setAuthed(false);
    toast('Logged out of edit mode.');
    renderRoute(window.location.pathname, { restoreScroll: true });
  });

  document.body.append(bar);
}

/* The "Web dev edit" button in the footer. */
document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-webdev]')) return;
  if (state.authed) {
    toast('Already in edit mode — look for the bar at the bottom.');
    return;
  }
  openPasswordPrompt();
});

function openPasswordPrompt() {
  openModal({
    title: 'Web dev edit',
    subtitle: 'Enter the admin password to unlock editing.',
    body: `
      <form class="editor-form" id="pw-form">
        <div class="field">
          <label for="pw">Password</label>
          <input id="pw" name="password" type="password" autocomplete="current-password" required>
        </div>
        <p class="form-status" role="status" aria-live="polite"></p>
        <div class="editor-actions">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">Unlock</button>
        </div>
      </form>`,
    onMount(host, close) {
      const form = $('#pw-form', host);
      const status = $('.form-status', form);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.dataset.state = '';
        status.textContent = 'Checking…';
        try {
          await api.post('/api/auth', { password: form.password.value });
          close();
          setAuthed(true);
          toast('Edit mode unlocked.');
          // Re-render so the edit chips appear.
          renderRoute(window.location.pathname, { restoreScroll: true });
        } catch (error) {
          status.dataset.state = 'error';
          status.textContent = error.message;
        }
      });
    },
  });
}


/* ------------------------------------------------------- Text editing --- */

/*
  "Edit text" mode. Every [data-copy] element becomes clickable: clicking it
  edits it in place instead of doing whatever it normally does (following a
  link, opening the menu). Enter saves, Shift+Enter adds a line break, Escape
  cancels, and Reset removes the override so the original wording returns.
*/
let activeCopyEdit = null;

function setCopyEditing(on) {
  state.copyEditing = Boolean(on && state.authed);
  document.body.dataset.copyEditing = String(state.copyEditing);
  if (!state.copyEditing) finishCopyEdit({ save: false });
  toast(state.copyEditing
    ? 'Text editing on — click any heading, line or label to change it.'
    : 'Text editing off.');
}

/*
  Capture phase (the `true` at the end), so this runs BEFORE any other click
  handler on the page — otherwise clicking an editable nav link would navigate
  away instead of letting you edit it.
*/
document.addEventListener('click', (event) => {
  if (!state.copyEditing) return;
  if (event.target.closest('.copy-toolbar, .edit-bar, .modal-backdrop, .toast-region')) return;
  const node = event.target.closest('[data-copy]');
  if (!node) return;
  event.preventDefault();
  event.stopPropagation();
  if (activeCopyEdit?.node !== node) startCopyEdit(node);
}, true);

/**
 * The text as a person actually sees it: source indentation collapsed the way
 * HTML renders it, <br> kept as a real line break.
 *
 * (innerText is unusable here — it applies text-transform, so an uppercase
 * heading would be saved in capitals and could never be un-capitalised.)
 */
function readEditableText(node) {
  const clone = node.cloneNode(true);
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    text.nodeValue = text.nodeValue.replace(/\s+/g, ' ');
  }
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  clone.querySelectorAll('div, p').forEach((block) => block.prepend('\n'));
  return clone.textContent
    .split('\n').map((line) => line.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Keep the little Save/Reset bar beside whatever is being edited. */
function positionCopyToolbar(toolbar, node) {
  const rect = node.getBoundingClientRect();
  const below = rect.bottom + 10;
  const top = below + toolbar.offsetHeight > window.innerHeight - 8
    ? Math.max(8, rect.top - toolbar.offsetHeight - 10)   // no room below: go above
    : below;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - toolbar.offsetWidth - 8);
  toolbar.style.top = `${Math.round(top)}px`;
  toolbar.style.left = `${Math.round(left)}px`;
}

function startCopyEdit(node) {
  finishCopyEdit({ save: false });
  const key = node.dataset.copy;
  const original = node.innerHTML;

  node.classList.add('copy-editing');
  // plaintext-only keeps pasted formatting out; fall back where unsupported.
  node.setAttribute('contenteditable', 'plaintext-only');
  if (node.contentEditable !== 'plaintext-only') node.setAttribute('contenteditable', 'true');
  node.setAttribute('spellcheck', 'true');
  node.focus();

  // Select everything, so typing replaces it.
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  const toolbar = document.createElement('div');
  toolbar.className = 'copy-toolbar';
  toolbar.innerHTML = `
    <span class="copy-toolbar-key" title="${esc(key)}">${esc(key)}</span>
    <button type="button" class="btn btn--sm" data-copy-cancel>Cancel</button>
    <button type="button" class="btn btn--sm" data-copy-reset ${state.copy?.[key] ? '' : 'disabled'}
            title="Go back to the original wording">Reset</button>
    <button type="button" class="btn btn--sm btn--primary" data-copy-save>Save</button>`;
  document.body.append(toolbar);
  positionCopyToolbar(toolbar, node);

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finishCopyEdit({ save: false });
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      finishCopyEdit({ save: true });
    }
  };
  const onPaste = (event) => {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '');
  };
  const reposition = () => positionCopyToolbar(toolbar, node);

  node.addEventListener('keydown', onKey);
  node.addEventListener('paste', onPaste);
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition);
  toolbar.querySelector('[data-copy-cancel]').addEventListener('click', () => finishCopyEdit({ save: false }));
  toolbar.querySelector('[data-copy-save]').addEventListener('click', () => finishCopyEdit({ save: true }));
  toolbar.querySelector('[data-copy-reset]').addEventListener('click', () => resetCopy(key));

  activeCopyEdit = {
    node,
    key,
    original,
    teardown() {
      node.removeEventListener('keydown', onKey);
      node.removeEventListener('paste', onPaste);
      window.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
      node.removeAttribute('contenteditable');
      node.removeAttribute('spellcheck');
      node.classList.remove('copy-editing');
      toolbar.remove();
    },
  };
}

async function finishCopyEdit({ save }) {
  const edit = activeCopyEdit;
  if (!edit) return;
  activeCopyEdit = null;
  const text = readEditableText(edit.node);
  edit.teardown();

  if (!save) {
    edit.node.innerHTML = edit.original;
    return;
  }
  if (!text) {
    edit.node.innerHTML = edit.original;
    toast('Text can’t be empty — use Reset to go back to the original.', 'error');
    return;
  }
  try {
    const { copy } = await api.put('/api/copy', { copy: { [edit.key]: text } });
    state.copy = copy;
    applyCopy();   // updates every place that key appears, e.g. a nav label
    toast('Text saved.');
  } catch (error) {
    edit.node.innerHTML = edit.original;
    toast(error.message, 'error');
  }
}

async function resetCopy(key) {
  finishCopyEdit({ save: false });
  try {
    const { copy } = await api.put('/api/copy', { copy: { [key]: null } });
    state.copy = copy;
    toast('Back to the original text.');
    // The original wording lives in the markup, so re-render to bring it back.
    await renderRoute(window.location.pathname, { restoreScroll: true });
  } catch (error) {
    toast(error.message, 'error');
  }
}


/* ---------------------------------------------------- Field definitions --- */

/*
  A small schema-driven form builder, ported from the Advatar site. It is the
  browser-side partner of lib/collection.js, and every editor on the site is
  built out of it: events, services, clips, the two full-width films, the
  weekly rhythm, the contact details and the donation links.

  A field is { name, label, type, hint? }, where type is one of:
    text | number | textarea | checkbox | select | lines | rows

  `lines` is a textarea where each line is one value.
  `rows`  is a textarea where each line is "col1 | col2 | col3" — which keeps
          repeating structures editable without building drag-and-drop.
*/

function fieldHtml(field, value) {
  const id = `f-${field.name.replace(/\W/g, '-')}`;
  const label = `<label for="${id}">${esc(field.label)}</label>`;
  const hint = field.hint ? `<p class="tiny">${esc(field.hint)}</p>` : '';

  switch (field.type) {
    case 'textarea':
      return `<div class="field">${label}<textarea id="${id}" name="${esc(field.name)}">${esc(value ?? '')}</textarea>${hint}</div>`;

    case 'checkbox':
      return `<div class="field" style="grid-auto-flow:column;justify-content:start;align-items:center;gap:10px">
                <input id="${id}" name="${esc(field.name)}" type="checkbox" ${value ? 'checked' : ''}
                       style="width:20px;min-height:20px;height:20px">
                ${label}
              </div>`;

    case 'select':
      return `<div class="field">${label}
                <select id="${id}" name="${esc(field.name)}">
                  ${field.options.map((option) =>
                    `<option value="${esc(option)}" ${option === value ? 'selected' : ''}>${esc(option)}</option>`).join('')}
                </select>${hint}
              </div>`;

    case 'lines': {
      const text = Array.isArray(value) ? value.join('\n') : '';
      return `<div class="field">${label}<textarea id="${id}" name="${esc(field.name)}">${esc(text)}</textarea>
                <p class="tiny">${esc(field.hint || 'One per line.')}</p></div>`;
    }

    case 'rows': {
      const keys = field.columns.map((column) => column.key);
      const text = (Array.isArray(value) ? value : [])
        .map((row) => keys.map((key) => row?.[key] ?? '').join(' | '))
        .join('\n');
      return `<div class="field">${label}<textarea id="${id}" name="${esc(field.name)}" rows="6">${esc(text)}</textarea>
                <p class="tiny">One per line, columns separated by <code>|</code> —
                  ${esc(field.columns.map((column) => column.label).join(' | '))}</p></div>`;
    }

    default: {
      /*
        `suggest` offers a list WITHOUT limiting you to it — a datalist, not a
        dropdown. Typing something new is still allowed, and next time it will
        be one of the suggestions. That is how categories stay consistent
        without being locked to a list in the code.
      */
      const listId = field.suggest ? `${id}-suggest` : '';
      const options = field.suggest
        ? `<datalist id="${listId}">${field.suggest().map((option) => `<option value="${esc(option)}"></option>`).join('')}</datalist>`
        : '';

      return `<div class="field">${label}
                <input id="${id}" name="${esc(field.name)}" type="${field.type === 'number' ? 'number' : 'text'}"
                       value="${esc(value ?? '')}" ${listId ? `list="${listId}"` : ''}
                       ${field.placeholder ? `placeholder="${esc(field.placeholder)}"` : ''}>
                ${options}${hint}</div>`;
    }
  }
}

/** Pull one typed value back out of a submitted form. */
function fieldValue(form, field) {
  const input = form.elements[field.name];
  if (!input) return undefined;

  switch (field.type) {
    case 'checkbox':
      return input.checked;

    case 'number': {
      const num = Number(input.value);
      return Number.isFinite(num) ? num : undefined;
    }

    case 'lines':
      return input.value.split('\n').map((line) => line.trim()).filter(Boolean);

    case 'rows':
      return input.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const cells = line.split('|').map((cell) => cell.trim());
          return Object.fromEntries(field.columns.map((column, index) => [column.key, cells[index] ?? '']));
        });

    default:
      return input.value.trim();
  }
}

const buildForm = (fields, record) =>
  `<div class="editor-grid">${fields.map((field) =>
    fieldHtml(field, getPath(record ?? {}, field.name))).join('')}</div>`;

const readForm = (form, fields) =>
  fields.reduce((acc, field) => {
    const value = fieldValue(form, field);
    if (value !== undefined) setPath(acc, field.name, value);
    return acc;
  }, {});


/* ------------------------------------------------- Collection manager ---- */

/*
  Generic add / edit / delete for any list-shaped collection served by
  lib/collection.js — events, services and clips all go through this one
  function. With `reorder` on it also grows up and down arrows.
*/

function openCollectionManager({ title, endpoint, cacheKey, fields, label, subtitle, reorder = false }) {
  /*
    With `reorder` on, the list is shown in the order it appears on the site
    and each row gets an up and a down arrow. Moving one swaps it with its
    neighbour and renumbers the whole list from 1, which is far easier to think
    about than editing `order` numbers by hand — and it means the numbers can
    never end up with two the same.
  */
  const items = reorder
    ? [...(state[cacheKey] ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : state[cacheKey] ?? [];

  const arrows = (item, index) => reorder ? `
    <button type="button" class="icon-btn" data-move-item="${esc(item.id)}" data-move="-1"
            ${index === 0 ? 'disabled' : ''}
            aria-label="Move ${esc(label(item))} up">${icon('arrowUp')}</button>
    <button type="button" class="icon-btn" data-move-item="${esc(item.id)}" data-move="1"
            ${index === items.length - 1 ? 'disabled' : ''}
            aria-label="Move ${esc(label(item))} down">${icon('arrowDown')}</button>` : '';

  const rows = items.length
    ? `<ul class="admin-list">${items.map((item, index) => `
        <li>
          <div class="admin-row-head">
            <strong>${esc(label(item))}</strong>
            <span style="display:flex;gap:6px">
              ${arrows(item, index)}
              <button type="button" class="icon-btn" data-edit-item="${esc(item.id)}"
                      aria-label="Edit ${esc(label(item))}">${icon('pencil')}</button>
              <button type="button" class="icon-btn" data-del-item="${esc(item.id)}"
                      aria-label="Delete ${esc(label(item))}">${icon('trash')}</button>
            </span>
          </div>
        </li>`).join('')}</ul>`
    : `<p class="tiny">Nothing here yet.</p>`;

  openModal({
    title,
    subtitle,
    body: `
      <div class="stack-2">
        ${rows}
        <div class="editor-actions">
          <button type="button" class="btn btn--primary" data-add>${icon('plus')} Add new</button>
        </div>
      </div>`,
    onMount(host) {
      const refresh = async () => {
        invalidate(cacheKey);
        await load(cacheKey);
        closeModal();
        await renderRoute(window.location.pathname, { restoreScroll: true });
        openCollectionManager({ title, endpoint, cacheKey, fields, label, subtitle });
      };

      $('[data-add]', host).addEventListener('click', () =>
        openRecordEditor({ title: `New — ${title}`, fields, record: {}, endpoint, method: 'post', onDone: refresh }));

      /* Swap with the neighbour, renumber everything from 1, and send the
         whole list back in one go — which is what the PUT with { items } on
         lib/collection.js is for. */
      $$('[data-move-item]', host).forEach((button) => {
        button.addEventListener('click', async () => {
          const from = items.findIndex((item) => item.id === button.dataset.moveItem);
          const to = from + Number(button.dataset.move);
          if (from < 0 || to < 0 || to >= items.length) return;

          const next = [...items];
          [next[from], next[to]] = [next[to], next[from]];

          try {
            await api.put(endpoint, { items: next.map((item, index) => ({ ...item, order: index + 1 })) });
            await refresh();
          } catch (error) {
            toast(error.message, 'error');
          }
        });
      });

      $$('[data-edit-item]', host).forEach((button) => {
        button.addEventListener('click', () => {
          const record = items.find((item) => item.id === button.dataset.editItem);
          openRecordEditor({ title: `Edit — ${label(record)}`, fields, record, endpoint, method: 'put', onDone: refresh });
        });
      });

      $$('[data-del-item]', host).forEach((button) => {
        button.addEventListener('click', async () => {
          const record = items.find((item) => item.id === button.dataset.delItem);
          if (!window.confirm(`Delete "${label(record)}"? This cannot be undone.`)) return;
          try {
            await api.del(`${endpoint}?id=${encodeURIComponent(record.id)}`);
            toast('Deleted.');
            await refresh();
          } catch (error) {
            toast(error.message, 'error');
          }
        });
      });
    },
  });
}

function openRecordEditor({ title, fields, record, endpoint, method, onDone }) {
  openModal({
    title,
    body: `
      <form class="editor-form" id="record-form">
        ${buildForm(fields, record)}
        <p class="form-status" role="status" aria-live="polite"></p>
        <div class="editor-actions">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>`,
    onMount(host) {
      const form = $('#record-form', host);
      const status = $('.form-status', form);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.dataset.state = '';
        status.textContent = 'Saving…';
        const payload = { ...readForm(form, fields) };
        if (record?.id) payload.id = record.id;

        try {
          await api[method](endpoint, payload);
          toast('Saved.');
          await onDone();
        } catch (error) {
          status.dataset.state = 'error';
          status.textContent = error.message;
          toast(error.message, 'error');
        }
      });
    },
  });
}


/**
 * Editor for the page titles, the descriptions and the sharing picture.
 *
 * The only form on the site that writes to two places at once: the titles and
 * descriptions are text overrides (/api/copy) and the sharing picture is a
 * site setting (/api/settings). They are one form because they are one job.
 */
function openSeoEditor() {
  /*
    The form's boxes are nested — `seo.home.title` — while the copy store is
    flat, with "seo.home.title" as a single key. So the record is built in the
    nested shape to fill the boxes in, and flattened again on the way out.
  */
  const record = {
    settings: { shareImageUrl: state.settings?.shareImageUrl ?? '' },
    seo: Object.fromEntries(INDEXABLE_ROUTES.map((route) => [route.key, {
      title: state.copy?.[`seo.${route.key}.title`] ?? '',
      description: state.copy?.[`seo.${route.key}.description`] ?? '',
    }])),
  };

  openModal({
    title: 'Page titles & descriptions',
    subtitle: 'What Google shows, and what comes up when somebody pastes a link into WhatsApp. Every box can be left empty — the wording written into the site is used instead.',
    body: `
      <form class="editor-form" id="seo-form">
        ${buildForm(SEO_FIELDS, record)}
        <p class="form-status" role="status" aria-live="polite"></p>
        <div class="editor-actions">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>`,
    onMount(host) {
      const form = $('#seo-form', host);
      const status = $('.form-status', form);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.dataset.state = '';
        status.textContent = 'Saving…';

        const value = readForm(form, SEO_FIELDS);

        /* An empty box means "go back to the wording written into the site",
           and null is how the copy store is told to forget an override. */
        const changes = {};
        for (const route of INDEXABLE_ROUTES) {
          for (const part of ['title', 'description']) {
            changes[`seo.${route.key}.${part}`] = value.seo?.[route.key]?.[part] || null;
          }
        }

        try {
          /*
            One after the other, NOT Promise.all.

            These are the only two places on the site that write to two stores
            from one form, and sent together they raced: both reads saw the
            same file, both wrote their own copy of it back, and the second
            one landed on top of the first. Sequential costs one round trip
            nobody will notice.
          */
          const { copy } = await api.put('/api/copy', { copy: changes });
          const { settings } = await api.put('/api/settings', {
            shareImageUrl: value.settings?.shareImageUrl ?? '',
          });
          state.copy = copy;
          state.settings = settings;
          closeModal();
          toast('Saved.');
          await renderRoute(window.location.pathname, { restoreScroll: true });
        } catch (error) {
          status.dataset.state = 'error';
          status.textContent = error.message;
          toast(error.message, 'error');
        }
      });
    },
  });
}


/**
 * Editor for the single settings object — the contact email and social links.
 * Unlike a collection there is only one record, so there is no list and no
 * add/delete: just a form that merges its changes in.
 */
function openSettingsEditor({ title, subtitle, fields }) {
  openModal({
    title,
    subtitle,
    body: `
      <form class="editor-form" id="settings-form">
        ${buildForm(fields, state.settings ?? {})}
        <p class="form-status" role="status" aria-live="polite"></p>
        <div class="editor-actions">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>`,
    onMount(host) {
      const form = $('#settings-form', host);
      const status = $('.form-status', form);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.dataset.state = '';
        status.textContent = 'Saving…';
        try {
          const { settings } = await api.put('/api/settings', readForm(form, fields));
          state.settings = settings;

          /*
            The prayer times are not IN settings — they are fetched from
            Mawaqit and cached — but two of the settings decide which page is
            read and whether it is read at all. So the cached times are thrown
            away after any settings save and fetched again on the next render.
            Without this, changing the Mawaqit page appears to do nothing
            until a reload.
          */
          invalidate('prayer');
          await load('prayer').catch(() => { state.prayer = null; });

          closeModal();
          toast('Saved.');
          await renderRoute(window.location.pathname, { restoreScroll: true });
        } catch (error) {
          status.dataset.state = 'error';
          status.textContent = error.message;
          toast(error.message, 'error');
        }
      });
    },
  });
}


/* -------------------------------------------------------- Edit schemas --- */

/*
  Every image field takes the same thing, so the wording is written once. A
  Cloudinary URL is resized and re-encoded on delivery — see assetUrl at the
  top of this file — so there is nothing to prepare before pasting one in.
*/
/*
  ALT TEXT — what to write in it.

  One sentence describing what is IN the picture, for someone who cannot see
  it: "The main prayer hall with the carpet lines running towards the mihrab",
  not "photo" and not "Taiba mosque". If the picture is purely decorative,
  leaving it empty is the correct answer, not a failure.

  There is one of these beside every image URL on the site.
*/
const ALT_HINT = 'One sentence describing what is in the picture, for anyone who cannot see it. Leave blank only if it is purely decorative.';

const IMAGE_HINT = 'Paste a Cloudinary URL (or any image link). Cloudinary images are resized and compressed for the web automatically.';

const EVENT_FIELDS = [
  { name: 'title', label: 'Event name', type: 'text' },
  {
    name: 'category', label: 'Category', type: 'text',
    suggest: eventCategories,
    hint: 'The small blue label on the card. Pick one of the suggestions or type a new one — it becomes a suggestion for next time. Leave blank for just "Event".',
  },
  {
    name: 'date', label: 'Date', type: 'text', placeholder: 'YYYY-MM-DD',
    hint: 'This is the only thing that decides whether the event shows under Upcoming or under Been and gone. It moves itself on the day.',
  },
  { name: 'time', label: 'Time', type: 'text', hint: 'Free text — "6–8pm", "after Maghrib", "Three days".' },
  { name: 'location', label: 'Location', type: 'text' },
  {
    name: 'summary', label: 'Summary', type: 'textarea',
    hint: 'A line or two. Shown on the card and under the headline.',
  },
  {
    name: 'body', label: 'The write-up', type: 'textarea',
    hint: 'The full text on the event\u2019s own page. Leave a blank line between paragraphs.',
  },
  {
    name: 'imageUrl', label: 'Picture (landscape)', type: 'text',
    hint: `The card picture and the big one across the top of the event\u2019s page. ${IMAGE_HINT}`,
  },
  { name: 'imageAlt', label: 'Picture — alt text', type: 'text', hint: ALT_HINT },
  {
    name: 'posterUrl', label: 'Poster', type: 'text',
    hint: `The event's own graphic — the thing you would send somebody on WhatsApp. Shown beside the sign-up button, whole and uncropped, whatever shape it is. Upright is normal and fine. ${IMAGE_HINT}`,
  },
  { name: 'posterAlt', label: 'Poster — alt text', type: 'text', hint: ALT_HINT },
  {
    name: 'signUpUrl', label: 'Sign-up link', type: 'text',
    hint: 'A form, a WhatsApp link, anything. Leave blank and no button is shown at all.',
  },
  {
    name: 'slug', label: 'Web address', type: 'text',
    hint: 'The bit after /events/. Leave blank and it is made from the name.',
  },
  {
    name: 'featured', label: 'Feature on the homepage', type: 'checkbox',
    hint: 'Pins this one to the top of the homepage while it is still to come. With none ticked, the soonest event is used.',
  },
  { name: 'published', label: 'Show on the site', type: 'checkbox' },
];

const SERVICE_FIELDS = [
  { name: 'name', label: 'Service name', type: 'text' },
  {
    name: 'type', label: 'Type', type: 'text',
    hint: 'The blue word at the end of the row — "Weekly", "Monthly", "Annual", "Ongoing". Free text.',
  },
  {
    name: 'description', label: 'One line about it', type: 'textarea',
    hint: 'Shown on a phone, where the rows become cards. The desktop row is deliberately just the name and the type.',
  },
  {
    name: 'imageUrl', label: 'Image URL', type: 'text',
    hint: `The picture that trails the cursor along the row, and the card picture on a phone. ${IMAGE_HINT}`,
  },
  { name: 'imageAlt', label: 'Image — alt text', type: 'text', hint: ALT_HINT },
  {
    name: 'slug', label: 'Anchor', type: 'text',
    hint: 'Lets you link straight to this row: /services#the-anchor. Leave blank and it is made from the name.',
  },
  {
    name: 'order', label: 'Order', type: 'number',
    hint: 'Lowest first. The up and down arrows in the list set this for you.',
  },
  { name: 'published', label: 'Show on the site', type: 'checkbox' },
];

const RHYTHM_FIELDS = [
  {
    name: 'rhythm', label: 'The week', type: 'rows',
    columns: [
      { key: 'day', label: 'Day' },
      { key: 'time', label: 'Time' },
      { key: 'detail', label: 'What happens' },
    ],
  },
];

/*
  THE PRAYER TIMETABLE.

  NOBODY TYPES THESE IN ANY MORE. The centre keeps its timetable in Mawaqit,
  which is what drives the screen in the prayer hall, and the site reads that
  same page — so the website and the wall cannot disagree, and a change made
  once is made everywhere. See lib/mawaqit.js.

  What is left in this form is the two things a person still decides:

    1. WHICH MOSQUE. Paste any Mawaqit address — the public page, or the admin
       page you happen to be looking at when you think of it.
    2. WHERE TO READ FROM. "manual" switches the fetch off and uses the typed
       rows below, which is the escape hatch for a week when Mawaqit is wrong
       and the door is right.

  The typed rows stay, as the fallback for the one case where Mawaqit has
  never once been reachable. They are one box rather than eighteen fields
  because somebody filling them in is copying a printed sheet straight down,
  and eighteen fields is eighteen clicks between them.

  Times typed here are FREE TEXT — "5.42am", "05:42" and "5:42 AM" are all
  accepted and all shown exactly as typed. Only the "which prayer is next"
  highlight tries to read them, and it skips anything it cannot.
*/
const PRAYER_FIELDS = [
  {
    name: 'mawaqitSlug', label: 'Mawaqit page', type: 'text',
    placeholder: 'https://mawaqit.net/en/…',
    hint: 'The centre\u2019s page on mawaqit.net. Paste the whole address from either mawaqit.net or admin.mawaqit.net \u2014 only the last part of it is kept. Leave blank to switch Mawaqit off entirely.',
  },
  {
    name: 'prayerSource', label: 'Read the times from', type: 'select',
    options: ['mawaqit', 'manual'],
    hint: '"mawaqit" is the live timetable and is what you want. "manual" ignores it and uses the rows below \u2014 only for when Mawaqit is wrong and you need the site right today.',
  },
  {
    name: 'prayer', label: 'Fallback timetable', type: 'rows',
    columns: [
      { key: 'name',   label: 'Prayer' },
      { key: 'begins', label: 'Begins' },
      { key: 'jamaah', label: "Jama'ah" },
    ],
  },
];

/* Friday, and the same story: Mawaqit supplies it, one sitting or three, and
   these rows are only reached if it never has. */
const JUMUAH_FIELDS = [
  {
    name: 'jumuah', label: "Jumu'ah \u2014 fallback", type: 'rows',
    columns: [
      { key: 'label', label: 'What' },
      { key: 'time',  label: 'Time' },
    ],
  },
];

const WELCOME_FIELDS = [
  {
    name: 'welcome.imageUrl', label: 'Welcome picture', type: 'text',
    hint: `The upright picture beside the welcome on the homepage, cut to the arch from the logo. The front of the building works better here than the inside — the hero is already the inside. ${IMAGE_HINT}`,
  },
  { name: 'welcome.alt', label: 'Welcome picture — alt text', type: 'text', hint: ALT_HINT },
];

const CLIP_FIELDS = [
  { name: 'title', label: 'Clip title', type: 'text' },
  {
    name: 'videoUrl', label: 'Video URL', type: 'text',
    hint: 'An .mp4 or .webm. This is what opens when the tile is clicked.',
  },
  {
    name: 'posterUrl', label: 'Still image', type: 'text',
    hint: `What the tile shows before anyone presses play. Without one the tile has to load the film itself to have something to show. ${IMAGE_HINT}`,
  },
  {
    name: 'alt', label: 'What happens in it', type: 'text',
    hint: 'One line, for anyone using a screen reader — they cannot watch the clip.',
  },
  { name: 'order', label: 'Order', type: 'number' },
  { name: 'published', label: 'Show on the site', type: 'checkbox' },
];

/* The three fields of one full-width film. Built per slot so both films use
   exactly the same form. */
const filmFields = (slot) => [
  {
    name: `films.${slot}.videoUrl`, label: 'Video URL', type: 'text',
    hint: 'An .mp4 or .webm. It plays silently when the section scrolls into view and stops again when it leaves.',
  },
  {
    name: `films.${slot}.posterUrl`, label: 'Poster image', type: 'text',
    hint: `Shown before the film loads, if it fails, and instead of it for anyone who has asked their device to reduce motion. Set this one. ${IMAGE_HINT}`,
  },
  {
    name: `films.${slot}.alt`, label: 'What the footage shows', type: 'text',
    hint: 'One line, for anyone using a screen reader.',
  },
];

const HERO_FIELDS = [
  {
    name: 'hero.videoUrl', label: 'Hero video URL', type: 'text',
    hint: 'An .mp4 or .webm. It plays silently on a loop behind the name. Leave blank to use just the poster image.',
  },
  {
    name: 'hero.posterUrl', label: 'Hero poster image', type: 'text',
    hint: `The still shown before the video loads, if it fails, and instead of it for anyone who has asked their device to reduce motion. Worth setting even when there is a video. ${IMAGE_HINT}`,
  },
  { name: 'hero.alt', label: 'Hero — alt text', type: 'text', hint: ALT_HINT },
];

/*
  SEARCH ENGINES AND SHARED LINKS.

  One box per page for the title, one for the description, plus the picture
  that comes up when a link to the site is pasted into WhatsApp.

  The titles and descriptions are built from the ROUTES table, so a new page
  gets its two boxes here automatically. They are stored in the same place as
  every other text edit on the site — which is why they also appear in "Text
  you have changed", with a Reset on each.

  An event's page is NOT in this list, on purpose: it takes its title,
  description and picture from the event itself, so there is nothing here that
  could fall out of step with it.
*/
const SEO_FIELDS = [
  {
    name: 'settings.shareImageUrl', label: 'Sharing picture', type: 'text',
    hint: `Shown when a link to this site is pasted into WhatsApp or posted anywhere else. Landscape, about 1200×630. Every page uses it except an event's, which uses the event's own picture. ${IMAGE_HINT}`,
  },
  ...INDEXABLE_ROUTES.flatMap((route) => [
    {
      name: `seo.${route.key}.title`, label: `${route.title} — title`, type: 'text',
      placeholder: route.title,
      hint: '"— Taiba Islamic Centre" is added on the end automatically. Around 60 characters before Google starts cutting it off.',
    },
    {
      name: `seo.${route.key}.description`, label: `${route.title} — description`, type: 'textarea',
      placeholder: route.description,
      hint: 'The grey sentence under the blue link in a Google result. Around 155 characters. Leave blank to use the one written into the site.',
    },
  ]),
];

/* One background per value, built from the same list the page renders from,
   so the two can never drift apart. */
const VALUES_FIELDS = VALUES.map((value) => ({
  name: `values.${value.key}`,
  label: value.word,
  type: 'text',
  hint: `Image or video behind "${value.word}". Leave blank for flat colour.`,
}));

/*
  THE DONATION LINKS.

  Seven boxes, and every one of them is just a web address you paste in. No
  card details, no Stripe keys and no payment code live on this site: a donate
  button is a link, and the money is taken on Stripe's or LaunchGood's own
  page. That is why this form is as boring as it looks, and it is the right
  kind of boring.

  Any box left empty hides its button — an amount with no link behind it is
  simply not offered, rather than being shown as a button that goes nowhere.

  NOTE for whoever fills these in: these are Stripe PAYMENT LINKS (the ones
  that look like https://buy.stripe.com/...), made in the Stripe dashboard
  under Payment links. The five monthly ones want to be recurring links.
*/
const DONATE_HINT = 'Paste the full https:// address. Leave it blank to hide this button.';

const DONATE_FIELDS = [
  {
    name: 'donate.oneOff', label: 'One-time donation link', type: 'text',
    placeholder: 'https://buy.stripe.com/...',
    hint: `The big button at the top of the page. ${DONATE_HINT}`,
  },
  {
    name: 'donate.launchgood', label: 'LaunchGood campaign URL', type: 'text',
    placeholder: 'https://www.launchgood.com/campaign/...',
    hint: `Our campaign page. ${DONATE_HINT}`,
  },
  /* One box per amount, built from the same list the page is built from — so
     changing the ladder is changing DONATE_TIERS, not editing five copies of
     the same three lines. */
  ...DONATE_TIERS.map((amount) => ({
    name: `donate.monthly.${tierKey(amount)}`,
    label: `£${amount} a month — link`,
    type: 'text',
    placeholder: 'https://buy.stripe.com/...',
    hint: DONATE_HINT,
  })),
];

const CONTACT_FIELDS = [
  {
    name: 'contact.address', label: 'Address', type: 'textarea',
    hint: 'One line per line, the way it goes on an envelope. It is shown in the footer and on the Contact page, and it is what the "Open in maps" link searches for — so write it the way somebody would look it up.',
  },
  {
    name: 'contact.phone', label: 'Phone number', type: 'text',
    hint: 'Written however you like — it is shown exactly as typed, and the dialling link strips out the spaces itself.',
  },
  { name: 'contact.email', label: 'Contact email', type: 'text' },
  {
    name: 'contact.whatsappNumber', label: 'WhatsApp number', type: 'text',
    hint: 'International format, digits only — e.g. 447700900123.',
  },
  { name: 'social.instagram', label: 'Instagram URL', type: 'text' },
  { name: 'social.facebook', label: 'Facebook URL', type: 'text' },
  { name: 'social.youtube', label: 'YouTube URL', type: 'text' },
  {
    name: 'social.whatsapp', label: 'WhatsApp group link', type: 'text',
    hint: 'The community or group invite link — separate from the number above.',
  },
];


/**
 * Add or edit one event, without going through the list first. Passing null
 * opens a blank form.
 *
 * Whatever is saved, the page underneath is drawn again — so editing the event
 * you are standing on shows the change immediately, and adding one from the
 * events page drops it into the right group on the spot.
 */
function openEventEditor(id) {
  const record = id ? (state.events ?? []).find((event) => event.id === id) : {};
  if (!record) {
    toast('That event is no longer there.', 'error');
    return;
  }

  openRecordEditor({
    title: id ? `Edit — ${record.title || 'event'}` : 'New event',
    fields: EVENT_FIELDS,
    /* A new event is visible by default, the same as the server assumes. */
    record: id ? record : { published: true },
    endpoint: '/api/events',
    method: id ? 'put' : 'post',
    async onDone() {
      invalidate('events');
      await load('events');
      closeModal();
      await renderRoute(window.location.pathname, { restoreScroll: true });
    },
  });
}


/* --------------------------------------------------- Edit chip wiring ---- */

/*
  Every edit chip on the page is a button with data-edit="something", and
  `something` is a key in this table. Adding a chip is two steps:

    1. put the button in the markup, wrapped in editOnly(...) so visitors
       never see it:
         ${editOnly(`<button type="button" class="edit-chip"
                             data-edit="events">${icon('pencil')} Manage events</button>`)}

    2. add a line to `handlers` below saying what it opens.
*/

function mountEditHandlers() {
  const handlers = {
    /* Lists every piece of text you have changed, with a Reset on each. */
    'text-overrides': openCopyOverrides,

    /* What Google and WhatsApp see — see openSeoEditor(). */
    seo: openSeoEditor,

    /* Straight into a blank form — the common case is adding one, not
       browsing the list first. */
    'event-new': () => openEventEditor(null),

    events: () => openCollectionManager({
      title: 'Events',
      endpoint: '/api/events',
      cacheKey: 'events',
      fields: EVENT_FIELDS,
      label: (item) => item.title || item.id,
      subtitle: 'These are what the menu counts — add one and the number beside Events goes up.',
    }),

    services: () => openCollectionManager({
      title: 'Services',
      endpoint: '/api/services',
      cacheKey: 'services',
      fields: SERVICE_FIELDS,
      label: (item) => item.name || item.id,
      reorder: true,
      subtitle: 'The rows in the table on Services, top to bottom. The menu counts these too.',
    }),

    rhythm: () => openSettingsEditor({
      title: 'The weekly rhythm',
      subtitle: 'The list under the table. One line per session: the day, the time, and what happens — separated by a bar.',
      fields: RHYTHM_FIELDS,
    }),

    /*
      THE ONE THAT GETS USED EVERY MONTH. It is reachable from the hero, from
      the prayer section, from the prayer times page and from the footer,
      because it is the only thing on this site that somebody comes back to
      change on a schedule.
    */
    prayer: () => openSettingsEditor({
      title: 'Prayer timetable',
      subtitle: 'The times come from the centre\u2019s own Mawaqit page \u2014 the same timetable as the screen in the prayer hall \u2014 so they are not typed in here. This is which page to read, and the fallback for if it is ever unreachable.',
      fields: PRAYER_FIELDS,
    }),

    /*
      "Refresh now". The times are re-read every six hours on their own, so
      this is only for the minute after somebody has changed something in
      Mawaqit and wants to see it on the website before they walk away.
    */
    'prayer-refresh': async () => {
      try {
        const payload = await api.post('/api/prayer');
        state.prayer = payload.prayer;
        await renderRoute(window.location.pathname, { restoreScroll: true });
        toast(payload.prayer?.stale
          ? 'Mawaqit could not be reached \u2014 still showing the last copy.'
          : 'Prayer times re-read from Mawaqit.', payload.prayer?.stale ? 'error' : 'ok');
      } catch (error) {
        toast(error.message, 'error');
      }
    },

    jumuah: () => openSettingsEditor({
      title: "Jumu'ah",
      subtitle: 'One line per thing, "what | time" — the khutbah, the second jama\u2019ah, whatever the centre runs. With none of them the Friday panel is hidden from visitors.',
      fields: JUMUAH_FIELDS,
    }),

    welcome: () => openSettingsEditor({
      title: 'Welcome picture',
      subtitle: 'The upright picture beside the welcome paragraph on the homepage.',
      fields: WELCOME_FIELDS,
    }),

    clips: () => openCollectionManager({
      title: 'Recent clips',
      endpoint: '/api/clips',
      cacheKey: 'clips',
      fields: CLIP_FIELDS,
      label: (item) => item.title || item.id,
      subtitle: 'Short films for the homepage grid. With none of them, the section is not on the site at all.',
    }),

    /* One entry per full-width film — see FILM_SLOTS at the top of the file.
       Built from the list so adding a third film is one line there. */
    ...Object.fromEntries(FILM_SLOTS.map((slot) => [
      `film-${slot.key}`,
      () => openSettingsEditor({
        title: slot.title,
        subtitle: slot.subtitle,
        fields: filmFields(slot.key),
      }),
    ])),

    hero: () => openSettingsEditor({
      title: 'Hero video & poster',
      subtitle: 'The film behind the name on the homepage. Both are pasted URLs — there are no uploads.',
      fields: HERO_FIELDS,
    }),

    values: () => openSettingsEditor({
      title: 'Values backgrounds',
      subtitle: 'One image or video behind each of the six words. Any left blank show flat colour, which is a perfectly good look.',
      fields: VALUES_FIELDS,
    }),

    'contact-social': () => openSettingsEditor({
      title: 'Contact details & social links',
      subtitle: 'Leave any of these blank and it simply is not shown — in the footer, or on the Contact page.',
      fields: CONTACT_FIELDS,
    }),

    'donate-links': () => openSettingsEditor({
      title: 'Donation links',
      subtitle: 'Where each button on the Donate page sends people. All of them are links to Stripe or LaunchGood — no payment details are ever typed into this site. An empty box hides its button.',
      fields: DONATE_FIELDS,
    }),
  };

  /* Scoped to #app, so only real chips in the page are wired up. */
  $$('[data-edit]', app).forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.edit;

      const handler = handlers[key];
      if (handler) { handler(); return; }

      /*
        A chip for ONE record, written as "event:the-id" — which is how the
        event's own page offers to edit the event you are looking at, rather
        than making you find it in a list.
      */
      const [kind, id] = key.split(':');
      if (kind === 'event' && id) openEventEditor(id);
    });
  });
}

/**
 * Everything you have changed, in one list, with a Reset button beside each.
 * Useful for spotting a key you edited on a page you can't remember.
 */
function openCopyOverrides() {
  const copy = state.copy ?? {};
  const keys = Object.keys(copy).sort();

  const body = keys.length
    ? `<ul class="admin-list">${keys.map((key) => `
        <li>
          <div class="admin-row-head">
            <span>
              <code>${esc(key)}</code>
              <span class="admin-row-value">${esc(copy[key])}</span>
            </span>
            <button type="button" class="btn btn--sm" data-reset-key="${esc(key)}">Reset</button>
          </div>
        </li>`).join('')}</ul>`
    : emptyState(
        'Nothing changed yet',
        'Switch "Edit text" on in the bar at the bottom, then click any heading or line to change it. Whatever you change will be listed here.'
      );

  openModal({
    title: 'Text you have changed',
    subtitle: 'Every wording override saved against this site. Resetting one puts the original text back.',
    body,
    onMount(host) {
      $$('[data-reset-key]', host).forEach((button) => {
        button.addEventListener('click', async () => {
          closeModal();
          await resetCopy(button.dataset.resetKey);
        });
      });
    },
  });
}


/* ============================================================== Boot ====== */

async function boot() {
  /*
    The motion foundation goes up first, before anything is drawn: GSAP is
    registered, Lenis takes over scrolling, and the cursor appears — each only
    if the device and the visitor's settings allow it.
  */
  /*
    Fetched first because everything below depends on whether they arrived —
    and skipped entirely on a phone, where it costs nothing and saves 117 KiB.
  */
  await loadMotionLibraries();

  setupGsap();
  mountLenis();
  mountCursor();
  watchMotionPreference();

  /*
    Text overrides are cosmetic: if they fail to load, the default wording in
    the markup stands and the site is still completely fine.
  */
  try {
    await load('copy');
  } catch {
    state.copy = {};
  }

  /*
    The footer needs the contact email and social links, and the menu needs the
    events in order to count them — so both are fetched before the first
    render. Neither is allowed to stop the site: if a request fails the footer
    shows its "not set yet" state and the menu simply shows no number.
  */
  await Promise.all([
    load('settings').catch(() => { state.settings = { contact: {}, social: {} }; }),
    load('events').catch(() => { state.events = []; }),
    load('services').catch(() => { state.services = []; }),
    /*
      Today's prayer times, from the centre's Mawaqit page. Fetched here
      rather than by the page that needs them, because the hero strip on the
      homepage shows them above the fold — waiting until that section renders
      would mean the most important thing on the site arrives last.

      A failure is not allowed to matter: the request already falls back to
      the hand-typed timetable on the server, and if it fails outright
      prayerRows() falls back to the same rows in the browser.
    */
    load('prayer').catch(() => { state.prayer = null; }),
  ]);

  /* Ask the server whether we are already logged in (the cookie is httpOnly,
     so the page genuinely cannot tell on its own). */
  try {
    const { authed, configured } = await api.get('/api/auth');
    state.authConfigured = configured;
    setAuthed(authed);
  } catch {
    setAuthed(false);
  }

  await renderRoute(window.location.pathname);

  /* The page is built and painted — lift the blue panel off it. */
  dismissPreloader();
}

/*
  If anything in boot() throws, the page must still be released. Without this
  the blue panel would sit there until index.html's safety timer fired, which
  is a long time to look at nothing.
*/
boot().catch((error) => {
  console.error('[boot] the site failed to start', error);
  dismissPreloader();
});
