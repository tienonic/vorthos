# Vorthos art pipeline

Run these commands from `pipeline/` with Node 22. The pipeline writes only the four contracted files to `../web/public/data/`. It keeps source data, models, normalized 512-float image embeddings, checkpoints and receipts in `cache/`.

```sh
npm ci
node prepare.mjs
node run.mjs sample
node export.mjs sample
node examples.mjs sample
node validate.mjs sample
./start-full.sh
```

`prepare.mjs` downloads Scryfall's `unique_artwork` bulk source. It handles the current compressed JSON Lines feed and the older JSON array feed. It expands real card faces, uses each face's name and artist, and deduplicates illustration IDs. It prefers non-art-series cards and better scans. It retains unique art-series fronts and omits their signature/credit backs. It selects 300 artworks across release years. Use `--refresh` for a new source, or `--refresh --reuse-source` to rebuild the catalog from the saved dump.

`run.mjs sample|full` downloads at most eight images at once, computes an OKLab palette and CPU CLIP embedding, and commits each finished batch to SQLite. It resumes by illustration ID and feature version. It keeps only sample images; full-run images stay in memory until processed. Network retries back off and open a circuit after repeated server failures. The runner pauses above 90°C until below 80°C, or while less than 1.2 GiB memory is available. It stops below 100 GiB free disk. `VORTHOS_THREADS` controls inference threads (default 4); `VORTHOS_BATCH` controls batch size (maximum 8).

`prompts.mjs` defines 12 moods and 11 subjects. `model-prepare.mjs` updates the cached text embeddings after prompt changes. Image embeddings survive prompt changes; rerun the export without downloading images again.

`export.mjs sample|full` builds `meta.json`, `art.json`, `head.json` and `mood-scores.bin`. It refuses incomplete or stale-feature exports. It averages cosine scores across prompt phrasings, subtracts 40% of each image's mean mood similarity to reduce general fantasy-style bias, and calibrates each mood by its empirical percentile. A score byte is a within-mood percentile strength, not a probability. A byte threshold of 214 selects approximately the top 16% before the strongest-four cap. Subjects use the highest mean image-text cosine score. Exported records sort by release date, newest first; set years use the earliest selected release for that set.

`examples.mjs sample|full` prints ten examples per mood and subject with Scryfall and art URLs. A sample subject with fewer than ten assigned works includes clearly marked candidates. The sample command also makes six image review sheets in `cache/`.

`validate.mjs sample|full` reads the actual exported files, checks lengths, ranges, metadata counts, source order, head contents, score bytes and gzip size, and fetches 20 seeded random art URLs, including back faces. `--offline` skips URL requests. It writes receipts and file hashes to `cache/validation.json` and the mode's validation file.

`audit.mjs` checks that source URLs follow the public URL rule and that every saved image embedding has 512 finite floats with unit norm. It writes `cache/embedding-audit.json`.

`report.mjs` writes `RESULT.md` from the current receipts. `start-full.sh` runs the full pipeline in the detached `vorthos-pipeline` tmux session (with a nohup/setsid fallback) and exports, validates, prints examples and updates the report when processing ends. It does not install a recurring job or timer.

```sh
cat cache/progress.json
tail -f cache/full.log
node --test test.mjs
```

To resume an interrupted full run and produce the final data:

```sh
./start-full.sh
```

To export an already completed run:

```sh
node export.mjs full
node validate.mjs full
node examples.mjs full > cache/full-examples-console.txt
node audit.mjs
node report.mjs
```

The public data contains no model weights, source dumps, downloaded images or embeddings. Add neither `cache/` nor `node_modules/` to a commit. Scryfall supplies the source and image URLs; image rights remain with their owners.
