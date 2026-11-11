import fs from 'node:fs';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import crypto from 'node:crypto';
import { inScope, CACHE, OUTPUT, readJSON, writeJSON, imageURL, fetchRetry, headers, TYPES, typeIndex } from './common.mjs';
import { MOODS, SUBJECTS } from './prompts.mjs';
export async function validate(mode='full', online=true) {
  const meta=readJSON(`${OUTPUT}/meta.json`),art=readJSON(`${OUTPUT}/art.json`),head=readJSON(`${OUTPUT}/head.json`),bytes=fs.readFileSync(`${OUTPUT}/mood-scores.bin`);
  const catalog=inScope(readJSON(`${CACHE}/${mode==='sample'?'sample':'catalog'}.json`));
  const fields=['id','face','name','artist','set','type','subject','moods','hsl','pal'];
  function shape(table,n) {
    assert.deepEqual(Object.keys(table).sort(),['n',...fields].sort());assert.equal(table.n,n);
    for(const key of fields)assert.equal(table[key].length,n*(['hsl','pal'].includes(key)?3:1),`${key} length`);
    const bounds={artist:meta.artists.length,set:meta.sets.length,type:meta.types.length,subject:meta.subjects.length,face:2};
    for(const [key,bound] of Object.entries(bounds))for(const x of table[key])assert(Number.isInteger(x)&&x>=0&&x<bound,`${key} index ${x}`);
    for(const id of table.id)assert.match(id,/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
    for(const mask of table.moods){assert(Number.isInteger(mask)&&mask>=0&&mask<(1<<meta.moods.length));assert(mask.toString(2).replaceAll('0','').length<=4);}
    for(let i=0;i<table.hsl.length;i++)assert(Number.isInteger(table.hsl[i])&&table.hsl[i]>=0&&table.hsl[i]<=(i%3===0?359:100));
    for(const hex of table.pal)assert.match(hex,/^[0-9a-f]{6}$/);
  }
  const n=meta.n;assert.equal(n,catalog.length);shape(art,n);shape(head,Math.min(120,n));assert.deepEqual(meta.types,TYPES);
  assert.deepEqual(meta.moods.map(x=>x.key),MOODS.map(x=>x.key));assert.deepEqual(meta.subjects.map(x=>x.key),SUBJECTS.map(x=>x.key));
  assert(meta.moods.length<=16&&meta.subjects.length<=16);assert.equal(bytes.length,n*meta.moods.length);
  assert.equal(new Set(catalog.map(x=>x.illustration)).size,n);
  for(let i=0;i<n;i++) {
    assert.equal(art.id[i],catalog[i].id);assert.equal(art.face[i],catalog[i].face);assert.equal(art.name[i],catalog[i].name);assert.equal(meta.artists[art.artist[i]][0],catalog[i].artist);assert.equal(meta.sets[art.set[i]][0],catalog[i].set);assert.equal(art.type[i],typeIndex(catalog[i].type_line));
    if(i)assert(catalog[i-1].released>=catalog[i].released,'newest release first');
  }
  for(const key of fields)assert.deepEqual(head[key],art[key].slice(0,head.n*(['hsl','pal'].includes(key)?3:1)));
  for(let i=0;i<meta.artists.length;i++){assert.equal(meta.artists[i][2],art.artist.filter(x=>x===i).length);if(i)assert(meta.artists[i-1][2]>=meta.artists[i][2]);}
  assert.equal(new Set(meta.artists.map(x=>x[1])).size,meta.artists.length);
  for(let m=0;m<meta.moods.length;m++) {const count=art.moods.filter(x=>x&(1<<m)).length;assert.equal(meta.moods[m].count,count);assert(count/n>=.08&&count/n<=.20,`mood coverage ${meta.moods[m].key}: ${count/n}`);}
  for(let m=0;m<meta.subjects.length;m++)assert.equal(meta.subjects[m].count,art.subject.filter(x=>x===m).length);
  const gzipBytes=gzipSync(fs.readFileSync(`${OUTPUT}/art.json`),{level:9}).length;assert(gzipBytes<4000000,`gzip ${gzipBytes} exceeds 4 MB`);
  let nonemptyPairs=0, nonemptyTriples=0;
  for(let a=0;a<meta.moods.length;a++)for(let b=a+1;b<meta.moods.length;b++) {
    const pair=(1<<a)|(1<<b);nonemptyPairs+=Number(art.moods.some(x=>(x&pair)===pair));
    for(let c=b+1;c<meta.moods.length;c++){const triple=pair|(1<<c);nonemptyTriples+=Number(art.moods.some(x=>(x&triple)===triple));}
  }
  assert(nonemptyPairs>33,`Only ${nonemptyPairs}/66 mood pairs overlap`);assert(nonemptyTriples>110,`Only ${nonemptyTriples}/220 mood triples overlap`);
  for(let i=0;i<n;i++)for(let m=0;m<meta.moods.length;m++)if(art.moods[i]&(1<<m))assert(bytes[i*meta.moods.length+m]>=214,'Mask and byte strength disagree');
  const checks=[];
  if(online) {
    // Seeded, reproducible random selection; include up to four random back faces.
    let seed=0x564f5254;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2**32;};
    const indexes=new Set(),backs=art.face.map((f,i)=>f?i:-1).filter(i=>i>=0);
    for(let j=0;j<Math.min(4,backs.length);j++)indexes.add(backs[Math.floor(random()*backs.length)]);
    while(indexes.size<Math.min(20,n))indexes.add(Math.floor(random()*n));
    const queue=[...indexes];
    for(let offset=0;offset<queue.length;offset+=8) {
      const block=await Promise.all(queue.slice(offset,offset+8).map(async i=>{
        const url=imageURL({id:art.id[i],face:art.face[i]});const response=await fetchRetry(url,{method:'GET',headers:{'User-Agent':headers['User-Agent'],Accept:'image/jpeg'}});
        const status=response.status,body=Buffer.from(await response.arrayBuffer());assert.equal(status,200);assert(body.length>100,`empty image ${url}`);return {index:i,name:art.name[i],face:art.face[i],url,status,bytes:body.length};
      }));checks.push(...block);
    }
  }
  const hashes=Object.fromEntries(['meta.json','art.json','head.json','mood-scores.bin'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(`${OUTPUT}/${f}`)).digest('hex')]));
  const report={mode,n,passed:true,checked_at:new Date().toISOString(),arrays:true,indexes:true,hsl_pal:true,head_prefix:true,unique_illustrations:true,newest_first:true,mood_coverage:true,max_four_moods:true,nonempty_pairs:nonemptyPairs,nonempty_triples:nonemptyTriples,score_bytes:bytes.length,art_gzip_bytes:gzipBytes,image_checks:checks,sha256:hashes};
  const receipt=online?'validation':'validation-offline';
  writeJSON(`${CACHE}/${receipt}.json`,report);writeJSON(`${CACHE}/${mode}-${receipt}.json`,report);
  console.log(JSON.stringify(report,null,2));return report;
}
if(process.argv[1]?.endsWith('/validate.mjs'))await validate(process.argv[2]||'full',!process.argv.includes('--offline'));
