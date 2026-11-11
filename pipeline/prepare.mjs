import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import readline from 'node:readline';
import streamJson from 'stream-json';
import streamArray from 'stream-json/streamers/StreamArray.js';
import { CACHE, headers, fetchRetry, writeJSON } from './common.mjs';

export function artworks(card) {
  if (card.digital && card.image_status === 'placeholder') return [];
  const faces = card.card_faces?.some(f => f.image_uris?.art_crop)
    ? card.card_faces.map((f, face) => ({ ...f, face }))
    : [{ ...card, ...card.card_faces?.[0], illustration_id: card.illustration_id || card.card_faces?.[0]?.illustration_id, image_uris: card.image_uris, face: 0 }];
  return faces.filter(f => f.illustration_id && f.image_uris?.art_crop && !(card.layout === 'art_series' && f.face > 0)).map(f => ({
    illustration: f.illustration_id, id: card.id, face: f.face,
    name: f.name, artist: f.artist || card.artist || 'Unknown',
    set: card.set, set_name: card.set_name, released: card.released_at,
    type_line: f.type_line || card.type_line || '',
    url: f.image_uris.art_crop, scryfall: card.scryfall_uri,
    art_series: card.layout === 'art_series', digital: !!card.digital,
    quality: card.image_status === 'highres_scan' ? 2 : card.highres_image ? 1 : 0,
  }));
}
export function choose(a, b) {
  if (!a) return b;
  const rank = x => (x.art_series ? 0 : 100) + x.quality;
  if (rank(b) !== rank(a)) return rank(b) > rank(a) ? b : a;
  return b.released > a.released || (b.released === a.released && b.id < a.id) ? b : a;
}

async function main() {
  if (fs.existsSync(`${CACHE}/catalog.json`) && !process.argv.includes('--refresh')) {
    console.log('Using cached catalog; use --refresh to download a new source.'); return;
  }
  const savedSource = process.argv.includes('--reuse-source') && fs.existsSync(`${CACHE}/source.json`);
  const bulk = savedSource ? null : await (await fetchRetry('https://api.scryfall.com/bulk-data', { headers })).json();
  const source = savedSource ? JSON.parse(fs.readFileSync(`${CACHE}/source.json`, 'utf8')) : bulk.data.find(x => x.type === 'unique_artwork');
  if (!source) throw Error('No unique_artwork source');
  writeJSON(`${CACHE}/source.json`, source);
  const url = source.jsonl_download_uri || source.download_uri;
  const compressed = !!source.jsonl_download_uri;
  const file = `${CACHE}/unique-artwork.${compressed ? 'jsonl.gz' : 'json'}`;
  if (!process.argv.includes('--reuse-source') || !fs.existsSync(file)) {
    console.log(`Downloading ${url}`);
    await pipeline(Readable.fromWeb((await fetchRetry(url, { headers })).body), fs.createWriteStream(`${file}.part`));
    fs.renameSync(`${file}.part`, file);
  }
  const byId = new Map(); let cards = 0, noArt = 0, duplicates = 0;
  function accept(card) {
    cards++;
    const rows = artworks(card); if (!rows.length) noArt++;
    for (const row of rows) { if (byId.has(row.illustration)) duplicates++; byId.set(row.illustration, choose(byId.get(row.illustration), row)); }
  }
  if (compressed) {
    const lines = readline.createInterface({ input: fs.createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of lines) if (line.trim()) accept(JSON.parse(line));
  } else {
    const rows = fs.createReadStream(file).pipe(streamJson.parser()).pipe(streamArray.streamArray());
    for await (const { value } of rows) accept(value);
  }
  const catalog = [...byId.values()].sort((a,b) => b.released.localeCompare(a.released) || a.illustration.localeCompare(b.illustration));
  writeJSON(`${CACHE}/catalog.json`, catalog);
  // Equal-spaced positions inside each release-year stratum; round-robin gives all years a voice.
  const years = new Map();
  for (const row of catalog) { const y = row.released.slice(0,4); if (!years.has(y)) years.set(y, []); years.get(y).push(row); }
  const groups = [...years].sort(([a],[b]) => a.localeCompare(b)).map(([year,rows]) => ({year,rows,n:0}));
  for (let i=0; i<300; i++) { const eligible = groups.filter(g=>g.n<g.rows.length); eligible[i%eligible.length].n++; }
  const selected = new Set(groups.flatMap(g => Array.from({length:g.n}, (_,i) => g.rows[Math.floor((i+0.5)*g.rows.length/g.n)].illustration)));
  const sample = catalog.filter(x=>selected.has(x.illustration));
  writeJSON(`${CACHE}/sample.json`, sample);
  writeJSON(`${CACHE}/catalog-stats.json`, {cards,artworks:catalog.length,noArt,duplicates,source:source.updated_at,sample:sample.length,years:groups.map(g=>[g.year,g.rows.length,g.n])});
  console.log(JSON.stringify({cards,artworks:catalog.length,noArt,duplicates,sample:sample.length}));
}
if (process.argv[1]?.endsWith('/prepare.mjs')) main().catch(e=>{console.error(e);process.exitCode=1;});
