import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { artworks, choose } from './prepare.mjs';
import { typeIndex, TYPES, imageURL } from './common.mjs';
import { colors } from './color.mjs';
import { calibrate, buildExport } from './export.mjs';
const card={id:'12345678-1234-1234-1234-123456789abc',name:'Front // Back',artist:'Parent',set:'tst',set_name:'Test',released_at:'2026-01-01',layout:'transform',type_line:'Creature',image_status:'highres_scan',card_faces:[{name:'Front',artist:'Alice',illustration_id:'front-art',type_line:'Legendary Creature',image_uris:{art_crop:'front.jpg'}},{name:'Back',artist:'Bob',illustration_id:'back-art',type_line:'Planeswalker',image_uris:{art_crop:'back.jpg'}}]};
test('face-level names, artists, types and image paths survive cataloging',()=>{
 const rows=artworks(card);assert.equal(rows.length,2);assert.deepEqual(rows.map(x=>[x.face,x.name,x.artist,x.type_line]),[[0,'Front','Alice','Legendary Creature'],[1,'Back','Bob','Planeswalker']]);assert.match(imageURL(rows[1]),/art_crop\/back\/1\/2\/12345678/);
 assert.equal(artworks({...card,digital:true,image_status:'placeholder'}).length,0);
 assert.equal(artworks({...card,card_faces:[{name:'Missing'}]}).length,0);
});
test('shared-image adventures use front-face metadata without inventing a second crop',()=>{
 const shared={...card,layout:'adventure',illustration_id:'shared-art',image_uris:{art_crop:'shared.jpg'},card_faces:card.card_faces.map(({image_uris,illustration_id,...face})=>face)};
 const rows=artworks(shared);assert.equal(rows.length,1);assert.equal(rows[0].name,'Front');assert.equal(rows[0].artist,'Alice');assert.equal(rows[0].illustration,'shared-art');assert.equal(rows[0].url,'shared.jpg');assert.equal(rows[0].type_line,'Legendary Creature');
});
test('art-series unique fronts survive while duplicate signatures do not become artwork',()=>{
 const rows=artworks({...card,layout:'art_series'});assert.equal(rows.length,1);assert.equal(rows[0].face,0);
 const base=artworks(card)[0],series={...base,art_series:true,released:'2027-01-01'};assert.equal(choose(series,base),base);assert.equal(choose(base,series),base);
});
test('type precedence handles hybrid types and tokens',()=>{
 for(const [line,want] of [['Artifact Creature — Golem','Creature'],['Legendary Land — Forest','Land'],['Token Artifact Creature','Token'],['Enchantment Artifact','Enchantment'],['Battle Creature','Battle'],['Card','Other']])assert.equal(TYPES[typeIndex(line)],want);
});
test('perceptual palette favors a large saturated region over black and grey',async()=>{
 const background=await sharp({create:{width:100,height:100,channels:3,background:'#111111'}}).png().toBuffer();
 const red=await sharp({create:{width:60,height:70,channels:3,background:'#d52020'}}).png().toBuffer();
 const input=await sharp(background).composite([{input:red,left:20,top:15}]).png().toBuffer();
 const result=await colors(input);assert.equal(result.pal.length,3);assert(result.hsl[0]<8||result.hsl[0]>352);assert(result.hsl[1]>60);assert(result.hsl[2]>20);
 const grey=await colors(await sharp({create:{width:30,height:30,channels:3,background:'#808080'}}).png().toBuffer());assert.equal(grey.hsl[1],0);assert.equal(grey.pal.length,3);
});
test('calibration is deterministic, keeps ties equal, and caps masks at four',()=>{
 const raw=Array.from({length:300},(_,i)=>Array.from({length:12},(_,m)=>Math.sin((i+1)*(m+1)*.13)));
 const a=calibrate(raw,raw.length),b=calibrate(raw,raw.length);assert.deepEqual(a,b);assert.equal(a.scores.length,3600);assert(a.masks.every(x=>x.toString(2).replaceAll('0','').length<=4));
 const ties=calibrate(Array.from({length:5},()=>Array(12).fill(.3)),5);assert(ties.scores.every(x=>x===128));assert(ties.masks.every(x=>x===0));
});
test('export preserves shared column order, head strides, metadata and embedding classification',()=>{
 const rows=Array.from({length:130},(_,i)=>({...artworks(card)[i%2],illustration:`art-${i}`,released:`2026-01-01`}));
 const features=new Map(rows.map((r,i)=>[r.illustration,{colors:{hsl:[20,30,40],pal:['112233','445566','778899']},embedding:Float32Array.from({length:512},(_,j)=>j===i%11?1:0)}]));
 const prototypes=Array.from({length:23},(_,m)=>Array.from({length:512},(_,j)=>m>=12&&j===m-12?1:0));
 const {art,meta,head,scores}=buildExport(rows,features,prototypes);assert.equal(meta.n,130);assert.equal(head.n,120);assert.equal(head.pal.length,360);assert.equal(art.hsl.length,390);assert.equal(scores.length,1560);assert.deepEqual(art.subject,rows.map((_,i)=>i%11));assert.equal(meta.artists.reduce((s,x)=>s+x[2],0),130);assert.equal(art.face[1],1);
});
