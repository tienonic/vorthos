import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { env, AutoTokenizer, AutoProcessor, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage } from '@huggingface/transformers';
import { CACHE, readJSON, writeJSON } from './common.mjs';
import { MODEL, MOODS, SUBJECTS } from './prompts.mjs';
sharp.concurrency(1);
env.cacheDir = `${CACHE}/models`;
const options={dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:Number(process.env.VORTHOS_THREADS || 4),interOpNumThreads:1,executionMode:'sequential',graphOptimizationLevel:'all'}};
export const promptHash=crypto.createHash('sha256').update(JSON.stringify({MODEL,MOODS,SUBJECTS,text_dtype:'fp32'})).digest('hex');
export async function textPrototypes() {
  const file=`${CACHE}/text-prototypes.json`;
  if(fs.existsSync(file)) { const x=readJSON(file); if(x.hash===promptHash) return x; }
  console.log('Loading CPU text encoder and averaging prompt embeddings');
  const tokenizer=await AutoTokenizer.from_pretrained(MODEL);
  const model=await CLIPTextModelWithProjection.from_pretrained(MODEL,{...options,dtype:'fp32'});
  const labels=[...MOODS,...SUBJECTS]; const prototypes=[];
  for(const label of labels) {
    const input=await tokenizer(label.prompts,{padding:true,truncation:true});
    const {text_embeds}=await model(input);
    const mean=new Array(512).fill(0);
    for(let p=0;p<label.prompts.length;p++) {
      const v=text_embeds.data.subarray(p*512,(p+1)*512);const norm=Math.hypot(...v);
      for(let j=0;j<512;j++) mean[j]+=v[j]/norm/label.prompts.length;
    }
    prototypes.push(mean);
  }
  await model.dispose();
  const output={hash:promptHash,model:MODEL,dimension:512,prototypes}; writeJSON(file,output);return output;
}
export async function imageEncoder() {
  const processor=await AutoProcessor.from_pretrained(MODEL);
  const model=await CLIPVisionModelWithProjection.from_pretrained(MODEL,options);
  return {
    async encode(buffers) {
      const images=await Promise.all(buffers.map(async buffer=>{
        const {data,info}=await sharp(buffer).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
        return new RawImage(new Uint8ClampedArray(data),info.width,info.height,info.channels);
      }));
      const inputs=await processor(images);
      const {image_embeds}=await model(inputs);
      return buffers.map((_,i)=>{const v=Float32Array.from(image_embeds.data.subarray(i*512,(i+1)*512));const norm=Math.hypot(...v);for(let j=0;j<v.length;j++)v[j]/=norm;return v;});
    },
    dispose:()=>model.dispose(),
  };
}
