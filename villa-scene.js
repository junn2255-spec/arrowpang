import {paintSeaMotion} from './assets/seaside-villa-v1/animation/sea-effects-v3.js';
const A='assets/seaside-villa-runtime-v1/';
export class VillaScene{
 constructor(canvas,{reduced=()=>false}={}){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.reduced=reduced;this.images={};this.active=false;this.time=0;this.last=0;this.raf=0;this.loading=null;this.generation=0;}
 load(){return this.loading??=Promise.all(['beach-base','palm-foreground','swash-atlas','sunlight-atlas','seagull-atlas','water-atlas','sailboat'].map(async key=>{const image=new Image();image.src=A+key+'.webp';await image.decode();this.images[key]=image;}));}
 async start(){const ticket=++this.generation;this.active=true;this.last=0;try{await this.load();if(this.active&&ticket===this.generation)this.tick(0);}catch{this.canvas.style.backgroundImage=`url('${A}beach-base.webp')`;}}
 stop(){this.generation++;this.active=false;cancelAnimationFrame(this.raf);this.raf=0;this.last=0;}
 tick(now){if(!this.active||document.hidden)return;this.raf=requestAnimationFrame(n=>this.tick(n));const dt=this.last?Math.min((now-this.last)/1000,.05):0;this.last=now;if(!this.reduced())this.time+=dt;const t=this.time,ctx=this.ctx,im=this.images;
 const rect=this.canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
 ctx.setTransform(w/512,0,0,h/768,0,0);ctx.drawImage(im['beach-base'],0,0,512,768);
 // Sky and sand remain fixed; effects are clipped to the water by this helper.
 paintSeaMotion(ctx,im['beach-base'],im['water-atlas'],im['sunlight-atlas'],t);
 const sprite=(image,n,fw,fh,x,y,sw,sh,a=1)=>{ctx.globalAlpha=a;ctx.drawImage(image,n%4*fw,Math.floor(n/4)*fh,fw,fh,x,y,sw,sh);ctx.globalAlpha=1;};
 const phase=(t%8)/8,spread=Math.sin(phase*Math.PI),f=phase*8,n=Math.floor(f)%8,m=f%1;ctx.save();ctx.transform(1,-.13,0,1,0,356);const sy=-34+spread*17,sh=42+spread*15,sa=Math.pow(spread,.55)*.78;sprite(im['swash-atlas'],n,768,256,-90,sy,700,sh,sa*(1-m));sprite(im['swash-atlas'],(n+1)%8,768,256,-90,sy,700,sh,sa*m);ctx.restore();
 // The boat stays near the horizon; birds cross behind the final palm layer.
 const boatX=((t*1.7+65)%650)-65;ctx.drawImage(im.sailboat,boatX,196,44,31);
 for(let i=0;i<3;i++){const duration=28+i*7,local=(t+[2,15,8][i])%(duration+11+i*4);if(local>duration)continue;const u=local/duration,size=45-i*8,x=i%2?550-u*650:-80+u*650,y=119+i*27-Math.sin(u*Math.PI)*10+Math.sin(t*.6+i)*2;const frame=this.reduced()?2:Math.sin(t*.38+i)>0?2:Math.floor(t*(8+i)+i*3)%8;ctx.save();ctx.translate(x+size/2,y+size/2);ctx.scale(i%2?-1:1,1);sprite(im['seagull-atlas'],frame,512,512,-size/2,-size/2,size,size);ctx.restore();}
 ctx.drawImage(im['palm-foreground'],0,0,512,768);this.canvas.dataset.frame=String(Math.floor(t*9));
 }
}
