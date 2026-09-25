/**
 * Clips — short films for the "Recent clips" grid on the homepage.
 *
 *   GET     public → { items: [...] }
 *   POST    admin  → add one
 *   PUT     admin  → update one by id, or replace the whole list
 *   DELETE  admin  → remove the one at ?id=
 *
 * A clip is a video URL, a still to show before anyone presses play, and a
 * title. Clicking a tile opens the film full size in a lightbox; the tiles
 * themselves never play on their own, so a page of them costs nothing.
 *
 * The homepage section hides itself entirely when this list is empty, so there
 * is no half-finished grid on the site before the first clip is added.
 */

import { collectionRoute } from '../lib/collection.js';
import { clean, cleanUrl } from '../lib/http.js';

export default collectionRoute({
  key: 'clips',
  idPrefix: 'clip',

  sanitize: (clip) => ({
    id: clip.id,
    title: clean(clip.title, 140),
    /* The film itself — an .mp4 or .webm. Without one the tile shows its
       "add a video" placeholder rather than disappearing, so a half-filled
       record is visibly half-filled instead of silently missing. */
    videoUrl: cleanUrl(clip.videoUrl),
    /* The still shown on the tile. Strongly recommended: without it the tile
       has to load the film's first frame to have anything to show. */
    posterUrl: cleanUrl(clip.posterUrl),
    /* Described to screen readers, which cannot watch the film. */
    alt: clean(clip.alt, 200),
    published: clip.published !== false,
    order: Number.isFinite(Number(clip.order)) ? Number(clip.order) : 0,
  }),
});
