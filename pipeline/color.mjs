import sharp from 'sharp';
function linear(x) { x/=255; return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4; }
function oklab(r,g,b) {
  r=linear(r);g=linear(g);b=linear(b);
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
function distance(a,b) {return (a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;}
export function rgbHSL(rgb) {
  const [r,g,b]=rgb.map(x=>x/255), hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;
  let h=0;if(d) {if(hi===r)h=((g-b)/d)%6;else if(hi===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;}
  return [Math.round((h+360)%360)%360,Math.round(100*(d?d/(1-Math.abs(2*l-1)):0)),Math.round(l*100)];
}
export async function colors(buffer) {
  // Art crops have little border; omit the outer two percent before clustering.
  const meta=await sharp(buffer).metadata();
  const dx=Math.floor(meta.width*.02),dy=Math.floor(meta.height*.02);
  const raw=await sharp(buffer).extract({left:dx,top:dy,width:meta.width-2*dx,height:meta.height-2*dy}).resize(48,48,{fit:'fill'}).removeAlpha().toColourspace('srgb').raw().toBuffer();
  const points=[];
  for(let i=0;i<raw.length;i+=3) {
    const rgb=[raw[i],raw[i+1],raw[i+2]],lab=oklab(...rgb),chroma=Math.hypot(lab[1],lab[2]);
    // Large regions retain their area; chroma lifts color above grey and near-black.
    const weight=(.25+Math.min(1.5,chroma*7))*(.12+.88*Math.min(1,lab[0]/.4));
    points.push({rgb,lab,weight});
  }
  const centers=[points.reduce((a,b)=>a.weight>b.weight?a:b).lab.slice()];
  for(let k=1;k<5;k++) {const p=points.reduce((a,b)=>Math.min(...centers.map(c=>distance(b.lab,c)))*b.weight>Math.min(...centers.map(c=>distance(a.lab,c)))*a.weight?b:a);centers.push(p.lab.slice());}
  let clusters;
  for(let iter=0;iter<9;iter++) {
    clusters=centers.map(()=>({lab:[0,0,0],rgb:[0,0,0],mass:0,count:0}));
    for(const p of points) {
      let best=0;for(let j=1;j<centers.length;j++)if(distance(p.lab,centers[j])<distance(p.lab,centers[best]))best=j;
      const c=clusters[best];c.mass+=p.weight;c.count++;
      for(let j=0;j<3;j++){c.lab[j]+=p.lab[j]*p.weight;c.rgb[j]+=p.rgb[j]*p.weight;}
    }
    clusters.forEach((c,j)=>{if(c.mass)centers[j]=c.lab.map(v=>v/c.mass);});
  }
  const ranked=clusters.filter(c=>c.count).sort((a,b)=>b.mass-a.mass).map(c=>c.rgb.map(v=>Math.round(v/c.mass)));
  while(ranked.length<3)ranked.push(ranked[0]);
  const palette=ranked.slice(0,3);
  return {hsl:rgbHSL(palette[0]),pal:palette.map(c=>c.map(x=>x.toString(16).padStart(2,'0')).join(''))};
}
