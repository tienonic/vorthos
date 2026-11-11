# Data contract

The pipeline writes these files to `web/public/data/`. The web app reads only these files. Change this file first if the shape must change, and say so in RESULT.md.

One record is one unique artwork (Scryfall `unique_artwork` bulk file, one entry per `illustration_id`). Records are ordered newest release first. Every array in `art.json` has length `n` and shares that order.

## meta.json

```json
{
  "generated": "2026-11-10",
  "n": 58000,
  "artists": [["Rebecca Guay", "rebecca-guay", 153]],
  "sets": [["lea", "Limited Edition Alpha", 1993]],
  "types": ["Creature", "Land", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Battle", "Token", "Other"],
  "subjects": [{"key": "landscape", "label": "Landscape", "count": 9000}],
  "moods": [{"key": "serene", "label": "Serene", "count": 7000}]
}
```

`artists` rows are `[name, slug, count]`, sorted by count descending. `sets` rows are `[code, name, year]`. At most 16 moods and 16 subjects.

## art.json (columnar)

```json
{
  "n": 58000,
  "id":      ["scryfall card uuid"],
  "face":    [0],
  "name":    ["Card or face name"],
  "artist":  [12],
  "set":     [3],
  "type":    [0],
  "subject": [2],
  "moods":   [5],
  "hsl":     [210, 40, 35],
  "pal":     ["1b2a41", "c9a227", "e8e4d9"]
}
```

- `face`: 0 front, 1 back. Image URL: `https://cards.scryfall.io/art_crop/{front|back}/{id[0]}/{id[1]}/{id}.jpg`.
- `artist`, `set`, `type`, `subject`: indexes into the `meta.json` lists.
- `moods`: bitmask over `meta.moods` (bit i = mood i). An artwork can have zero to four moods.
- `hsl`: flat array of length `3n`: hue 0–359, saturation 0–100, lightness 0–100 of the dominant colour.
- `pal`: flat array of length `3n`: three palette colours per artwork as hex without `#`, most dominant first.

## head.json

Same shape as `art.json` for the first 120 records only, so the first screen paints before the full index arrives.

## mood-scores.bin

`n × meta.moods.length` unsigned bytes, row-major, 0–255 strength of each mood for each artwork. Loaded only on Discover.
