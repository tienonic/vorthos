import fs from 'node:fs';
import os from 'node:os';
import { CACHE, headers, readJSON, writeJSON, openDB, fetchRetry, sleep } from './common.mjs';
import { FEATURE_VERSION } from './prompts.mjs';
import { imageEncoder, textPrototypes } from './model.mjs';
import { colors } from './color.mjs';

const mode=process.argv[2] || 'sample';
if(!['sample','full'].includes(mode)) throw Error('Usage: node run.mjs sample|full');
const lock=`${CACHE}/run.lock`;
try { const fd=fs.openSync(lock,'wx');fs.writeSync(fd,String(process.pid));fs.closeSync(fd); }
catch(e) {
  const pid=Number(fs.readFileSync(lock,'utf8'));
  try {process.kill(pid,0);throw Error(`Pipeline is already running with PID ${pid}`);}catch(error) {if(error.code!=='ESRCH')throw error;}
  fs.unlinkSync(lock);fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
}
const logFile=fs.createWriteStream(`${CACHE}/pipeline.log`,{flags:'a'});
const log=(message)=>{const line=`${new Date().toISOString()} ${mode} ${message}`;console.log(line);logFile.write(`${line}\n`);};
let stopping=false;
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
let db,encoder;
let rows=[],done=0,failed=0,processed=0,inferenceMs=0,downloadMs=0,colorMs=0,start=Date.now(),inferenceStart=0;
function progress(state='running') {
  const elapsed=(Date.now()-(inferenceStart||start))/1000,rate=processed/Math.max(1,elapsed),remaining=rows.length-done;
  writeJSON(`${CACHE}/progress.json`,{mode,state,pid:process.pid,done,total:rows.length,failed,rate,eta_seconds:rate?Math.round(remaining/rate):null,expected_finish:rate?new Date(Date.now()+remaining/rate*1000).toISOString():null,updated:new Date().toISOString(),started:new Date(start).toISOString(),session_processed:processed,inference_ms:inferenceMs,download_wall_ms:downloadMs,color_wall_ms:colorMs});
}
function temperature() {
  const hw='/sys/class/hwmon';
  for(const dir of fs.readdirSync(hw))try {if(fs.readFileSync(`${hw}/${dir}/name`,'utf8').trim()==='k10temp')return Number(fs.readFileSync(`${hw}/${dir}/temp1_input`,'utf8'))/1000;}catch{}
  return null;
}
async function guard() {
  let heatPause=temperature()>90;
  while(!stopping) {
    const mem=Number(fs.readFileSync('/proc/meminfo','utf8').match(/MemAvailable:\s+(\d+)/)[1])*1024;
    const temp=temperature();
    if(heatPause && temp<80)heatPause=false;
    if(!heatPause && temp>90)heatPause=true;
    const disk=fs.statfsSync(CACHE);if(disk.bavail*disk.bsize<100*1024**3)throw Error('Less than 100 GiB free disk; stopping safely.');
    if(!heatPause && mem>=1.2*1024**3)return;
    log(`Paused: temperature=${temp}C available_memory=${Math.round(mem/1024**2)}MiB`);progress('paused');await sleep(30000);
  }
}
async function downloadBatch(batch) {
  const t=Date.now();
  const results=await Promise.all(batch.map(async row=>{
    try {
      const sampleFile=`${CACHE}/sample-images/${row.illustration}.jpg`;
      const buffer=fs.existsSync(sampleFile)?fs.readFileSync(sampleFile):Buffer.from(await (await fetchRetry(row.url,{headers:{'User-Agent':headers['User-Agent'],Accept:'image/jpeg'}})).arrayBuffer());
      if(mode==='sample') {fs.mkdirSync(`${CACHE}/sample-images`,{recursive:true});fs.writeFileSync(sampleFile,buffer);}
      return {row,buffer};
    } catch(e) {return {row,error:String(e)};}
  }));downloadMs+=Date.now()-t;return results;
}
try {
  rows=readJSON(`${CACHE}/${mode==='sample'?'sample':'catalog'}.json`);
  db=openDB();
  const existing=new Set(db.prepare('SELECT illustration FROM results WHERE version=?').all(FEATURE_VERSION).map(x=>x.illustration));
  const pending=rows.filter(x=>!existing.has(x.illustration));done=rows.length-pending.length;
  const previous=fs.existsSync(`${CACHE}/progress.json`)?readJSON(`${CACHE}/progress.json`):null;
  if(!pending.length && previous?.mode===mode && previous?.state==='complete' && previous?.total===rows.length) {
    log(`All ${rows.length} artworks are cached; no image download or inference needed.`);
  } else {
  progress('loading');log(`${done}/${rows.length} cached; ${pending.length} pending on ${os.cpus().length} logical cores`);
  await guard();await textPrototypes();encoder=await imageEncoder();inferenceStart=Date.now();
  const save=db.prepare('INSERT OR REPLACE INTO results VALUES (?,?,?,?)');
  const failure=db.prepare('INSERT INTO failures VALUES (?,?,1,?) ON CONFLICT(illustration) DO UPDATE SET error=excluded.error, attempts=attempts+1, updated=excluded.updated');
  const clearFailure=db.prepare('DELETE FROM failures WHERE illustration=?');
  const batchSize=Math.min(8,Math.max(1,Number(process.env.VORTHOS_BATCH || 8)));
  let downloaded=downloadBatch(pending.slice(0,batchSize));
  for(let offset=0;offset<pending.length && !stopping;offset+=batchSize) {
    await guard();if(stopping)break;
    const batch=await downloaded;
    // One lookahead batch bounds concurrent downloads at eight and overlaps network with CPU work.
    downloaded=offset+batchSize<pending.length && !stopping?downloadBatch(pending.slice(offset+batchSize,offset+2*batchSize)):Promise.resolve([]);
    const valid=batch.filter(x=>!x.error);
    for(const bad of batch.filter(x=>x.error)){failed++;failure.run(bad.row.illustration,bad.error,new Date().toISOString());log(`Download failed ${bad.row.name}: ${bad.error}`);}
    if(valid.length) {
      let t=Date.now();const embeddings=await encoder.encode(valid.map(x=>x.buffer));inferenceMs+=Date.now()-t;
      t=Date.now();const palettes=await Promise.all(valid.map(x=>colors(x.buffer)));colorMs+=Date.now()-t;
      db.exec('BEGIN IMMEDIATE');
      try {
        for(let i=0;i<valid.length;i++){save.run(valid[i].row.illustration,FEATURE_VERSION,JSON.stringify(palettes[i]),Buffer.from(embeddings[i].buffer));clearFailure.run(valid[i].row.illustration);}
        db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
      done+=valid.length;processed+=valid.length;
    }
    progress();if(offset===0 || Math.floor(offset/batchSize)%10===0)log(`${done}/${rows.length}; ${(processed/((Date.now()-inferenceStart)/1000)).toFixed(2)} art/s; CPU ${temperature()}C`);
  }
  await downloaded;
  const state=stopping?'interrupted':failed?'incomplete':'complete';progress(state);log(`${state}: ${done}/${rows.length}; failures=${failed}`);
  if(state!=='complete')process.exitCode=1;
  }
} catch(e) {log(`ERROR ${e.stack || e}`);progress('failed');process.exitCode=1;}
finally {await encoder?.dispose();db?.close();logFile.end();fs.unlinkSync(lock);}
