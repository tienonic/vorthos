import assert from 'node:assert/strict';
import {CACHE,readJSON,writeJSON,openDB,imageURL}from'./common.mjs';
import {FEATURE_VERSION}from'./prompts.mjs';
const catalog=readJSON(`${CACHE}/catalog.json`),ids=new Set(catalog.map(x=>x.illustration)),db=openDB(true);
let embeddings=0,minNorm=Infinity,maxNorm=0;
for(const row of catalog)assert.equal(row.url.split('?')[0],imageURL(row),'Source art URL must follow the public contract');
for(const row of db.prepare('SELECT illustration,embedding FROM results WHERE version=?').iterate(FEATURE_VERSION)) {
  if(!ids.has(row.illustration))continue;
  assert.equal(row.embedding.byteLength,512*4);const v=new Float32Array(row.embedding.buffer,row.embedding.byteOffset,512);let squared=0;
  for(const x of v){assert(Number.isFinite(x));squared+=x*x;}const norm=Math.sqrt(squared);assert(Math.abs(norm-1)<.00001);minNorm=Math.min(minNorm,norm);maxNorm=Math.max(maxNorm,norm);embeddings++;
}
db.close();const result={checked_at:new Date().toISOString(),catalog:catalog.length,source_urls_match_contract:true,embeddings,dimensions:512,float_bytes:4,minNorm,maxNorm};writeJSON(`${CACHE}/embedding-audit.json`,result);console.log(JSON.stringify(result));
