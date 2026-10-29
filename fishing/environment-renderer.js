import {traceLakeWaterMask} from './lake-water-layer.js';
/** Deterministic weather layers. No input, model, audio, or screen geometry changes. */
const TAU=Math.PI*2,clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,Number(n)||0));
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
export function paintEnvironmentLight(ctx,environment={},time=0,reducedMotion=false){
 const night=clamp(environment.nightAmount),rain=clamp(environment.rainIntensity),dawn=clamp(environment.dawnProgress);
 if(!night&&!rain)return;
 if(environment.backgroundArt){ctx.save();if(night&&rain){ctx.fillStyle=`rgba(41,55,68,${rain*.18})`;ctx.fillRect(0,0,540,960)}if(dawn>0&&dawn<1){ctx.fillStyle=`rgba(84,132,202,${Math.sin(dawn*Math.PI)*.14})`;ctx.fillRect(0,0,540,960)}ctx.restore();return;}
 ctx.save();
 if(rain){ctx.fillStyle=`rgba(41,55,68,${rain*.25})`;ctx.fillRect(0,0,540,960)}
 if(night){
  ctx.fillStyle=`rgba(4,12,35,${night*.76})`;ctx.fillRect(0,0,540,960);
  const blue=ctx.createLinearGradient(0,0,0,680);
  blue.addColorStop(0,`rgba(75,111,175,${dawn>0?Math.sin(dawn*Math.PI)*.26:night*.09})`);blue.addColorStop(1,'rgba(32,82,116,0)');ctx.fillStyle=blue;ctx.fillRect(0,0,540,680);
  const moonAlpha=night*(1-rain*.72)*(dawn>0?1-dawn:1),x=129,y=138;
  const halo=ctx.createRadialGradient(x,y,5,x,y,65);halo.addColorStop(0,`rgba(211,234,247,${moonAlpha*.35})`);halo.addColorStop(1,'rgba(189,222,248,0)');ctx.fillStyle=halo;ctx.fillRect(x-65,y-65,130,130);
  ctx.fillStyle=`rgba(231,239,239,${moonAlpha*.92})`;ctx.beginPath();ctx.arc(x,y,13,0,TAU);ctx.fill();
  for(let i=0;i<24;i++){const w=18+i*2.8,t=reducedMotion?0:time;ctx.strokeStyle=`rgba(181,214,232,${moonAlpha*(.009+.008*hash(i))})`;ctx.lineWidth=1+hash(i+90);ctx.beginPath();ctx.ellipse(x+Math.sin(t*.5+i)*3,330+i*12,w,1.1,0,0,TAU);ctx.stroke()}
 }
 ctx.restore();
}
export function paintRain(ctx,environment={},time=0,reducedMotion=false,float=null){
 const intensity=clamp(environment.rainIntensity);if(intensity<.005)return;
 const t=reducedMotion?0:time,count=Math.ceil(35+intensity*105),ripples=Math.ceil(18+intensity*48);
 ctx.save();ctx.lineWidth=.7;ctx.lineCap='round';
 for(let i=0;i<count;i++){
  const depth=.45+hash(i+44)*.55,x=((hash(i+1)*600-t*(18+depth*26))%600+600)%600-30;
  const y=((hash(i+2)*1000+t*(380+depth*360))%1030)-35,length=(7+intensity*12)*depth;
  if(float&&Math.abs(x-float.x)<18&&y>float.y-62&&y<float.y+18)continue;
  ctx.strokeStyle=`rgba(209,229,237,${(.13+depth*.17)*intensity})`;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-length*.21,y+length);ctx.stroke();
 }
 ctx.save();traceLakeWaterMask(ctx,314);ctx.clip();
 for(let i=0;i<ripples;i++){
  const p=(t*(.55+hash(i+420)*.45)+hash(i+540))%1;
  const x=16+hash(i+600)*508,y=333+hash(i+620)*445,depth=(y-314)/480;
  if(float&&Math.hypot(x-float.x,y-float.y)<42)continue;
  ctx.strokeStyle=`rgba(219,240,248,${(1-p)*.42*intensity})`;ctx.lineWidth=.75;ctx.beginPath();ctx.ellipse(x,y,(3+p*15)*(.5+depth),(.8+p*3.1)*(.4+depth),0,0,TAU);ctx.stroke();
  // Brief crown and ballistic upward droplets accompany each actual impact.
  // Impacts stay in the water corridor; near-camera splashes are larger.
  if(p<.32){const age=p/.32,scale=.65+depth*1.3,fade=(1-age)*intensity;
    ctx.strokeStyle=`rgba(223,242,247,${fade*.68})`;ctx.lineWidth=.7;
    ctx.beginPath();ctx.moveTo(x-3*scale,y);ctx.lineTo(x-4*scale,y-2*scale*(1-age));ctx.moveTo(x+3*scale,y);ctx.lineTo(x+4*scale,y-2*scale*(1-age));ctx.stroke();
    ctx.fillStyle=`rgba(225,245,250,${fade*.85})`;
    for(let j=0;j<3;j++){const side=j-1,dx=side*(1.8+age*4)*scale,dy=Math.sin(age*Math.PI)*(5+(j%2)*4)*scale;ctx.beginPath();ctx.ellipse(x+dx,y-dy,.85*scale,1.35*scale,side*.3,0,TAU);ctx.fill()}
  }
 }
 ctx.restore();ctx.restore();
}
