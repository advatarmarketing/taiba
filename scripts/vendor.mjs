/**
 * Copies the browser builds of our two libraries out of node_modules and into
 * /vendor, where the browser can load them with a plain <script> tag.
 *
 * WHY THIS EXISTS: this site has no build step. The browser cannot load a
 * package straight out of node_modules, and node_modules is not committed to
 * git — so the one file we actually need from each library is copied into
 * /vendor, which IS committed.
 *
 * It runs automatically after `npm install` (see "postinstall" in
 * package.json), so upgrading a library is just:
 *     npm install lenis@latest
 * and the file in /vendor updates itself. You should never edit /vendor by hand.
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'vendor');

/* Each entry: the file inside the package, and what to call it in /vendor. */
const FILES = [
  ['lenis/dist/lenis.min.js',        'lenis.min.js'],
  ['gsap/dist/gsap.min.js',          'gsap.min.js'],
  ['gsap/dist/ScrollTrigger.min.js', 'ScrollTrigger.min.js'],
];

await mkdir(OUT, { recursive: true });

const versions = [];
for (const [from, to] of FILES) {
  const pkg = from.split('/')[0];
  const source = path.join(ROOT, 'node_modules', from);
  await copyFile(source, path.join(OUT, to));
  // Read the package.json as a file: some packages (lenis) don't let you
  // import it by name.
  const { version } = JSON.parse(
    await readFile(path.join(ROOT, 'node_modules', pkg, 'package.json'), 'utf8')
  );
  versions.push(`${to}  ←  ${pkg}@${version}`);
  console.log(`vendor: ${to}  (${pkg}@${version})`);
}

/* A note in the folder, so it is obvious these files are copies. */
await writeFile(
  path.join(OUT, 'README.txt'),
  [
    'These files are COPIES, made automatically by scripts/vendor.mjs.',
    'Do not edit them by hand — `npm install` will overwrite whatever you change.',
    'To upgrade a library, run npm install and commit the updated file.',
    '',
    ...versions,
    '',
  ].join('\n'),
  'utf8'
);
