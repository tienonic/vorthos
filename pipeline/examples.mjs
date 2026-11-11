import fs from 'node:fs';
import sharp from 'sharp';
import { CACHE, readJSON, imageURL } from './common.mjs';
import { MOODS, SUBJECTS } from './prompts.mjs';
import { buildExport, loadFeatures } from './export.mjs';
const mode=process.argv[2] || 'sample';
const rows=readJSON(`${CACHE}/${mode==='sample'?'sample':'catalog'}.json`);
const result=buildExport(rows,loadFeatures(rows),readJSON(`${CACHE}/text-prototypes.json`).prototypes);
let text=`${mode} examples: image-derived labels; no card name or rules text enters CLIP.\n`;
const labels=[];
for(const [kind,groups] of [['mood',MOODS],['subject',SUBJECTS]])for(let g=0;g<groups.length;g++) {
  const assigned=i=>kind==='mood'?!!(result.art.moods[i]&(1<<g)):result.art.subject[i]===g;
  const score=i=>kind==='mood'?result.raw[i][g]:result.subjectScores[i][g];
  // Show assigned items first. If a small sample has fewer than ten, mark supplementary candidates.
  const indexes=rows.map((_,i)=>i).sort((a,b)=>Number(assigned(b))-Number(assigned(a))||score(b)-score(a)).slice(0,10);
  text+=`\n${groups[g].label} (${kind}, ${rows.filter((_,i)=>assigned(i)).length} assigned)\n`;
  indexes.forEach((i,j)=>{text+=`${j+1}. ${rows[i].name} (${rows[i].released.slice(0,4)})${assigned(i)?'':' [candidate, assigned '+SUBJECTS[result.art.subject[i]].label+']'} — ${rows[i].scryfall} — ${imageURL(rows[i])}\n`;});
  labels.push({label:groups[g].label,indexes,assigned});
}
fs.writeFileSync(`${CACHE}/${mode}-examples.txt`,text);console.log(text);
if(mode==='sample') {
  const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  for(let page=0;page<Math.ceil(labels.length/4);page++) {
    const group=labels.slice(page*4,page*4+4),overlays=[],width=1100,height=group.length*370;
    for(let g=0;g<group.length;g++) {
      const label=group[g];
      const title=Buffer.from(`<svg width="1100" height="30"><rect width="100%" height="100%" fill="#ffffff"/><text x="8" y="23" font-family="sans-serif" font-size="21" fill="#111">${escape(label.label)}</text></svg>`);
      overlays.push({input:title,left:0,top:g*370});
      for(let k=0;k<label.indexes.length;k++) {
        const i=label.indexes[k],x=k%5*220,y=g*370+30+Math.floor(k/5)*170;
        const image=await sharp(`${CACHE}/sample-images/${rows[i].illustration}.jpg`).resize(216,140,{fit:'contain',background:'#e8e8e8'}).toBuffer();
        overlays.push({input:image,left:x+2,top:y});
        const caption=Buffer.from(`<svg width="220" height="30"><rect width="100%" height="100%" fill="${label.assigned(i)?'#fff':'#ffe0a0'}"/><text x="3" y="15" font-family="sans-serif" font-size="11" fill="#111">${escape(rows[i].name.slice(0,34))}</text><text x="3" y="28" font-family="sans-serif" font-size="10" fill="#555">${rows[i].released.slice(0,4)} · ${escape(SUBJECTS[result.art.subject[i]].label)}</text></svg>`);
        overlays.push({input:caption,left:x,top:y+140});
      }
    }
    await sharp({create:{width,height,channels:3,background:'#fff'}}).composite(overlays).png().toFile(`${CACHE}/review-${page+1}.png`);
  }
}
