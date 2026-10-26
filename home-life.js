import{sound}from './audio.js';
const ROOT='assets/sound4/';
const FILES={bark:'bark.wav',run:'run.wav',pond:'pond.wav',clothes:'clothes.wav',splash:'splash.wav',steps:'steps.wav'};
export class HomeLifeAudio{
 constructor(base=sound){this.base=base;this.cache=new Map();this.active=new Set();this.timers=[];this.last=new Map();}
 play(key,{loop=false,cap=900}={}){if(!this.base.ready||!this.base.sfx||this.base.hidden||!this.base.AudioType)return;if(key==='bark'||key==='run'){const other=this.cache.get(key==='bark'?'run':'bark');if(other){other.pause();this.active.delete(other);}}const now=Date.now();if(now-(this.last.get(key)??0)<1200)return;this.last.set(key,now);if(this.active.size>=3)return;let a=this.cache.get(key);if(!a){a=new this.base.AudioType(ROOT+FILES[key]);a.preload='none';this.cache.set(key,a);}a.pause();a.currentTime=0;a.loop=loop;a.volume=key==='pond'?.035:key==='run'?.09:.14;this.active.add(a);a.play()?.catch(()=>this.active.delete(a));if(!loop)this.timers.push(setTimeout(()=>{a.pause();this.active.delete(a);},cap));}
 sync(){if(!this.base.sfx||this.base.hidden)this.stop();}
 stop(){this.timers.forEach(clearTimeout);this.timers=[];for(const a of this.active)a.pause();this.active.clear();}
}
export class HomeLife{
 constructor({reduced=()=>false,audio=new HomeLifeAudio()}={}){this.reduced=reduced;this.audio=audio;this.raf=0;this.serial=0;this.scene=null;this.preloaded=new Map();}
 preload(stage){const files=['01-forest-background','02-yard-ground','03-house-1-shabby','04-house-2-walls-fixed','05-house-3-roof-fixed','06-house-6-green-roof','07-house-7-expanded'];for(const s of [stage,Math.min(10,stage+1)]){const list=[files[0],files[1],files[s>=7?6:s>=6?5:s>=3?4:s>=2?3:2],s>=3?'09-hero-new-3x3':'08-hero-old-3x3'];if(s>=4)list.push('11a-flowers-left','11b-flowers-right');if(s>=3)list.push('10-puppy-4x3');if(s>=8)list.push('11c-bench','11d-fence');if(s>=9)list.push('12-pond');if(s>=10)list.push('13-goldfish-swim-3x2');for(const f of list)if(!this.preloaded.has(f)&&typeof Image!=='undefined'){const im=new Image();im.src='assets/home10/'+f+'.webp';this.preloaded.set(f,im);}}}
 stop(){this.serial++;if(this.raf)globalThis.cancelAnimationFrame?.(this.raf);this.raf=0;this.audio.stop();if(this.scene){for(const b of this.scene.querySelectorAll('.life-actor,.pond-touch'))b.onclick=null;}this.scene=null;}
 start(scene,stage){this.stop();this.scene=scene;this.preload(stage);const serial=this.serial,start=performance.now();const hero=scene.querySelector('.hero-actor'),dog=scene.querySelector('.dog-actor'),fish=[...scene.querySelectorAll('.swimming-fish')];let heroUntil=0,heroMode='wave',dogUntil=0,dogMode='tail',next=9000,last=0;
 const frame=(n,i,c,r)=>{if(n)n.style.backgroundPosition=`${i%c/(c-1)*100}% ${Math.floor(i/c)/(r-1)*100}%`;};
 this.celebrate=()=>{heroMode='jump';heroUntil=performance.now()+900;};
 hero.onclick=()=>{heroMode='wave';heroUntil=performance.now()+800;};
 this.feed=()=>{if(!this.scene||serial!==this.serial||!dog)return;dogMode='tail';dogUntil=performance.now()+1400;next=Math.max(next,performance.now()-start+3500);this.audio.play('bark',{cap:850});};
 if(dog)dog.onclick=()=>{dogMode='tail';dogUntil=performance.now()+1100;this.audio.play('bark',{cap:850});};
 const pond=scene.querySelector('.pond-touch');if(pond)pond.onclick=()=>{if(stage===10)this.audio.play('splash',{cap:600});};
 if(stage===10){const probe=new Image();probe.onerror=()=>{if(serial===this.serial)for(const f of fish)f.firstElementChild.classList.add('fish-fallback');};probe.src='assets/home10/13-goldfish-swim-3x2.webp';}
 if(stage>=9)this.audio.play('pond',{loop:true});
 const tick=now=>{if(serial!==this.serial||document.hidden)return;this.raf=requestAnimationFrame(tick);if(now-last<60)return;last=now;this.audio.sync();if(stage>=9&&!this.audio.active.has(this.audio.cache.get('pond')))this.audio.play('pond',{loop:true});const t=now-start,reduce=this.reduced();
 frame(hero,!reduce&&now<heroUntil?(heroMode==='wave'?1:5)+Math.floor(t/140)%4:0,3,3);
 if(dog){if(!reduce&&t>next){dogMode='run';dogUntil=now+1600;next=t+11000+(stage%3)*1700;this.audio.play('run',{cap:1500});}const run=dogMode==='run'&&now<dogUntil&&!reduce;frame(dog,reduce||now>=dogUntil?1:run?2+Math.floor(t/110)%6:8+Math.floor(t/150)%4,4,3);const q=run?1-(dogUntil-now)/1600:0;dog.style.transform=run?`translateX(${-Math.sin(q*Math.PI)*18}px) scaleX(${q<.5?-1:1})`:'none';}
 fish.forEach((f,i)=>{const a=reduce?i*2:t/(8000+i*1700)*Math.PI*2+i*2;const x=50+Math.cos(a)*(20-i*2),y=50+Math.sin(a)*(14-i);f.style.left=x+'%';f.style.top=y+'%';const angle=reduce?0:Math.atan2(Math.cos(a)*(14-i),-Math.sin(a)*(20-i*2))*180/Math.PI;f.style.transform=`translate(-50%,-50%) rotate(${angle}deg)`;frame(f.firstElementChild,reduce?0:(Math.floor(t/125)+i*2)%6,3,2);});
 };this.raf=requestAnimationFrame(tick);
 }
}
