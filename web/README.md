# Vorthos

A static gallery of Magic: The Gathering artwork. Next.js App Router, React, TypeScript, Tailwind and DM Sans. Requires Node 22 or newer.

```sh
npm ci
npm run dev
# http://localhost:3000/vorthos/
```

The current dataset contains 20,769 artworks and 644 artists (1993–2016). The pipeline owns `public/data/`. The app reads the four files described in `../docs/data-contract.md`. If there is no data yet, `npm run fixture` fetches a few hundred real Scryfall artworks. It uses exclusive file creation and stops if a destination exists. Fixture colours, subjects and moods are invented.

```sh
npm run build
npm start
# http://127.0.0.1:4186/vorthos/
```

`out/` contains the export. When `VERCEL` is set, the build defaults to the root path. Otherwise the default base path is `/vorthos`; set `NEXT_PUBLIC_BASE_PATH=''` for a root deployment, or set it to another path at both build and serve time. Data is fetched at runtime; a new pipeline dataset needs no code changes. Rebuild the export after updating source data to copy it into `out/data/`.

For GitHub Pages, copy `.github-pages.yml.txt` to the repository root as `.github/workflows/pages.yml`, enable Actions as the Pages source, and commit the real pipeline data. The workflow builds from `web/`. It does not run the pipeline or fixture script.

```sh
npm run check
npm run test:browser
npm run test:loading
npm run bench
```

Browser checks expect the export server on port 4186. They use Playwright with `/usr/bin/brave-browser`; override `BROWSER_PATH` for another Chromium executable and `TEST_URL` for another gallery URL. The benchmark creates 60,000 records under `.tmp/`, serves them through browser request interception, and removes them afterwards. It never writes synthetic data to `public/data/`. Results and screenshots go to `screenshots/`.

Filters and sorts run in `public/gallery-worker.mjs`, using `public/engine.mjs`. Numeric columns use typed arrays. `head.json` paints first; the full index is fetched and parsed by the worker. Only Moods requests mood strengths. `VirtualGrid` mounts visible rows plus overscan; artwork dialogs preserve the underlying scroll position. Shared views use URL query parameters, including `art=<uuid>&face=1` for back faces.

Reference measurements: `docs-measurements.json`. Re-capture them with `node scripts/measure-reference.mjs` followed by `node scripts/measure-reference-extras.mjs`. With the export server running, `node scripts/compare-browser.mjs` writes the six comparison pairs to `screenshots/compare/`. See `RESULT.md` for the visual differences retained and verification receipts.
