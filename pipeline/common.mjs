import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const CACHE = path.join(ROOT, 'cache');
export const OUTPUT = path.resolve(ROOT, '../web/public/data');
fs.mkdirSync(CACHE, {recursive:true});
export const headers = {'User-Agent':'vorthos-pipeline/0.1 (public MTG art gallery)', Accept:'application/json'};
export const sleep = ms => new Promise(r=>setTimeout(r,ms));
export function writeJSON(file, obj) { fs.writeFileSync(`${file}.tmp`,JSON.stringify(obj)); fs.renameSync(`${file}.tmp`,file); }
export function readJSON(file) { return JSON.parse(fs.readFileSync(file,'utf8')); }
export function imageURL(row) { return `https://cards.scryfall.io/art_crop/${row.face ? 'back' : 'front'}/${row.id[0]}/${row.id[1]}/${row.id}.jpg`; }
let consecutiveServerErrors=0, cooldownUntil=0;
export async function fetchRetry(url, options={}) {
  for(let attempt=0; attempt<4; attempt++) {
    if (Date.now()<cooldownUntil) await sleep(cooldownUntil-Date.now());
    let response;
    try { response=await fetch(url,{...options,signal:AbortSignal.timeout(60000)}); }
    catch(e) { if(attempt===3) throw e; await sleep(1000*2**attempt); continue; }
    if(response.ok) { consecutiveServerErrors=0; return response; }
    const status=response.status; await response.body?.cancel();
    if(status!==429 && status<500) throw Error(`HTTP ${status}: ${url}`);
    consecutiveServerErrors++;
    const retry=Number(response.headers.get('retry-after'));
    if(consecutiveServerErrors>=8) { cooldownUntil=Date.now()+120000; throw Error(`Circuit open after repeated HTTP ${status}; cool down for 120s`); }
    if(attempt===3) throw Error(`HTTP ${status} after four attempts: ${url}`);
    await sleep(Math.max(Number.isFinite(retry)?retry*1000:0,1000*2**attempt));
  }
}
export function openDB(readOnly=false) {
  const db=new DatabaseSync(`${CACHE}/checkpoint.sqlite`, {readOnly});
  if(!readOnly) {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS results (illustration TEXT PRIMARY KEY, version TEXT NOT NULL, result TEXT NOT NULL, embedding BLOB NOT NULL); CREATE TABLE IF NOT EXISTS failures (illustration TEXT PRIMARY KEY, error TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL);');
  }
  return db;
}
export const TYPES=['Creature','Land','Instant','Sorcery','Enchantment','Artifact','Planeswalker','Battle','Token','Other'];
export function typeIndex(line) { return TYPES.indexOf(['Token','Planeswalker','Battle','Creature','Land','Instant','Sorcery','Enchantment','Artifact'].find(t=>new RegExp(`\\b${t}\\b`).test(line)) || 'Other'); }
