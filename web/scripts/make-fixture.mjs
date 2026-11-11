import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as pause } from "node:timers/promises";
const dir = new URL("../public/data/", import.meta.url);
for (const file of ["meta.json", "head.json", "art.json", "mood-scores.bin"]) {
  try {
    await readFile(new URL(file, dir));
    console.log("Data already exists; fixture skipped.");
    process.exit(0);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
const cards = [];
let url =
  "https://api.scryfall.com/cards/search?q=game%3Apaper+-is%3Afunny&unique=art&order=released&dir=desc";
while (url && cards.length < 340) {
  const response = await fetch(url, {
    headers: { "User-Agent": "VorthosFixture/1.0", Accept: "application/json" },
  });
  if (!response.ok) throw Error(`Scryfall ${response.status}`);
  const page = await response.json();
  cards.push(...page.data);
  url = page.next_page;
  await pause(120);
}
const meta = {
  generated: "fixture",
  n: 0,
  artists: [],
  sets: [],
  types: [
    "Creature",
    "Land",
    "Instant",
    "Sorcery",
    "Enchantment",
    "Artifact",
    "Planeswalker",
    "Battle",
    "Token",
    "Other",
  ],
  subjects: [
    "Landscape",
    "Creature",
    "Portrait",
    "Battle",
    "Magic",
    "Object",
  ].map((label) => ({ key: label.toLowerCase(), label, count: 0 })),
  moods: ["Serene", "Dark", "Wonder", "Fierce", "Joyful", "Melancholy"].map(
    (label) => ({ key: label.toLowerCase(), label, count: 0 }),
  ),
};
const art = {
  n: 0,
  id: [],
  face: [],
  name: [],
  artist: [],
  set: [],
  type: [],
  subject: [],
  moods: [],
  hsl: [],
  pal: [],
};
for (const card of cards.slice(0, 340)) {
  const face = card.image_uris ? card : card.card_faces?.[0];
  if (!face?.image_uris?.art_crop) continue;
  const artist = face.artist || card.artist || "Unknown";
  let ai = meta.artists.findIndex((x) => x[0] === artist);
  if (ai < 0) {
    ai = meta.artists.length;
    meta.artists.push([
      artist,
      artist.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      0,
    ]);
  }
  meta.artists[ai][2]++;
  let si = meta.sets.findIndex((x) => x[0] === card.set);
  if (si < 0) {
    si = meta.sets.length;
    meta.sets.push([
      card.set,
      card.set_name,
      Number(card.released_at.slice(0, 4)),
    ]);
  }
  const i = art.n++,
    subject = i % meta.subjects.length,
    mask = (1 << (i % 6)) | (1 << ((i + Math.floor(i / 7)) % 6));
  meta.subjects[subject].count++;
  meta.moods.forEach((m, j) => {
    if (mask & (1 << j)) m.count++;
  });
  art.id.push(card.id);
  art.face.push(0);
  art.name.push(face.name);
  art.artist.push(ai);
  art.set.push(si);
  art.type.push(
    Math.max(
      0,
      meta.types.findIndex((x) => face.type_line?.includes(x)),
    ),
  );
  art.subject.push(subject);
  art.moods.push(mask);
  art.hsl.push((i * 137) % 360, 30 + (i % 50), 20 + (i % 55));
  art.pal.push("5e7165", "b3aa8c", "303c39");
}
const artistOrder = meta.artists
  .map((a, i) => ({ a, i }))
  .sort((a, b) => b.a[2] - a.a[2] || a.a[0].localeCompare(b.a[0]));
const artistMap = new Map(artistOrder.map((x, i) => [x.i, i]));
meta.artists = artistOrder.map((x) => x.a);
art.artist = art.artist.map((i) => artistMap.get(i));
meta.n = art.n;
const head = Object.fromEntries(
  Object.entries(art).map(([key, value]) => [
    key,
    key === "n"
      ? Math.min(120, art.n)
      : value.slice(0, (key === "hsl" || key === "pal" ? 3 : 1) * 120),
  ]),
);
const scores = Uint8Array.from({ length: art.n * meta.moods.length }, (_, i) =>
  art.moods[Math.floor(i / meta.moods.length)] & (1 << (i % meta.moods.length))
    ? 120 + (i % 136)
    : 0,
);
await mkdir(dir, { recursive: true });
// Exclusive creation prevents this helper from overwriting a pipeline file.
for (const [file, value] of [
  ["art.json", JSON.stringify(art)],
  ["head.json", JSON.stringify(head)],
  ["mood-scores.bin", scores],
  ["meta.json", JSON.stringify(meta)],
]) {
  try {
    await writeFile(new URL(file, dir), value, { flag: "wx" });
  } catch (e) {
    if (e.code === "EEXIST") {
      console.log("Pipeline file exists; stopped without overwriting.");
      process.exit(0);
    }
    throw e;
  }
}
console.log(
  `Created ${art.n} real artworks. Mood, subject and colour values are fixture-only.`,
);
