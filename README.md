# Taiba Islamic Centre — website

The website for Taiba Islamic Centre: a mosque and community centre. Prayer
times, what the centre runs, what is on, and how to give to it.

This README is written for someone who is **not** a developer. It explains what
each file is for, how to run the site on your own computer, and how the "edit
the words on the site" feature works.

**If you only do one thing on this site, it is the prayer timetable.** Jump to
[Prayer times](#prayer-times) — it is one box, it takes two minutes, and it is
what most of your visitors came for.

---

## The short version

* The whole site is **three files**: `index.html`, `app.js` and `styles.css`.
* There is **no build step**. You edit a file, you refresh the browser, you see
  the change. Nothing has to be compiled.
* Anything that needs a server — checking a password, saving your text edits —
  lives in the `api` folder. Vercel turns each file in there into its own tiny
  web service automatically.
* Everything you can see on the site can be **changed from the site itself**,
  once you have logged in. You never have to touch a file to change a word,
  update the prayer times, add an event, or swap a picture.
* **The prayer times are typed in, not calculated** — and that is on purpose.
  See [Prayer times](#prayer-times).

If you only ever read one part of this file, read the next one.

---

## Running the site, day to day

This section assumes nothing. It is the six things you will actually do.

### 1. Logging in to edit the site

1. Go to the site and scroll to the very bottom of any page.
2. Click the small **padlock** in the bar at the bottom of the screen.
3. Type the admin password and press Enter.

A bar appears along the bottom of the screen. That bar is how you know you are
logged in, and everybody else — every ordinary visitor — sees nothing of it.
Small dashed blue **chips** appear around the page, each one next to the thing
it changes.

You stay logged in for **8 hours**, then it asks again. Click **Log out** in
the bar to finish early. If you are on a shared or public computer, log out.

**If you forget the password**, nobody can look it up — it is not stored
anywhere in a readable form. Set a new one in Vercel (see *Every setting you
need in Vercel*, below) and redeploy.

### 2. Updating the prayer times

**The one you will do every month.** It takes two minutes.

1. Log in.
2. Click **Prayer times** — the chip is on the hero, beside the timetable, on
   the prayer times page, and in the footer. Any of them opens the same form.
3. You get **one box** with a line per prayer, and the three columns separated
   by a bar:

   ```
   Fajr | 4.20am | 5.00am
   Sunrise | 5.55am |
   Zuhr | 1.05pm | 1.30pm
   Asr | 5.30pm | 6.15pm
   Maghrib | 8.40pm | 8.45pm
   Isha | 10.10pm | 10.30pm
   ```

   That is **name | begins | jama'ah**. Type straight down the list off the
   printed timetable. Sunrise has no jama'ah, so leave the last column empty.
4. Press **Save**. It is live everywhere on the site at once.

**Write the times however you say them.** "5.00am", "05:00" and "5:00 AM" are
all fine and all shown exactly as you typed them. Nothing is recalculated and
nothing is rounded.

**Adding a row** — Tarawih in Ramadan, say — is one more line, and taking it
off again afterwards is deleting that line. Extra rows appear after the usual
six.

**Jumu'ah** is a second, separate chip on the Friday panel, and works the same
way with two columns, "what | time":

```
Doors open | 12.30pm
Khutbah | 1.15pm
Jama'ah | 1.40pm
```

A mosque with two sittings adds a second line and the panel grows.

### 3. Adding an event

1. Log in.
2. Go to **What's On**.
3. Click **Add event**.
4. Fill the form in. Only four boxes really matter:
   * **Title** — what it is called.
   * **Date** — pick it from the calendar. *This is the important one.* The
     date is what decides whether the event shows under "Upcoming" or under
     "Been and gone", and it re-decides every time somebody loads the page.
     You will never have to move an old event by hand.
   * **Summary** — the sentence on the card, and the sentence Google and
     WhatsApp show.
   * **Picture** — see the next section for where to get a link.
5. Press **Save**.

Everything else is optional. Leave the sign-up link blank and no sign-up button
appears. Leave the poster blank and the page simply doesn't have one.

**To change or delete one**, either open the event and click the pencil, or use
**Manage events** in the footer for the whole list with an edit and a delete on
each.

**Featured** puts one event at the top of the homepage. Leave it unticked on
everything and the homepage shows whatever is coming up soonest, which is
usually what you want anyway.

### 4. Getting a Cloudinary URL for a picture

Every picture on this site is a **link to a picture stored somewhere else**.
There is no upload button anywhere, on purpose: uploads mean storage, storage
means bills, and bills mean somebody has to remember to pay them.

Cloudinary's free tier is far more than this site will ever need.

1. Sign up once at [cloudinary.com](https://cloudinary.com) — the free plan.
2. Go to **Media Library** and drag your photo in.
3. Click the photo, then **Copy URL**.
4. Paste that into the picture box on the site. Save.

It will look something like:

```
https://res.cloudinary.com/taiba/image/upload/v1712345678/prayer-hall.jpg
```

You do **not** need to resize or compress anything first. The site rewrites
that address as it uses it, asking Cloudinary for the picture at the size that
particular slot needs and in the best format the visitor's browser supports.
A 6MB photo straight off a phone becomes about 80KB by the time it reaches
somebody's screen, and you did nothing.

Any other public image address works too — it just won't get the resizing.

**Write the alt text.** Every picture box has an **alt text** box beside it.
One sentence saying what is in the picture — "Boys playing five-a-side in the
sports hall" — for anyone using a screen reader, and for when a picture fails
to load. If a picture is purely decorative, leaving it blank is the right
answer, not a mistake.

### 5. Changing the Stripe and LaunchGood links

1. Log in and go to **Donate**.
2. Click **Donation links** at the bottom.
3. There are seven boxes: the one-time donation, the LaunchGood campaign, and
   one for each of the five monthly amounts.

The Stripe ones are **payment links** — you make them in the Stripe dashboard
under *Payment links*, and they look like `https://buy.stripe.com/…`. The five
monthly ones should be recurring links. Paste the whole address, including the
`https://`.

**An empty box hides its button.** Three of the five monthly amounts filled in
means three cards on the page, filling the row, with no gap where the other two
would be. Nothing on this site ever shows a button that goes nowhere.

No card details are ever typed into this website and no Stripe keys are stored
in it. A donate button is a link; Stripe does the rest on its own page.

### 6. "I changed something and it hasn't appeared"

Work down this list. It is in order of how likely each one is.

**Are you looking at the right thing?** Some edits only show in one place. A
service's description, for instance, is deliberately only shown on a phone —
the desktop row is two columns by design.

**Refresh the page properly.** Not a normal refresh — hold **Shift** and click
reload (or ⌘⇧R on a Mac, Ctrl+F5 on Windows). Your browser keeps a copy of the
site to make it load faster, and sometimes it keeps it a little too eagerly.

**Are you still logged in?** Sessions last 8 hours. If the bar at the bottom is
gone, you were logged out, and anything you typed after that was not saved.
Log back in and do it again.

**Did you actually press Save?** Closing the form with Cancel or the X throws
the changes away. A successful save shows a small "Saved." message at the
bottom of the screen.

**Did the save fail?** If something went wrong, the message under the form
turns red and says what happened. The commonest one is a picture address that
isn't a proper web address — it has to start with `https://`.

**Was it the wording of a heading or a paragraph?** Those are changed with
**Edit text** switched on in the bottom bar, not through a form. Switch it on,
click the words, type, click away. **Text you have changed** in the footer
lists every one of them with a Reset button, which is also how you undo one.

**Two people editing at once?** Don't. The site saves a whole section at a
time, so if two of you press Save within a few seconds of each other, the
second save wins and the first is lost. Nothing breaks; one person's edit
simply isn't there.

**Still nothing?** Check the site is not being served from a cached copy by
opening it in a private window. If the change is there and not in your normal
window, it is your browser, not the site.

---
## What's in the box

```
index.html        The one HTML page the browser ever loads.
app.js            The whole site: every page, the menu, the routing, edit mode,
                  smooth scrolling, the scroll reveals and the custom cursor.
styles.css        Every colour, font, spacing and motion value, named once.

vendor/           Copies of the two libraries, so the browser can load them
                  without a build step. Made automatically — don't edit.
scripts/
  vendor.mjs        The thing that makes those copies.
  make-logos.py     Rebuilds every logo file from assets/logo-source.png.
  make-icons.py     Rebuilds the favicon and the app icons from the arch.
assets/
  logo-source.png   THE ARTWORK AS SUPPLIED. Everything else here is built
                    from it — see "The logo" near the end of this file.
  mark-dark.png     The arch alone, navy + gold, for the parchment page.
  mark-light.png    The arch alone, reversed out, for a navy background.
  logo-dark.png     The complete stacked logo, in colour.
  logo-light.png    The complete stacked logo, reversed out.

api/              Server code. One file = one web address under /api/.
  auth.js           Logging in and out of edit mode.
  copy.js           Saving and loading your text edits.
  events.js         The events list. The menu counts these.
  services.js       The rows in the table on Services. Counted too.
  clips.js          Short films for the Recent clips grid on the homepage.
  settings.js       THE PRAYER TIMETABLE and Jumu'ah, the contact details, the
                    social links, the donation links, and every piece of media
                    that isn't attached to one event.
  seed.js           One-off loader for data/seed.json. Development only.

lib/              Shared helper code used by the api files.
  kv.js             The database. The ONE file to change if we ever move off Redis.
  auth.js           Password checking and the signed login cookie.
  http.js           Small helpers: reading a request, cleaning up text and URLs.
  collection.js     A ready-made "list of things" API. Events, services and
                    clips are all one small file each on top of this.
  seed.js           Loads data/seed.json and hands out starting values.

data/
  seed.json         Starting content for a brand-new site.

vercel.json       Tells Vercel how to serve the site.
package.json      Lists the one dependency (the Redis client).
.env.example      A template for your secrets. Copy it to .env and fill it in.
```

---

## Running it on your own computer

**One time only:**

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Install the Vercel command-line tool, if you haven't already:

   ```bash
   npm i -g vercel
   ```

3. Make your secrets file. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

   Then open `.env` and fill in two things:

   * `ADMIN_PASSWORD` — whatever you want the edit-mode password to be.
   * `SESSION_SECRET` — a long random string. Get one by running:

     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

   Leave everything else in `.env` as it is.

**Every time:**

```bash
npm start
```

That runs `vercel dev`, which serves the site at <http://localhost:3000>.
The first time you run it, Vercel will ask a couple of questions to link the
folder to a project — answering the defaults is fine.

### Where does the data go locally?

Into a plain file at `.data/store.json`. It is created automatically, it is
never committed to git, and you can delete it any time to start fresh.

This is deliberate. The live site's database is the real one, and local
development must never be able to write to it — so local development always
uses the file instead. Two separate guards enforce that, both in `lib/kv.js`.

---

## Editing the words on the site

This is the part that replaces "log in somewhere else and change the text".

1. Scroll to the very bottom of any page.
2. Click **Web dev edit**.
3. Type the admin password.
4. A small bar appears at the bottom of the screen. Click **Edit text**.
5. Every editable piece of text now has a dashed outline. Click one.
6. Type. Press **Enter** to save, **Shift+Enter** for a new line, **Escape** to
   cancel. Or use the Save / Cancel / Reset buttons that appear beside it.
7. **Reset** puts the original wording back.

Your login lasts 8 hours, then you enter the password again. The logout button
is the arrow icon in the bottom bar.

### How it works underneath

Every piece of fixed text in `app.js` carries a key:

```html
<h1 data-copy="home.title">Somewhere to belong</h1>
```

The wording inside the tag is the **default** — it's written into the site and
is what everyone sees until somebody changes it. When you edit it, only the
changed wording is saved, against the key `home.title`. The site then swaps it
in every time the page draws.

The practical upshots:

* An empty database means "the site exactly as designed". Nothing breaks.
* Resetting a piece of text means deleting one saved value.
* The same key used in two places (a nav label in the header and the footer,
  say) changes in both at once.
* Keys should not be renamed once the site is live — renaming one orphans
  whatever was saved against the old name.

Three edit chips sit in the footer once you are logged in:

* **Text you have changed** — every wording override saved, with a Reset on each.
* **Manage events** — add, edit and delete events. This is what the menu counts.
* **Contact & social links** — the footer's email address and social URLs.

### "Edit chips"

Buttons marked with a pencil that appear next to things you can manage, and
only when you are logged in. They are genuinely absent from the page for
ordinary visitors, not just hidden — and every save is checked again on the
server, so nobody can fake their way past them.

---

## Images

**Images are always pasted links. There are no file uploads anywhere on this
site, by design.**

The workflow is: upload the picture to Cloudinary, copy its delivery URL, paste
it into the relevant field.

When you paste a Cloudinary URL, `app.js` quietly rewrites it on the way out so
the picture is resized and compressed for the web — see `cloudinaryFit` near the
top of the file. Without that, the browser downloads the original upload, which
is often several thousand pixels wide and painfully slow on a phone.

A URL that already has its own Cloudinary settings in it is left exactly as you
pasted it, and a link to any other image host passes straight through untouched.

---

## Every setting you need in Vercel

**Project → Settings → Environment Variables.** Seven names. Two of them you
must set, two are filled in for you, one is optional, and two must be left
alone.

| Name | Set it? | What it is |
|---|---|---|
| `ADMIN_PASSWORD` | **You set this** | The password for edit mode. Anyone with it can change every word and picture on the site. Make it long. |
| `SESSION_SECRET` | **You set this** | A long random string used to sign the login cookie, so nobody can forge a session. Never share it, and never reuse it anywhere else. |
| `KV_REST_API_URL` | **Never add by hand** | The database address. The Upstash integration adds it when you connect a database. Adding it yourself creates an empty variable that looks connected and isn't. |
| `KV_REST_API_TOKEN` | **Never add by hand** | The database password. Same — the integration sets it. |
| `SITE_URL` | Optional | `https://taibaislamiccentre.org`, no trailing slash. Only used to write the full addresses into `sitemap.xml`. Leave it out and the site works out its own address. |
| `ALLOW_SEED` | **Leave blank** | A development-only switch that lets the starting content be reloaded. Setting it live would let somebody wipe the real content. |
| `TIC_LOCAL_STORE` | **Never set this on Vercel** | Forces the site onto a local file instead of the database. On Vercel that means every edit is forgotten. |

**Is the database actually connected?** Open **`/api/health`** on the deployed
site. It answers in one line: `"store": "redis"` and `"ok": true` means saving
works. Anything else, and the `note` field tells you what to do about it. It is
the first thing to check if a save ever fails.

To generate `SESSION_SECRET`, run this once in a terminal and paste the result:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set all of them for **Production, Preview and Development** unless you have a
reason not to. Changing one only takes effect on the **next deployment** —
Vercel does not apply it to the site already running, so redeploy afterwards.

---

## Going live

### Step 1 — put the code on GitHub

Make a new, **private** repository and push this folder to it. Private matters:
the repository does not contain the password, but it does contain everything
about how the site works, and there is no reason to publish that.

### Step 2 — create the Vercel project

1. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
2. Vercel will ask for a framework. Choose **Other**, and leave the build
   command and output directory empty. This site has no build step, which is
   the whole point of it.
3. Do **not** deploy yet. Do steps 3 and 4 first, or the first deployment will
   go up without a database and without a password.

### Step 3 — add the database

**Storage → Create Database → Upstash for Redis** (it is on the Vercel
Marketplace). Connect it to this project. It adds `KV_REST_API_URL` and
`KV_REST_API_TOKEN` by itself; you do not type them in.

The free tier is far more than this site needs. The whole site's content is a
handful of small text records.

### Step 4 — add the two secrets

`ADMIN_PASSWORD` and `SESSION_SECRET`, from the table above.

### Step 5 — deploy, and put the content in

Deploy. You will get an address like `taiba-islamic-centre.vercel.app`.

Open it. The site will be **completely empty** — no events, no services, no
pictures. That is correct: the database is new. Log in and add things, or load
the starting placeholders in one go:

1. Set `ALLOW_SEED` to `1` in the environment variables and redeploy.
2. Log in to the site, then visit `/api/seed` — it loads the five example
   services, three example events and the weekly rhythm.
3. **Delete `ALLOW_SEED` again and redeploy.** Do not leave it on.

### Step 6 — check it before you point the domain at it

On the `.vercel.app` address, before anybody is looking:

* Log in, add an event, and check it appears.
* Open the site on your actual phone.
* Visit `/sitemap.xml` and check the events are listed.
* Paste the address into a WhatsApp message to yourself and check the picture
  and the title come up. (Don't send it.)

---

## Pointing the domain at the new site

This is the part where the live site changes for everybody, so read it through
before starting any of it. `taibaislamiccentre.org` is used as the example
throughout — substitute the centre's real domain.

### Before you touch anything: save whatever is there now

If there is an existing site at the address, it is about to stop being the
thing people land on. Once DNS has moved, getting anything back out of it is
much harder.

1. If it is **WordPress**: *Tools → Export → All content*, and download the XML
   file. Then download a copy of the **Media Library** — most hosts let you
   take `wp-content/uploads` over FTP or from a file manager in the control
   panel.
2. If it is anything else, take whatever the host calls a **full backup**.
3. Either way, **save the prayer times, the address and the phone number** off
   the old site before it goes. They are the things somebody will ask for at
   eleven o'clock at night.
4. Put all of it somewhere that is not a laptop — Google Drive, a hard disk,
   both.

Do not cancel the old hosting yet. Leave it running and paid for at least a
month after the switch. It costs a few pounds and it is the only way back if
something turns out to have been on the old site that nobody remembered.

### Step 1 — add the domain in Vercel

**Project → Settings → Domains → Add.** Add both:

* `taibaislamiccentre.org`
* `www.taibaislamiccentre.org`

Vercel will show you exactly which DNS records to create. It normally asks for:

| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

**Use the values Vercel shows you on the day, not the ones in this table.**
They have changed before.

### Step 2 — lower the TTL first, and wait

This is the step people skip and then regret.

Go to wherever the domain's DNS is managed — the **domain registrar**, which is
whoever the domain is bought from (123-reg, GoDaddy, Namecheap…), and which may
not be the same company as the old host. Find the existing `A` record for
`@` and change its **TTL** to **300** (5 minutes). Change nothing else.

Now wait as long as the OLD TTL was — usually an hour, sometimes 24. What this
buys you: when you make the real change tomorrow, it takes 5 minutes to take
effect everywhere instead of a day, and if something is wrong you can put it
back just as fast.

### Step 3 — make the change

Do it on a **weekday morning**, not a Friday evening.

1. Change the `A` record for `@` to the address Vercel gave you.
2. Change (or add) the `CNAME` for `www` to `cname.vercel-dns.com`.
3. **Leave every `MX` record exactly as it is.** MX records are email. Deleting
   them stops the organisation's email arriving, and nothing about this site
   needs them touched. The same goes for any `TXT` record — SPF, DKIM, domain
   verification. Leave all of them.

Then wait. Vercel's Domains page shows a tick beside each domain when it sees
the change, and issues the HTTPS certificate by itself, which takes a few more
minutes. You do not have to do anything about certificates.

### Step 4 — check

* `https://taibaislamiccentre.org` — the new site, with a padlock in the address
  bar.
* `https://www.taibaislamiccentre.org` — should land on the same place.
* `http://taibaislamiccentre.org` (no **s**) — should redirect to `https`.
* Send yourself an email at the organisation's address and check it arrives.

If something is wrong: put the old `A` record back. Because the TTL is 5
minutes, the old site returns almost at once. That is what step 2 was for.

### Step 5 — tell Google

1. [Google Search Console](https://search.google.com/search-console) → add
   `taibaislamiccentre.org` if it is not already there.
2. **Sitemaps** → submit `sitemap.xml`.
3. If the old site had pages at addresses this one doesn't have, and anything
   links to them, add redirects in `vercel.json` under `"redirects"` so those
   links still land somewhere sensible rather than on the not-found page.

Then leave it alone. Google takes weeks to fully re-crawl a site, and there is
nothing to do in the meantime.

### Step 6 — afterwards

* **A month later**, if nothing has gone wrong, cancel the old hosting.
  Keep the export files forever.
* **Keep the domain registration** where it is. None of this moves the domain
  itself; you have only changed where it points.

---

## The design system

`styles.css` is organised in six numbered parts, and part 1 is the one that
matters: every value the site uses, named once. Nothing below part 1 should ever
contain a raw hex code or a timing number — if you find yourself typing one, the
token is missing, so add it to part 1 instead.

### Everything came out of the logo

The navy and the gold were measured off the artwork itself. Nothing in the
palette was invented beside them.

| Token | Value | For |
|---|---|---|
| `--brand` | `#0A2C6C` | **Large fills** — the donate band, the footer, the menu, the loading panel, a wash over a photo |
| `--gold` | `#B5812A` | **Decoration at size** — hairlines, the arch outline, an icon, a rule under a heading |
| `--accent` | `#96661A` | **Small text** — the uppercase labels, link text, the "When" column |
| `--gold-soft` | `#E2C185` | Gold that has to work **on navy** |
| `--page` | `#FBF9F4` | The page itself — warm parchment, not white |
| `--sand` | `#F3EDE1` | A panel that steps forward from the page |
| `--ink` | `#10141C` | All body and heading text |

**Why the small text is not the logo's gold.** `#B5812A` is a beautiful colour
and it measures **3.27:1** against this page. The accessibility minimum for
normal text is 4.5:1 — and 12px is exactly the size the labels are set at, so
that is the difference between a word you read and a word you squint at.

`#96661A` is the same hue taken down until it measures **4.77:1**. The
full-strength gold is still used everywhere contrast is not the question: rules,
arches, icons, and anything sitting on the navy.

| Hex | Contrast | |
|---|---|---|
| `#B5812A` | 3.27 | the logo gold, measured off the artwork — fails AA as text |
| `#A8741F` | 3.90 | darkened once — still short |
| `#9E6E1D` | 4.30 | closer, and still under the line |
| **`#96661A`** | **4.77** | **in use as `--accent`** |
| `#8A5E14` | 5.45 | more headroom, and starting to read as brown |
| `#0A2C6C` | 12.6 | the navy — passes easily, but a navy label reads as body text |

All of these are rendered side by side on the `/foundations` page. Swapping one
is one line in part 1 of `styles.css`.

There is also `--accent-soft`, a pale wash of the gold for hover backgrounds and
quiet panels. Never put text in it — it has nowhere near enough contrast. Accent
*text* darkens on hover rather than lightening, for the same reason.

### The arch

The logo is an arch, so the pictures are arches. `--arch` is a `border-radius`
with two radii per corner, which gives the soft ogee curve of the mark rather
than a semicircle stuck on a box. It is used on:

* the outline drawn behind the name in the hero, and again behind the donate band
* the picture beside the welcome paragraph
* every service tile on the homepage
* the picture that trails the cursor along a row on the Services page

Three or four uses of one shape is what makes it read as the building rather
than as a decoration somebody liked. Apply it to a **wrapper that clips its
contents**, never to an `<img>` — an arch on the image leaves the frame behind
it square and the join shows.

### Type

Two families, four weights, and nothing else.

| | | |
|---|---|---|
| **Cormorant Garamond** | 500, 600 | every heading |
| **Plus Jakarta Sans** | 400, 500 | everything else |

The serif is here because the wordmark in the logo is drawn in one: tall, open
capitals with fine hairlines. The sans is here because a serif at 13px in a form
field is a struggle, and half this site is small text.

**Headings are mixed case, not uppercase.** Cormorant is built around its
capitals — the A, the T, the R — and setting whole lines in them wastes the
thing the face is for, as well as costing about a fifth of the reading speed.
The only uppercase on the site is `.label`: 12px, tracked to 0.16em, which is
the logo's own letter-spacing. That tracking is the small move that ties the
type back to the mark, so don't tighten it.

The display scale uses `clamp(minimum, grows-with-viewport, maximum)`, so text
never drops below a readable size on a phone and never gets silly on a wide
monitor:

| Token | Reaches | For |
|---|---|---|
| `--display-1` | 11vw | the hero, one or two words |
| `--display-2` | 7.5vw | section openers |
| `--display-3` | 5vw | sub-sections |
| `--display-4` | 2.8vw | card and row headings |
| `--heading` | 2vw | the smallest heading |

Body is 17px at line-height 1.35. There is one looser step, `--line-loose`
(1.62), used by the `.prose` class: 1.35 is right for interface text and
headings, but a long paragraph set that tight is hard to read.

### Spacing and motion

Everything is built off one 64px unit: 16 / 32 / 64 / 128 / 192. The header
height and the main grid gap are both 64px, on purpose — that repetition is what
holds the layout together.

One signature easing curve, `--ease-ref`, is used by nearly every transition.
Default duration 0.6s; 0.3s for small state changes like a hover. Using the
same curve everywhere is most of why the site feels like a single piece of work
rather than a pile of components.

---

## The moving parts

Three behaviours share one rule: **all three are off on a phone and off for
anyone who has asked their device to reduce motion.** That check lives in
`motionAllowed()` in `app.js`, and it is live — if you plug in a mouse or change
the setting, they start or stop without a reload.

### Smooth scrolling (Lenis)

Lenis intercepts the wheel and animates the scroll position, which is what gives
the page its weight. It's deliberately absent on touch: phones already have
momentum scrolling that feels better than anything we'd add, and Lenis fights
it. Options are currently the defaults, in `mountLenis()`.

### GSAP + ScrollTrigger

Loaded and registered, **animating nothing yet**. This is the foundation step;
the first scroll-linked animation will be written against it. GSAP also drives
Lenis's animation loop, so the two run on one clock rather than two competing
ones.

### The custom cursor

Ours, not on the reference. A 16px circle filled with `--accent` that chases the
pointer, moving 15% of the remaining distance each frame — that slight lag is
what makes it feel like an object with weight rather than a sprite glued to the
pointer.

- It scales to 2.5× over any link, button, or anything marked `data-cursor-grow`.
- It turns white inside any element marked `data-cursor="invert"`. Put that
  attribute on a whole dark band and everything inside it is covered — the
  cursor walks up the tree to find it.
- Where it runs, the ordinary arrow is hidden — **except** over text boxes,
  which keep their I-beam. Losing that makes a form feel broken.

### Scroll reveal

`data-reveal` fades an element in as it arrives. `data-reveal="text"` fades it
in *and* raises it 20px. Media only ever fades — a photograph sliding upward
looks cheap.

Siblings stagger automatically: `app.js` numbers them and the CSS turns that
into a 0.1s gap between each. The count restarts inside each parent, so a
section further down the page doesn't inherit a two-second delay from everything
above it. Set `style="--i:3"` yourself to override the order.

There is a **failsafe**: everything starts invisible and is only shown by the
browser reporting that it has scrolled into view, so if that reporting never
happens the page is simply blank. If nothing has come back after a second and a
half, the site gives up waiting and shows everything. Someone seeing the words
without the fade is a far better outcome than someone seeing nothing. The
countdown only runs while the page is actually on screen, so opening the site in
a background tab doesn't spend all the animations before you look at it.

### Reduced motion

One block at the end of `styles.css` switches off every transition, and
`app.js` never starts Lenis or creates the cursor in the first place. Content
that would have faded in is simply already there.

---

## Navigation

### The header

Fixed, 64px tall, sitting above everything on the page. The logo is on the
left; **Menu** and **Donate** are on the right. There are deliberately no
nav links in the bar — everything lives in the menu overlay.

It does two separate things, each its own attribute on the element so they can
never interfere with one another:

* **Hides on the way down, returns on the way up.** Scrolling down past 100px
  takes it away. *Any* upward movement brings it back — no threshold, because
  if you flick up even slightly you want the navigation immediately.
* **Transparent over the hero, solid afterwards.** While the bar sits over a
  page's hero section it has no background, so the hero runs right up
  underneath it. Once the hero scrolls by, a solid page-coloured background
  fades in behind it.

Both transitions are 0.3s on the signature curve, declared once in
`styles.css`. There is no animation code in JavaScript at all — it only ever
sets the two attributes.

**The arch swaps** between the two files as that happens. A note on the naming:
they are named after the colour of the **artwork**, not the background.
`mark-light.png` is white lines and pale gold for a dark background;
`mark-dark.png` is the navy and gold one for the parchment page. The words
beside it are live text and simply change colour with the bar.

The light one is used only while the header is transparent over a hero that is
actually dark. A hero says so with `data-hero-tone="dark"` — which the
homepage's hero sets **as soon as a video or a poster is added to it**, and not
before: white lines on a pale empty hero would be invisible, which is worse
than not swapping. You can see it working on `/foundations`, whose hero is
deliberately dark, and on the Donate page.

### The menu overlay

A full-height **navy** panel that slides down from above and **covers** the
header rather than pushing it out of the way — that is what the z-index 110 is
for. Navy because the menu is the one moment the site stops being a document
and becomes a place: it is the same panel the site opens on while it loads, so
arriving at it feels like coming back to the front rather than having a white
sheet dropped over the page.

The links come in staggered: each waits 0.15s for the panel to get under way,
then they arrive 0.06s apart, each taking 0.5s to fade up and rise its last
20px. On the way out they all leave together, because a reverse stagger on
close reads as hesitation.

It behaves like a proper dialog: the page behind it doesn't scroll, Tab cycles
inside it instead of wandering off into the hidden page behind, Escape closes
it, and closing puts focus back on the button that opened it.

**The count beside "Events" is real.** It is however many published events are
actually in the store — add one in edit mode and the number goes up. It is
hidden entirely when there are none, rather than showing a zero.

### The footer

**Navy**, with a gold rule across the top of it — the third and last place on
the site that large colour appears, after the loading panel and the donate
band. It closes the page the way the header opens it, which is why the logo
down there is the reversed file.

The reversed lockup, the address, page links, social icons, the contact email,
and the quiet **Web dev edit** button. Every piece of text has a `data-copy`
key, so all of it is editable.

It carries **no top margin**. Every page ends on either the donate band or a
full-width film, and both of those are already colour to the edge of the
screen — a strip of pale page between them and the footer would read as a gap
rather than as breathing room.

The email and the four social links are stored, not typed into the code — edit
them with the **Contact & social links** chip, which appears in the footer once
you are logged in. They all start empty. A social account with no URL yet is
still shown but greyed out and not clickable, so it is obvious there is a gap
to fill rather than the row just being short.

### The preloader

A full-screen panel in `--brand` with the logo centred, which covers the page
on a first visit to the homepage and then slides up and away on the same 0.6s
curve as the menu.

It is switched on by a tiny script in `index.html` that runs *before the
browser paints anything*. That matters: if it waited for `app.js` you would see
a flash of half-built page and then a loading screen over the top of it, which
looks worse than no loading screen at all.

* Homepage only, first load only. Moving around the site never brings it back.
* Skipped entirely under "reduce motion", and by adding `?loader=0` to the
  address — useful while working on the site.
* There are **two** safety nets, because a loading screen that never lifts is
  the one failure here that makes the site completely unusable. `app.js` lifts
  it on a timer as well as on an animation frame, since a browser stops handing
  out animation frames to a background tab. And if `app.js` never runs at all,
  the inline script removes it after 8 seconds regardless.

### When an address isn't a page

Anything that doesn't match a page — a typo, an old link, `/events/` with a
slug that no longer exists — gets a **proper "there is nothing here" page**
that names the address it was given, with links back to the homepage and to
What's On.

This used to quietly show the homepage instead, which is worse than it sounds:
a wrong link would look like it had worked, so nobody — the visitor, or us —
ever found out it was wrong.

---

## The homepage

Ten sections, in `app.js` under "Home". **The order is the argument.** Somebody
arriving at a mosque's website wants one of three things: when is the next
prayer, what is on, and how do I give. The first is answered before they scroll
at all, the second twice over, and the third closes the page.

**1. Hero** — a full screen of silent looping video with the name over it, the
arch drawn around it, and **today's prayer times docked along the bottom edge**.
The header sits on top with no background of its own, so the picture runs right
to the top of the window. There are three layers of fallback, because a
background film can fail in more ways than most things:

* No video set → the poster image is used instead.
* "Reduce motion" is on → the poster, again. A silently looping film is exactly
  what that setting is asking you not to do.
* The video URL is wrong or won't play → it falls back to the poster the moment
  the browser says so, rather than showing a black rectangle.
* Nothing set at all → a dashed "Add hero video" frame.

So it is worth setting the poster even when there is a video.

The strip along the bottom is six cells, one per prayer, showing the jama'ah —
and whichever prayer is next is underlined in gold. On a phone the six become
one row you can flick sideways, because six cells across 360px is not enough
room for "Maghrib" with a time under it. **With no times typed in, a visitor
sees no strip at all** rather than six dashes, which would look like something
failing to load.

**2. Welcome** — who the centre is, in two paragraphs, beside one upright
picture cut to the arch. The picture is its own setting, not part of the hero,
because the two want completely different photographs: the hero wants the room
full, and this wants the front of the building. On a phone the picture goes
first — it says where you are faster than the paragraph does.

**3. Prayer times** — the full timetable, with Jumu'ah beside it. The same six
rows as the strip in the hero, out of the same stored list, so there is exactly
one timetable on this site and no way for two copies of it to disagree. See
[Prayer times](#prayer-times).

**4. Services** — up to six tiles, each an arch, read straight out of the same
list the table on /services is built from. Add a service in edit mode and it
appears here too, in the same order, with no second place to remember. The grid
is sized to how many there are: three across at three or more, two at two, and
at one the tile turns on its side and takes the full width.

**5. Featured event** — the next one coming up, given the full width: image,
category, date, a display-size headline, and Read more. With nothing upcoming
it falls back to the most recent event that has been, because an old event
reads better than an empty section. An event happening *today* still counts as
upcoming.

**6. Upcoming strip** — the next four after that, as cards. They fade in one
after another, 0.1s apart. It is a plain CSS grid with a 64px gap: nothing
slides sideways, nothing scrolls on its own. It is also built for however many
events there actually are — see **When there isn't much content yet** below.

**7. Values** — six words: Prayer, Qur'an, Knowledge, Family, Service,
Belonging. On a desktop this section **pins**: it sticks to the screen and each
word takes over in turn as you keep scrolling, crossfading over 0.6s. Six words
means the page scrolls six screens while nothing appears to move except the
words.

GSAP's ScrollTrigger does the pinning and tells the page which word it is on.
The crossfade itself is an ordinary CSS transition, so it runs on exactly the
same signature curve as everything else rather than on GSAP's own easing.

On a phone none of that happens — pinning on a touch screen fights the scroll
and leaves people stuck — so the same six words become six stacked panels you
simply scroll past. Same again for anyone who has asked for reduced motion.

Each word, each line underneath it, and each background image is separately
editable.

**8. Recent clips** — three short films across, each opening full size in a
lightbox when you click it. The tiles never play by themselves: each one is a
still with a play mark over it, and the film only loads when somebody asks for
it. A grid with the same 64px gap, not a carousel. **While there are no clips,
the section is not on the site at all.**

**9. Full-width film** — the break between the clips and the donate band. See
**The full-width films** below.

**10. Donate** — the one large area of colour in the body of a page, and the
last thing on every page on the site. The arch is drawn across it, the same
outline as the hero, so the top and the bottom of the page answer each other.
It carries `data-cursor="invert"`, so the cursor turns pale for as long as it
is over it.

### Why the big bands are navy and not gold

Gold is the decoration colour here — hairlines, arches, 12px labels. A whole
screen of it is both loud and, with words on top of it, unreadable: the logo
gold measures 3.27:1 against white text. The donate band, the donate page's own
hero, the menu, the footer and the loading panel are all `--brand`, which keeps
them the same colour as each other and leaves the gold to do the one job it is
good at.

Gold *is* used as a fill in one place: `.btn--on-band`, the button on a navy
band, which is pale gold with navy lettering on it at 7.7:1.

### Editing the homepage

Eight chips, all in edit mode:

* **Prayer times** — on the hero, beside the timetable, on the prayer times
  page and in the footer. It is reachable from four places because it is the
  one thing on this site somebody comes back to change on a schedule.
* **Jumu'ah** — on the Friday panel.
* **Hero video & poster** — on the hero itself.
* **Welcome picture** — beside the welcome paragraph.
* **Manage services** — under the service tiles, and again on the Services page.
* **Manage events** — in the footer and beside the featured event. Each event
  has a **Category**, which is the small gold label on its card.
* **Manage clips** — beside the Recent clips heading. With no clips yet, the
  section only appears in edit mode, with an "Add a clip" button in it.
* **Backgrounds for the six words** — one image or video per value. Any left
  blank show flat colour, which is a perfectly good look.
* **Change this film** — under the full-width film.

Every single piece of text on the page has a `data-copy` key, including the
word "Scroll" on the hero and each of the six values words and lines.

---

## The full-width films

Built to the spec's measurements: a `<figure>` at **33:20** running the whole
width of the screen, with the film inside it cropped to fill.

**The film has no `autoplay`.** It starts when it scrolls into view and pauses
the moment it leaves. That is deliberate and it is the reason a page can carry
three films without the fan coming on — a film three screens further down costs
nothing until you reach it.

There are two of them, both edited from the chip beside them:

* **Behind the services heading** on Services. Darkened automatically so
  the heading over it stays readable.
* **The break on the homepage**, between the clips and the donate band.
  Nothing sits on top of this one, so the footage is shown as it is.

Each takes three things: the film, a **poster image**, and a line describing
what the footage shows for anyone using a screen reader.

**Set the poster.** It is what is shown while the film downloads, what is shown
if the film fails, and what is shown *instead of* the film to anyone who has
asked their device to reduce motion. With a film and no poster, edit mode tells
you so in small type beside the chip.

---

## Prayer times

The most-visited page on any mosque's website, and the only thing on this site
that somebody comes back to change on a schedule. It has its own page at
`/prayer-times`, a strip across the bottom of the hero, the full table on the
homepage, and the compact version at the foot of Contact.

**All four are the same six stored rows.** There is exactly one timetable on
this site and no way for two copies of it to disagree.

### They are typed in, not calculated

This is a decision, not a shortcut. It would be perfectly possible to work the
times out in the browser from a latitude and a calculation method, and it would
be the wrong thing to do:

* A mosque's **jama'ah** times are a decision the imam makes, not an
  astronomical fact.
* They get rounded, they hold steady for a fortnight at a time, they move for
  Ramadan, and they are what is printed on the door.
* A calculated timetable that disagrees with the door is worse than no
  timetable at all — somebody misses a prayer because of it.

The website's job is to show the same numbers as the door. So it is one box you
type into, and the times are stored and displayed exactly as typed. See
**Updating the prayer times** near the top of this file.

### The "next prayer" highlight

Whichever prayer is next is underlined in gold, in the hero strip and in the
table, and it updates on the minute — lined up with the clock, not on a plain
60-second timer, so it can never be up to a minute late.

It is **entirely optional decoration**. The browser makes one attempt to read
each time and silently skips anything it cannot, and every time is already
printed in the page — so with JavaScript broken or a time typed in a way it
doesn't recognise, you get a correct timetable with no highlight on it rather
than a wrong one.

Sunrise is never highlighted; it is a time of day, not a prayer. After Isha the
highlight moves to tomorrow's Fajr, which is the earliest time on the page.

### Empty states

| What is set | What a visitor sees |
|---|---|
| Nothing at all | **No strip on the hero**, and an empty-state note where the table is |
| Some of the six | The full table, with `—` in the cells you have not filled in |
| No Jumu'ah times | No Friday panel at all |

An empty strip of six dashes across the hero would look like something failing
to load, which is why a visitor gets no strip instead. In edit mode it is
always there, with a way in.

---

## Services

Four parts: an opening, a full-width film carrying the table's two-line
heading, the hover-image table, and the week underneath it.

### The hover-image table

One row per service, built to fixed measurements rather than to anything
invented on the day:

| | |
|---|---|
| Row height | **59.5px** |
| Service name | **17px**, uppercase |
| Type | small, uppercase, in `--accent` |
| Picture | **17:19**, **18%** of the row's width |

A row is two columns and nothing else — name on the left, type on the right.
The description you write is stored, but on a desktop it is not shown: a row is
one line tall and anything else in it would break that. It appears on a phone,
where the rows become cards and there is room to read it.

**The hover is not CSS `:hover`.** The page puts `is-active is-hover` on the
row on mouseenter and takes them off on mouseleave, and every visual change
hangs off those two classes — the black band, the white text, the picture
appearing. That is how the reference does it, and it is what lets a JavaScript
animation loop drive the picture at the same time without the browser's own
hover state fighting it.

What happens when a row lights up:

* The row turns **black, edge to edge** — past the page's margins, right to
  both sides of the screen — and all of its text turns white, including the
  type.
* Its picture fades up and **trails the cursor** sideways. It moves 12% of the
  remaining distance to the cursor on every frame, so it never quite catches up
  — which is what makes it feel weighted rather than stuck to the pointer.
* It is clamped to the row, so it can never hang off either end.

A service with no picture yet is the one place on the site that does **not**
show a dashed placeholder to visitors. Everywhere else, a missing picture
leaves a hole — here it doesn't: the row still lights up black with white text
and simply has no picture. In edit mode the dashed frame is there, because that
is where a gap needs to be visible.

Moving from one row to the next **crossfades**, and the picture does not jump:
the position is shared by every row and is never reset, so the outgoing picture
fades out exactly where the incoming one fades in. There is no code for the
crossfade at all — it is two 0.4s CSS transitions happening to overlap.

The animation loop stops itself 0.6s after the pointer leaves the table, so a
page you are not touching is not running a loop.

### On a phone

Below **768px** the hover is gone completely — the page attaches no listeners
and runs no loop. Each row becomes a card with its picture already showing
above the name, the type and the description. There is no cursor to follow, so
there is nothing to run.

### The week

A list under the table: a day, a time and what happens, one line each. It is
stored as a list rather than as page text because the number of lines changes.

In edit mode the whole thing is **one box**, a line per row, columns separated
by a bar:

```
Monday to Thursday | 5.00 – 7.00pm | Children's madrasah
Saturday | 10.00am – 1.00pm | Qur'an class for adults
```

The headings and the note underneath are ordinary editable text.

### Editing the services

**Manage services** opens the list. Each row has **up and down arrows** — they
swap it with its neighbour and renumber the whole list from 1, so the order
numbers can never end up with two the same. The first row's up arrow and the
last row's down arrow are greyed out.

The six services there now — Daily Prayers, Jumu'ah, Qur'an Classes, Funerals
& Janazah, Marriages, Community Support — are **placeholders** from
`data/seed.json`. Edit them, or delete them and add your own. The first six in
this list are also the tiles on the homepage, so the order you put them in here
is the order they appear there.

---

## Events

Two pages: the list of everything at `/events`, and one page per event at
`/events/<the-slug>`.

### Nothing ever has to be moved when it passes

This is the one thing to understand about how events work here, because it is
what you will otherwise spend your life doing on a hand-maintained site.

An event has a **date**, and that is all. There is no "upcoming" tick box, no
"archive this" button, and no ordering number. Every time the page is drawn it
compares each event's date with today and puts it in the right group:

- **Upcoming** — today or later, soonest first.
- **Been and gone** — before today, most recent first.

So the morning after a talk, the talk is in the second group. Nobody did
anything. You will never log in to tidy the list up.

The only consequence worth knowing: the date is the whole truth, so an event
with the date left blank will not be in either group properly. Always set one.

### The listing page

The heading carries a **live count** of how many events there are, and the
count is real — add one and it goes up, on the heading and in the menu.

Under it is a row of **category buttons** with their own counts. Pressing one
filters the page **without reloading anything**: the cards that don't match are
hidden, the grids resize themselves to however many are left, a group with
nothing in it disappears, and all the counts update. Press "All" to come back.

Each card shows the picture, the category in blue, the date, the headline and
"Read more". The cards fade in one after another as they come into view, a
tenth of a second apart.

### One event's page

Top to bottom:

- The **hero picture**, full width and landscape (33:20 — the same shape as the
  full-width films).
- The category, then the headline, then the summary.
- **Date, time and where**, as a short list.
- The body text.
- Down the right-hand side: the **square poster** and the **sign-up button**.
- At the bottom, links to the **previous and next** event.

Two things about that right-hand column:

**The poster is a different picture from the hero,** and the two are treated
differently on purpose.

The **hero** is a wide band across the top of the page, and it **crops** — a
picture put there is filled into a 33:20 strip, so its top and bottom are
trimmed. That is right for a photograph and wrong for anything with words on
it. Use a photo here.

The **poster** is the event's own graphic — the thing you'd send someone on
WhatsApp. It sits in an upright 2:3 frame and is **never cropped**: whatever
shape it is, the whole thing is shown, with any leftover space filled in pale
blue like a mount. Upright is the normal shape for these and works best, but a
square or a wide one is fine too.

So: if you have an event poster with the date and the venue written on it, it
goes in the **poster** box, not the picture box. Put it in the picture box and
the middle third of it appears as a strip with the words sliced off.

Leave the poster blank and nothing is missing; the hero carries the page on
its own.

**Nothing in that column is compulsory.** If an event has no poster and no
sign-up link, the column does not exist and the writing runs the full width of
the page — rather than leaving a 340px hole beside it.

The sign-up button only appears when a sign-up link is set, and it opens in a
new tab. That link can be anything: Google Forms, Eventbrite, a WhatsApp group
invite.

Previous and next step through **the whole timeline**, upcoming and past
together, rather than staying inside one group. Walking off the end of what's
coming and into what has been is exactly the right thing for them to do.

### Featured

One event can be **featured**, and that is the one shown large at the top of
the homepage. Tick the box on the event you want there.

If nothing is ticked, the homepage falls back to the soonest upcoming event on
its own — so the homepage is never empty, and you only need the tick box when
you want to override that. If there is nothing upcoming at all it shows the
most recent past one.

The tick only counts on **upcoming** events. A past event with it still ticked
is ignored and quietly stops being featured once its date goes by, which is
the same principle as everything else here: the date decides, not a flag you
have to remember to untick.

### Categories

The starting five are **Talk, Activity, Trip, Fundraiser and Community**.

They are **suggestions, not a fixed list**. The category box in the edit form
offers the ones already in use as you type, but you can type anything else and
it becomes a category — a new filter button appears for it on the listing page
by itself. Stop using one and its button goes away. Nothing needs to be
registered anywhere.

### Editing events

Three ways in, all in edit mode:

- **"Add event"** on the listing page — straight into a blank form.
- **The pencil on one event's page** — edits that event.
- **"Manage events"** — the full list, with an edit and a delete on each.

The form has every field: slug, title, category, date, time, location,
summary, body, hero picture, poster, sign-up link, featured, and published.
Untick published to take an event off the site without deleting it.

Deleting the event you happen to be reading is fine: the page turns into
"we could not find that event" with a link back to the list, rather than
breaking.

The three events in there now — An Evening With…, Half-Term Football and Summer
Camp 2026 — are **placeholders** from `data/seed.json`. Summer Camp has a past
date on purpose, so you can see what the "been and gone" group looks like.
Delete all three once there are real ones.

---

## Donate

The donation page, at `/donate`. The "Donate" button in the header, the
band at the bottom of the homepage, the menu and the footer all point here.

### Nothing to do with money happens on this site

Worth saying plainly, because it is the most important thing about this page
and it is invisible.

Every donate button is **a link to somewhere else** — a Stripe payment page or
our LaunchGood campaign. No card number is ever typed into this website, no
Stripe key is stored in it, and there is no payment code anywhere in the
project. Someone presses a button here and Stripe takes over on Stripe's own
page.

That is why setting all this up is seven boxes of text and nothing more, and
why there is nothing here that could leak a card number: there is never one to
leak.

### The page, top to bottom

1. **The hero band**, in the brand navy with the arch drawn across it — the
   same colour and the same shape as the band that sent people here, so
   arriving feels like the same room.
2. **The intention** — a reminder to make one, and then the hadith
   "Actions are according to intentions, and everyone will get what was
   intended" (Bukhari & Muslim), set large as a pull quote.
3. **One-time** — one prominent button. Sadaqah, zakat or a one-off gift.
4. **Monthly** — five amounts: £5, £10, £25, £50 and £100, each its own card
   with its own button.
5. **LaunchGood** — set apart in its own panel, because it is somebody else's
   platform rather than another amount on the same ladder.
6. **The small print** about the centre's status — see below, and **read that
   part before you launch**.
7. **Other ways to help** — volunteering, sponsoring a day, equipment, lending
   a trade. All four are editable text.

### Setting up the links

Edit mode, then **"Donation links"** at the bottom of the page. Seven boxes:
the one-time link, the LaunchGood campaign, and one for each of the five
monthly amounts.

The Stripe ones are **payment links** — the kind that look like
`https://buy.stripe.com/…`, made in the Stripe dashboard under *Payment
links*. The five monthly ones want to be recurring links. Paste the whole
address including the `https://`.

**An empty box hides its button.** That is the rule everywhere on this page:

| What is set | What a visitor sees |
|---|---|
| Three of the five monthly amounts | Three cards, filling the row — no gap where the other two would be |
| No one-time link | No One-time section at all |
| No LaunchGood link | No LaunchGood panel |
| Nothing at all | The heading, the intention, the hadith and the other ways to help |

A button that goes nowhere is worse than no button, so there is never one.

In **edit mode** you see all five amounts whatever is set, with a note on each
empty one saying it is hidden from visitors — so you can see at a glance what
is still to be filled in. Visitors never see those notes.

Every donate link opens in a new tab and carries `rel="noopener"`, which stops
the page being opened from being able to reach back into this one.

### The small print, and why you cannot edit it

> **CHECK THIS BEFORE YOU LAUNCH.** The wording on the page says the centre is
> a registered non-profit and is **not** registered with HMRC as a charity, so
> there is no Gift Aid and donations are not tax-deductible. That is the safe
> default, and it may well be wrong for Taiba. Somebody who knows the centre's
> actual registration has to read it and say.

The paragraph on the page that says so is the one piece of writing on the whole
site that **cannot be edited from edit mode**. It has no `data-copy` attribute,
so there is nothing to click on and nothing to overwrite.

That is deliberate. Everything else here can be reworded in a hurry by whoever
is logged in; this is a claim about a **legal status**, and Gift Aid in
particular is a claim about somebody else's tax. Getting it wrong by pasting in
a sentence that sounded right is not a typo.

Changing it is a two-line edit in `app.js` — search for `support-legal` — done
deliberately, with whoever runs the centre looking at it. If Taiba **is** a
registered charity, that is where the charity number goes and where a Gift Aid
line would belong.

### Changing the amounts

The five monthly amounts are written down in two places, and **both have to
match**:

- `DONATE_TIERS` near the top of `renderDonate()` in `app.js` — what the page
  shows.
- `DONATE_TIERS` in `api/settings.js` — what the server will agree to store.

They are deliberately not shared between the two. One of those files runs in
the browser and the other runs on the server, and sharing a file between them
would mean adding a build step, which this site does not have and is better
without.

---

## Google, WhatsApp and screen readers

Three different audiences, and mostly the same handful of things serve all of
them.

### What Google sees

Every page has its own **title** and **description**, and both can be rewritten
from inside the site: edit mode → **Page titles & descriptions** in the footer.
There is a box for each page. Leave one empty and the wording written into the
site is used instead.

* **Title** — around 60 characters before Google starts cutting it off. Don't
  write "— Taiba Islamic Centre" on the end; it is added for you.
* **Description** — the grey sentence under the blue link. Around 155
  characters.

An **event's page is not in that list**, on purpose. It takes its title from the
event's title, its description from the event's summary and its picture from the
event's picture — so there is no second copy of any of it to fall out of step.

### sitemap.xml and robots.txt

`/sitemap.xml` is the list of every page, **rebuilt each time it is asked for**.
Add an event and it is in the sitemap; delete one and it is gone; untick
"published" and it drops out. Nothing to maintain.

`robots.txt` is a small static file at the root of the project. It lets
everything be indexed except `/api/` and the development-only `/foundations`
page, and it points at the sitemap.

One thing to know: the fixed pages are listed **by hand** in `api/sitemap.js`.
If a new page is ever added to the site, add it there too. The events are
automatic; the pages are not, because the real list of pages lives in `app.js`,
which runs in the browser and cannot be read from a server function.

### What WhatsApp sees

When somebody pastes a link to this site into WhatsApp, iMessage, Slack or X,
the card that comes up is built from the **Open Graph tags**, which the site
rewrites for every page.

* **An event's link** shows the event's picture, title and summary.
* **Every other page** shows the **sharing picture**, set once in
  *Page titles & descriptions*. Landscape, around 1200×630 — that is the shape
  all of those platforms crop to.

Set the sharing picture. Without one, every link to the site comes up as text
on a grey box, and that is the single most visible piece of polish on this
list.

### Screen readers and keyboards

* **Every picture box has an alt-text box beside it.** One sentence describing
  what is in the picture. Blank is correct for a picture that is purely
  decorative; blank is *not* correct for a photo of an event.
* **The whole site works from the keyboard.** Tab moves through it, and
  whatever has focus has a visible blue ring around it. The first thing Tab
  reaches on any page is a "Skip to content" link.
* **The service table works without a mouse.** On a desktop the picture in
  that table follows the cursor — which is no use at all if you haven't got
  one. Tabbing onto a row lights it up exactly as hovering does, and parks the
  picture rather than trailing it, because there is nothing to trail.
* **A service's description is read out on a desktop even though it isn't
  shown.** The desktop row is two columns by design, so the description is
  hidden from the eye but left in the page for a screen reader. Hiding it
  properly would have meant a sentence about each service that only existed
  for people on a phone.

### Colour contrast

Every text-and-background pair on the site was measured against the WCAG AA
threshold (4.5:1 for normal text). Everything passes. Two things had to change
to get there, and both are worth not undoing:

* **The caption grey.** It was 45% black, which measured 3.10:1 — and it is the
  colour the *smallest* text on the site is set in, so it was the worst place
  to be short. It is now 60%, at 5.07:1. The token is `--ink-60`.
* **Blue text on the pale blue wash** (the LaunchGood panel, the "add a
  picture" placeholders) measured 4.15:1, because the wash is blue too and eats
  most of the difference. Those use `--accent-on-wash`, the deeper blue, at
  6.31:1.

One thing does not pass, and is left deliberately: while a service row is
**mid-way through** its 0.4s hover fade, the text is briefly the same
brightness as the band coming in behind it. Both ends of that animation are
fine — 4.72:1 before, 19.8:1 after — and it is inherent to crossfading between
dark-on-light and light-on-dark. It is not a state anything measures, and
"fixing" it would mean a worse-looking interaction.

### Speed

Measured with Lighthouse, mobile, on a simulated slow connection:

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Homepage | 95 | 100 | 100 | 100 |
| What's On | 94 | 100 | 100 | 100 |
| One event | 97 | 100 | 100 | 100 |
| Services | 96 | 100 | 100 | 100 |
| Donate | 97 | 100 | 100 | 100 |

Nothing shifts as the page loads (a layout-shift score of 0 on every page), and
nothing blocks the first tap (0ms of blocking time).

Three decisions are doing most of that work, and all three are easy to undo by
accident:

* **The font stylesheet does not block the page.** It is loaded with the
  `media="print"` trick in `index.html`. An ordinary `<link rel=stylesheet>` to
  somebody else's server held the first paint for 811ms, for 927 bytes.
* **The animation libraries are only fetched where they are used** — see *The
  vendor folder*.
* **The hero film is not fetched until the page has finished loading.** It has
  no `autoplay` attribute and `preload="none"`; `app.js` starts it on the
  window's `load` event. The poster image carries the hero until then, so
  nobody sees a gap.

---

## The logo, and the icons made from it

### Every file is built from one file

`assets/logo-source.png` is the artwork exactly as the client supplied it: navy
and gold on white, with a thin frame round the edge. Everything else in
`assets/` is generated from it by one script, so replacing the artwork is
**one file and one command**.

| File | What it is |
|---|---|
| `assets/logo-source.png` | THE MASTER. Nothing on the site loads it. |
| `assets/mark-dark.png` | The arch on its own, navy + gold, for the parchment page |
| `assets/mark-light.png` | The same arch reversed — white lines, pale gold inside — for navy |
| `assets/logo-dark.png` | The complete stacked logo: arch, TAIBA, ISLAMIC CENTRE and the rule |
| `assets/logo-light.png` | The same, reversed out for a dark background |
| `assets/logo-square-dark.png` | 1080 × 1080, the whole logo centred, in colour |
| `assets/logo-square-light.png` | 1080 × 1080, **the arch alone**, in white — the icon master |

They are named after the colour of the **artwork**, not the background it goes
on. Every one is trimmed tight, with no transparent margin, and that is not
fussiness: the header sizes the logo by its height, so a file with padding
baked in would draw the artwork smaller inside that height and there would be
no way to get it back from CSS.

### Why the header does not use a picture of the wordmark

The header shows `mark-dark.png` — the arch — and then sets **"TAIBA / ISLAMIC
CENTRE" as live text** beside it, in the heading serif with the logo's own
tracking.

The supplied artwork is 627px wide, which leaves those two words about 14px
tall in it. That is plenty for the stacked logo on the loading panel, where it
is drawn large, and nowhere near enough for crisp lettering in a 36px header on
a retina screen — a picture of it is soft at every size that matters. Type is
sharp on any screen, scales with the layout, can be selected, and is read by a
search engine as the name of the organisation instead of as a rectangle.

The picture therefore carries `alt=""`: it would otherwise say the name a
second time, immediately after the text that already says it. The link around
the whole lockup has the accessible name on it.

Where each one is used:

* **Header** — the light arch while the bar is transparent over a dark hero,
  the dark one the rest of the time. `app.js` swaps the `src`; the height is
  fixed in CSS so the swap cannot move the layout by a pixel.
* **Footer** — the light lockup, because the footer is navy.
* **Preloader** — the complete stacked logo, reversed, because it sits on the
  navy panel and there is room to draw it properly.

### The icons

Seven files in the project root, all generated:

```
favicon.ico              16 + 32 + 48, for the browser tab
favicon-16/32/48.png     the same three on their own
icon-192.png             Android home screen
icon-512.png             Android splash, and the app listing
icon-maskable-512.png    Android again, with room to be cropped round
apple-touch-icon.png     iPhone and iPad home screen
site.webmanifest         the file that ties them together
```

Every one is **the arch in white on a solid navy tile**. That is deliberate
four times over:

* A transparent icon is composited **on black** by iOS, so dark artwork
  vanishes completely.
* A dark browser tab strip does the same to a dark logo.
* The navy tile is recognisable at 16 pixels even when the fine gold lines
  inside the arch are not, which is most of what a favicon has to do.
* It is the **arch alone and not the whole logo**, because at 32 pixels
  "ISLAMIC CENTRE" is four grey smudges while an arch is still an arch.

### Rebuilding the logo and the icons

Only needed when the artwork changes. Save the new artwork over
`assets/logo-source.png` — on white, any size, and the bigger the better — then
from the website folder:

```bash
npm run logos
```

That runs both scripts in order: `make-logos.py` finds the frame, the ink and
the gap under the arch on its own and rewrites all six logo files, then
`make-icons.py` rebuilds the seven icons from the new arch. No installing
anything first — both use only what Python already has.

If the arch's proportions change, update the `width` and `height` written into
`brandMark()` in `app.js` and into the preloader in `index.html`. They are not
the size it is drawn at — they are there so the browser can reserve the right
shape before the picture arrives, which is what stops the header jumping as the
page loads.

Then **hard-refresh** to see the new favicon: Shift and click reload, or ⌘⇧R on
a Mac. Browsers hold on to an old favicon harder than almost anything else, so
a normal refresh will show you the old one and make you think it hasn't worked.

---

## When there isn't much content yet

This is worth reading properly, because it is the difference between a site
that looks new and a site that looks broken.

A layout designed around a hundred articles and fifty photographs, holding
three events and no photographs at all, has holes in it — and a hole in a grid
does not read as "there are only three of these", it reads as "something failed
to load". This site launches with about three events, six services and no
pictures.

So every grid on the site is built for **the number of things that actually
exist**, and none of them ever renders an empty cell.

### The events strip on the homepage

The featured event above takes one, so this holds up to four. It counts them
and uses exactly that many columns — the cards grow to fill the row instead of
leaving a gap where a fourth would be. The picture changes shape with them,
which matters more than it sounds: 17:19 is upright and right for a narrow
card, and the same shape at half the width of a screen is a wall.

| Cards | Desktop | Picture | Tablet | Phone |
|---|---|---|---|---|
| 4 | 4 columns | 17:19 upright | 2 × 2 | stacked |
| 3 | 3 columns | 17:19 upright | stays 3 | stacked |
| 2 | 2 columns | 16:9 landscape | stays 2 | stacked |
| 1 | the card turns on its side — picture left, words right, full width | 16:9 landscape | same | stacked |
| 0 | no section at all | — | — | — |

Three cards stay three on a tablet rather than folding to two, because folding
them would leave the third one alone with a gap beside it. That is the whole
rule in one line: **never leave a hole**.

Once it is stacked on a phone the shape stops changing — every card is the
full width of the screen whatever the count, so every picture is 17:19. Two
different shapes down a single column would look like a mistake rather than a
decision.

At zero the section simply is not on the page — the featured event above it is
the whole of what's on, which is an honest thing for a page to say. In edit
mode it stays visible with an "Add another event" button, because a section
that hides itself is also a section you can never add anything to.

### Recent clips

| Clips | Layout | Tile shape |
|---|---|---|
| 3 or more | three across | 17:19 upright |
| 2 | side by side | 16:9 landscape |
| 1 | one tile, full width | 33:20 — the same shape as the full-width films |
| 0 | the section is not on the site | — |

### The service tiles on the homepage

| Services | Layout | Tile shape |
|---|---|---|
| 3 or more | three across (the first six only) | 4:5 upright, in the arch |
| 2 | side by side | 4:5 upright |
| 1 | one tile on its side, picture beside the words | 16:9 landscape |
| 0 | the section is not on the site | — |

### The service table

Fine at three rows, and fine at thirty. A table is one of the few layouts that
does not care how long it is: it has a rule above it and a rule under every
row, so three of them read exactly as deliberately as a full page of them. At
zero it shows a written explanation of what a row is, not a blank space. It
ships with six placeholder services so it is never empty on a new site.

### The prayer timetable

The one grid on the site that is **always the same six rows**, whether or not
anybody has typed anything into them — see [Prayer times](#prayer-times). A
mosque that has filled in only Fajr gets a complete table with five rows
waiting in it, rather than one lonely row that looks like the page is broken.

### Everywhere else

Every picture and every film on the site that hasn't been added yet shows a
**dashed frame with the name of what belongs there**. Nothing is a hole. That
includes the hero, the welcome picture, the service tiles, the event images,
the six values backgrounds, both full-width films and the service row
pictures.

---

## The /foundations page

Visit **<http://localhost:3000/foundations>** to see all of the above on one
page: the palette, the accent alternatives side by side, the full type scale,
the spacing steps, the cursor over light and dark areas, and staggered reveals.
It also lists which values are most worth tuning.

**It is a development page.** It isn't linked from anywhere, but it is reachable
by anyone who types the address. Delete `renderFoundations()` and its line in
`ROUTES` before the site goes live.

---

## The vendor folder

The site has no build step, and the browser can't load a package straight out of
`node_modules` — which isn't committed to git anyway. So the one file we actually
need from each library is copied into `vendor/`, which **is** committed:

```
vendor/lenis.min.js
vendor/gsap.min.js
vendor/ScrollTrigger.min.js
```

**They are not loaded by `index.html` any more.** `app.js` fetches them itself,
and only when they will actually be used — which means on a desktop, with a
mouse, with motion not turned down. On a phone none of the three does anything
(Lenis is deliberately off on touch, and the only pinned section is the desktop
values), so loading them there was 117KB of JavaScript sent to do nothing.
See `loadMotionLibraries()` in `app.js`.

They're copied automatically every time you run `npm install`, so upgrading a
library is just:

```bash
npm install lenis@latest
```

and the file in `vendor/` updates itself. Never edit anything in `vendor/` by
hand — the next `npm install` will overwrite it.

## What isn't built yet

Honest list, so nothing is a surprise later:

* **One page is still a placeholder: About.** It has its heading, its opening
  line and its editable keys, and no sections under them. It is the one page
  whose words only the centre can write, so it is left for you. Everything
  else — the homepage, prayer times, Services, the events listing, one event's
  page, Donate and Contact — is real.
* **Check the location.** The hero says "Edgware · London" and the page
  descriptions say Edgware. That was an assumption, not something anybody
  confirmed. The hero line is editable text (click it in edit mode); the page
  descriptions are edit mode → **Page titles & descriptions**.
* **The donation small print says the centre is not a registered charity.**
  That is the safe default and it may be wrong. See *The small print, and why
  you cannot edit it* — it has to be checked before launch, and it is changed
  in the code on purpose.
* **The prayer times in the box are placeholders**, roughly right for London in
  the middle of the year and wrong today. Replace all of them on day one.
* **A service's description is not shown on a desktop.** The row is two
  columns by design — name and type — so the line you write only appears on a
  phone. If you want it on the desktop row too, say so: it is a few lines.
* **All the real media.** Every picture and film on the site is a URL you paste
  in, and every one of them currently shows its dashed placeholder. Nothing
  needs doing to the code first.
* **The sharing picture is not set.** Until you put one in (edit mode →
  **Page titles & descriptions** → *Sharing picture*), a link to the site
  pasted into WhatsApp comes up with text and no picture. An event's own
  picture is used on its own page regardless, so this only affects the other
  six pages.
* **Two people editing at the same time.** The site saves a whole section at a
  time, so two saves within a few seconds of each other means the second wins
  and the first is quietly lost. Nothing is corrupted. For one editor this is
  fine; it would need real locking to fix.
* **Delete before launch:** `renderFoundations()` in `app.js` and its line in
  the `ROUTES` list, and the `Disallow: /foundations` line in `robots.txt`. It
  is the design-system page, and it is development only.

---

## The first hour, in order

If you do nothing else, do these, in this order. Everything here is done from
inside the site with no code and no deploy.

1. **The prayer times.** Edit mode → **Prayer times**. Then **Jumu'ah**.
2. **The address, the phone number and the email.** Edit mode → **Contact
   details & social links** in the footer. Until the address is in, the footer
   and the Contact page both say so.
3. **The hero line.** Click "Edgware · London" and make it right.
4. **The services.** Six placeholders are in there. Edit, reorder or delete
   them — the first six are also the homepage tiles.
5. **One real event**, so the homepage has something true on it. Delete the
   three placeholders as you go.
6. **A hero picture and a welcome picture.** Two Cloudinary URLs and the site
   stops looking like a template. See *Getting a Cloudinary URL for a picture*.
7. **The sharing picture**, so a link pasted into WhatsApp comes up with
   something. Edit mode → **Page titles & descriptions** → *Sharing picture*.

---

## A note on safety

A few things in here look fussy and are worth leaving alone:

* **Every** value that gets put on the page goes through `esc()` first. That is
  what stops saved text from being able to run as code.
* Links and image sources go through `safeUrl()` / `cleanUrl()`, which only
  allow `http:`, `https:`, `mailto:` and `tel:`.
* The login cookie is **httpOnly**, meaning the page itself cannot read it —
  only the server can. That's why the site asks `/api/auth` whether it's logged
  in rather than checking the cookie directly.
* Every route that changes data calls `requireAuth` first. Hiding a button is
  never the security; the server check is.
