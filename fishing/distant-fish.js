// Decorative reservoir life only: no model state, RNG, events, storage or timers.
export const DISTANT_JUMP_INTERVAL=Object.freeze({day:12,night:12,rain:12});
export const DISTANT_JUMP_START=10,DISTANT_JUMP_FLIGHT=.8,DISTANT_JUMP_LANDING=.55;
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const smooth=n=>{const u=Math.max(0,Math.min(1,n));return u*u*(3-2*u)};
export const DISTANT_JUMP_GROUP_GAP=.5;
export function distantFishGroupAt(time,environment={}, {reducedMotion=false,paused=false,float=null}={}){
 if(reducedMotion||paused||!Number.isFinite(time)||time<DISTANT_JUMP_START)return [];
 const mode=environment.weather==='rain'||environment.rainIntensity>.05?'rain':environment.isNight||environment.nightAmount>.5?'night':'day';
 const interval=DISTANT_JUMP_INTERVAL[mode],cycle=Math.floor((time-DISTANT_JUMP_START)/interval),groupAge=time-DISTANT_JUMP_START-cycle*interval,count=cycle%3+1,result=[];
 for(let index=0;index<count;index++){
  const age=groupAge-index*DISTANT_JUMP_GROUP_GAP;
  if(age<0||age>DISTANT_JUMP_FLIGHT+DISTANT_JUMP_LANDING)continue;
  const seed=cycle*7+index,side=hash(seed+8)>.5?1:-1;
  // Distinct far-water lanes keep simultaneous flight/landing silhouettes apart.
  const lane=(index+cycle)%3,originX=140+lane*115+(hash(seed+2)-.5)*10,waterY=341+hash(seed+3)*34;
  const u=Math.min(1,age/DISTANT_JUMP_FLIGHT),height=15+hash(seed+4)*8;
  const x=originX+side*24*u,y=waterY-4*height*u*(1-u);
  if(float&&Number.isFinite(float.x)&&Number.isFinite(float.y)&&Math.hypot(float.x-(originX+side*12),float.y-waterY)<62)continue;
  result.push({id:`distant:${cycle}:${index}`,mode,cycle,index,count,age,side,x,y,originX,landingX:originX+side*24,waterY,u,length:12+(waterY-341)*.11,
   angle:-.75+u*1.5,landing:age>=DISTANT_JUMP_FLIGHT,landingAt:DISTANT_JUMP_START+cycle*interval+index*DISTANT_JUMP_GROUP_GAP+DISTANT_JUMP_FLIGHT,
   landingProgress:Math.max(0,(age-DISTANT_JUMP_FLIGHT)/DISTANT_JUMP_LANDING)});
 }
 return result;
}
// Keep the existing single-fish inspection API; the painter draws the whole group.
export function distantFishAt(time,environment={},options={}){return distantFishGroupAt(time,environment,options)[0]||null;}
export const DISTANT_JUMP_RENDER_SCALE=2;
export function distantPoseBlend(u,frames){
 if(!frames.length)return [];
 const position=Math.max(0,Math.min(1,u))*(frames.length-1),index=Math.floor(position),blend=smooth(position-index);
 return [{frame:frames[index],weight:1-blend},...(blend>0&&index+1<frames.length?[{frame:frames[index+1],weight:blend}]:[])];
}
const poseBuffers=new WeakMap();
function paintBlendedPose(ctx,fish,atlas,frames){
 let canvas=poseBuffers.get(ctx.canvas);
 if(!canvas){try{canvas=new ctx.canvas.constructor(256,256)}catch{}if(!canvas?.getContext&&typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=canvas.height=256}if(!canvas?.getContext)return false;poseBuffers.set(ctx.canvas,canvas)}
 const layer=canvas.getContext('2d');layer.setTransform(1,0,0,1,0,0);layer.clearRect(0,0,256,256);layer.setTransform(4,0,0,4,128,128);layer.globalCompositeOperation='lighter';
 for(const {frame,weight}of distantPoseBlend(fish.u,frames)){
  const [sx,sy,sw,sh,mx=sw*.98,my=sh*.55]=frame,k=fish.length/sw,xScale=(atlas.naturalWidth||atlas.width)/1536,yScale=(atlas.naturalHeight||atlas.height)/1024;
  layer.globalAlpha=weight;
  // Register the real nose before premultiplied blending, avoiding crop jitter.
  layer.drawImage(atlas,sx*xScale,sy*yScale,sw*xScale,sh*yScale,fish.length*.48-mx*k,fish.length*.19-my*k,fish.length,sh*k);
 }
 ctx.drawImage(canvas,-32,-32,64,64);return true;
}
export function paintDistantRipples(ctx,fish){
 const rings=(x,age,duration,strength)=>{
  if(age<0||age>duration)return;
  const p=age/duration,fade=smooth(age/.035)*(1-p)*strength;
  ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle='#c7dde0';ctx.lineWidth=.7;
  for(let i=0;i<2;i++){const radius=2+Math.sqrt(p)*9+i*2;ctx.beginPath();ctx.ellipse(x,fish.waterY,radius,.65+Math.sqrt(p)*1.8+i*.4,0,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
 };
 rings(fish.originX,fish.age,.5,.26);
 rings(fish.landingX,fish.age-DISTANT_JUMP_FLIGHT,DISTANT_JUMP_LANDING,.4);
}
export function paintDistantFish(ctx,{time=0,environment={},reducedMotion=false,paused=false,cast={},atlas=null,frames=[]}={}){
 const fishes=distantFishGroupAt(time,environment,{reducedMotion,paused,float:cast.float});if(!fishes.length)return null;
 for(const fish of fishes){
  ctx.save();paintDistantRipples(ctx,fish);
  if(!fish.landing){
   ctx.beginPath();ctx.rect(0,0,540,fish.waterY+.5);ctx.clip();
   ctx.translate(fish.x,fish.y);ctx.scale(fish.side*DISTANT_JUMP_RENDER_SCALE,DISTANT_JUMP_RENDER_SCALE);ctx.rotate(fish.angle);ctx.globalAlpha=.8*smooth(fish.age/.07)*smooth((DISTANT_JUMP_FLIGHT-fish.age)/.07);
   if(!(atlas&&frames.length&&paintBlendedPose(ctx,fish,atlas,frames))){ctx.fillStyle='#aeb9a9';ctx.beginPath();ctx.ellipse(0,0,fish.length*.42,fish.length*.13,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(-fish.length*.25,0);ctx.lineTo(-fish.length*.55,-2);ctx.lineTo(-fish.length*.55,2);ctx.fill();}
  }
  ctx.restore();
 }
 return fishes[0];
}
