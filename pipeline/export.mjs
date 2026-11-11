import fs from 'node:fs';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { inScope, CACHE, OUTPUT, readJSON, writeJSON, openDB, TYPES, typeIndex } from './common.mjs';
import { FEATURE_VERSION, MODEL, MOODS, SUBJECTS } from './prompts.mjs';

export function calibrate(raw, n) {
  const count=MOODS.length, scores=Buffer.alloc(n*count), thresholds=[];
  for(let m=0;m<count;m++) {
    const sorted=Array.from({length:n},(_,i)=>({i,value:raw[i][m]})).sort((a,b)=>a.value-b.value||a.i-b.i);
    for(let start=0;start<n;) {
      let end=start+1;while(end<n && sorted[end].value===sorted[start].value)end++;
      const strength=Math.round(255*((start+end-1)/2)/(Math.max(1,n-1)));
      for(let j=start;j<end;j++)scores[sorted[j].i*count+m]=strength;
      start=end;
    }
    thresholds.push({key:MOODS[m].key,percentile:.84,centered_cosine:sorted[Math.min(n-1,Math.floor(n*.84))].value,byte:214});
  }
  const masks=Array.from({length:n},(_,i)=>{
    const selected=Array.from({length:count},(_,m)=>m).filter(m=>scores[i*count+m]>=214).sort((a,b)=>scores[i*count+b]-scores[i*count+a]||raw[i][b]-raw[i][a]||a-b).slice(0,4);
    return selected.reduce((mask,m)=>mask|1<<m,0);
  });
  return {scores,masks,thresholds};
}
function slug(s) {return s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'artist';}
export function buildExport(rows, features, prototypes) {
  const raw=[], subjects=[], subjectScores=[];
  for(const row of rows) {
    const v=features.get(row.illustration).embedding;
    const dots=prototypes.map(p=>p.reduce((s,x,j)=>s+x*v[j],0));
    const moodScores=dots.slice(0,MOODS.length),baseline=moodScores.reduce((a,b)=>a+b,0)/MOODS.length;
    raw.push(moodScores.map(s=>s-.4*baseline));
    const scores=dots.slice(MOODS.length);subjects.push(scores.indexOf(Math.max(...scores)));subjectScores.push(scores);
  }
  const n=rows.length,{scores,masks,thresholds}=calibrate(raw,n);
  const artistsCount=new Map();for(const x of rows)artistsCount.set(x.artist,(artistsCount.get(x.artist)||0)+1);
  const usedSlugs=new Set();
  const artists=[...artistsCount].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([name,count])=>{
    const root=slug(name);let s=root,k=2;while(usedSlugs.has(s))s=`${root}-${k++}`;usedSlugs.add(s);return [name,s,count];
  });
  const artistsIndex=new Map(artists.map((x,i)=>[x[0],i]));
  const setsMap=new Map();for(const x of rows) {
    const year=Number(x.released.slice(0,4)),old=setsMap.get(x.set);setsMap.set(x.set,[x.set,x.set_name,Math.min(year,old?.[2]||year)]);
  }
  const sets=[...setsMap.values()].sort((a,b)=>b[2]-a[2]||a[0].localeCompare(b[0]));
  const setsIndex=new Map(sets.map((x,i)=>[x[0],i]));
  const art={n,id:[],face:[],name:[],artist:[],set:[],type:[],subject:subjects,moods:masks,hsl:[],pal:[]};
  rows.forEach((row,i)=>{
    art.id.push(row.id);art.face.push(row.face);art.name.push(row.name);art.artist.push(artistsIndex.get(row.artist));art.set.push(setsIndex.get(row.set));art.type.push(typeIndex(row.type_line));
    const colors=features.get(row.illustration).colors;art.hsl.push(...colors.hsl);art.pal.push(...colors.pal);
  });
  const meta={generated:new Date().toISOString().slice(0,10),n,artists,sets,types:TYPES,subjects:SUBJECTS.map((s,m)=>({key:s.key,label:s.label,count:subjects.filter(x=>x===m).length})),moods:MOODS.map((s,m)=>({key:s.key,label:s.label,count:masks.filter(x=>x&(1<<m)).length}))};
  const head={n:Math.min(120,n)};for(const [key,val] of Object.entries(art))if(key!=='n')head[key]=val.slice(0,head.n*(['hsl','pal'].includes(key)?3:1));
  const histogram=Array(5).fill(0);for(const mask of masks)histogram[mask.toString(2).replaceAll('0','').length]++;
  const pairs=[],triples=[];
  for(let a=0;a<MOODS.length;a++)for(let b=a+1;b<MOODS.length;b++) {
    const mask=(1<<a)|(1<<b);pairs.push({moods:[MOODS[a].key,MOODS[b].key],count:masks.filter(x=>(x&mask)===mask).length});
    for(let c=b+1;c<MOODS.length;c++){const mask3=mask|(1<<c);triples.push({moods:[MOODS[a].key,MOODS[b].key,MOODS[c].key],count:masks.filter(x=>(x&mask3)===mask3).length});}
  }
  return {art,meta,head,scores,thresholds,histogram,pairs,triples,raw,subjectScores};
}
export function loadFeatures(rows) {
  const db=openDB(true),get=db.prepare('SELECT result,embedding FROM results WHERE illustration=? AND version=?'),features=new Map();
  for(const row of rows) {
    const saved=get.get(row.illustration,FEATURE_VERSION);if(!saved)throw Error(`Unprocessed artwork ${row.illustration} (${row.name}). Resume node run.mjs ${rows.length===300?'sample':'full'} first.`);
    const bytes=saved.embedding;const embedding=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
    features.set(row.illustration,{colors:JSON.parse(saved.result),embedding});
  }
  db.close();return features;
}
export function exportData(mode='full') {
  const rows=inScope(readJSON(`${CACHE}/${mode==='sample'?'sample':'catalog'}.json`));
  const text=readJSON(`${CACHE}/text-prototypes.json`);
  const expected=crypto.createHash('sha256').update(JSON.stringify({MODEL,MOODS,SUBJECTS,text_dtype:'fp32'})).digest('hex');
  if(text.hash!==expected)throw Error('Prompts changed: run node model-prepare.mjs before exporting. Cached images/embeddings remain valid.');
  const result=buildExport(rows,loadFeatures(rows),text.prototypes);
  fs.mkdirSync(OUTPUT,{recursive:true});
  const files={'art.json':JSON.stringify(result.art),'head.json':JSON.stringify(result.head),'meta.json':JSON.stringify(result.meta),'mood-scores.bin':result.scores};
  for(const [file,data] of Object.entries(files))fs.writeFileSync(`${OUTPUT}/${file}.tmp`,data);
  for(const file of ['mood-scores.bin','head.json','art.json','meta.json'])fs.renameSync(`${OUTPUT}/${file}.tmp`,`${OUTPUT}/${file}`);
  const summary={mode,n:rows.length,artists:result.meta.artists.length,sets:result.meta.sets.length,moods:result.meta.moods,subjects:result.meta.subjects,thresholds:result.thresholds,mood_centering:0.4,mood_histogram:result.histogram,pairs:result.pairs,triples:result.triples,nonempty_pairs:result.pairs.filter(x=>x.count).length,nonempty_triples:result.triples.filter(x=>x.count).length,art_bytes:Buffer.byteLength(files['art.json']),art_gzip_bytes:gzipSync(files['art.json'],{level:9}).length,generated:new Date().toISOString()};
  writeJSON(`${CACHE}/export-summary.json`,summary);writeJSON(`${CACHE}/${mode}-summary.json`,summary);
  console.log(JSON.stringify(summary,null,2));return result;
}
if(process.argv[1]?.endsWith('/export.mjs')) {try{exportData(process.argv[2] || 'full');}catch(e){console.error(e);process.exitCode=1;}}
