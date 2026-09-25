THE LOGO FILES

Every one of these is built by  python3 scripts/make-logos.py  from a single
file — logo-source.png, the artwork exactly as the client supplied it. Do not
edit them by hand: change the source and run the script again.

  logo-source.png        THE MASTER. Navy and gold on white, with a thin frame
                         round the edge. Nothing on the website loads it.

  mark-dark.png          THE ARCH ON ITS OWN, navy + gold, for the pale page
  mark-light.png         the same arch reversed out — white lines, pale gold
                         inside — for a navy background

  logo-dark.png          the COMPLETE stacked logo: arch, TAIBA, ISLAMIC
                         CENTRE and the diamond rule, as supplied
  logo-light.png         the same, reversed out for a dark background

They are named after the colour of the ARTWORK, not the background it sits on.

  logo-square-dark.png   1080 x 1080, the complete logo centred, in colour.
                         The right file for a social media profile picture.
  logo-square-light.png  1080 x 1080, THE ARCH ALONE, in white. Nothing on the
                         site uses it directly — it is the master the app
                         icons are built from.


WHY THE HEADER DOES NOT USE A PICTURE OF THE WORDMARK

It uses mark-dark.png (or mark-light.png over a dark hero) and then sets
"TAIBA / ISLAMIC CENTRE" as LIVE TEXT beside it, in the same serif as the
headings. See brandMark() in app.js.

The supplied artwork is 627px wide, which leaves "ISLAMIC CENTRE" about 14px
tall. That is plenty for the stacked logo on the loading panel, and nowhere
near enough for crisp lettering in a 36px header on a retina screen — a
picture of it is soft at every size that matters. Live text is sharp, scales
with the layout, can be selected, and is read by a search engine as the name
of the organisation.

The loading panel and the footer still use the complete stacked file, because
both draw it large enough for the supplied resolution to hold up.


IF YOU REPLACE THE ARTWORK

1. Save the new artwork as logo-source.png — on white, any size, and the
   bigger the better. The script finds the frame, the ink and the gap under
   the arch on its own.
2. Run:  python3 scripts/make-logos.py
3. Run:  python3 scripts/make-icons.py
4. If the arch's proportions have changed, update the width and height
   written into brandMark() in app.js, and the preloader's in index.html.
   They are not the size it is drawn at — they are there so the browser can
   reserve the right shape before the picture arrives, which is what stops the
   header jumping as the page loads.
