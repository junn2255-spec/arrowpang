import{UpgradeAudio}from'./home-upgrade-audio.js';
export const houseFrame=stage=>stage>=7?4:stage>=6?3:stage>=3?2:stage>=2?1:0;
const F='assets/home-upgrade-fx/';
export class HomeUpgradeFX{
 constructor(scene,{audio=new UpgradeAudio(),reduced=()=>false}={}){this.scene=scene;this.audio=audio;this.reduced=reduced;this.timers=[];this.active=[];this.pool=[];this.running=false;this.serial=0;this.preloaded=false;}
 preload(){if(this.preloaded)return;this.preloaded=true;this.audio.preload();if(typeof Image==='undefined')return;for(const file of ['01-golden-wave.webp','02-light-burst.webp',...Array.from({length:16},(_,i)=>`particle_${String(i).padStart(2,'0')}.webp`)]){const img=new Image();img.src=F+file;}}
 later(fn,ms){const serial=this.serial;this.timers.push(setTimeout(()=>{if(serial===this.serial)fn();},ms));}
 node(src,cls){if(this.active.length>=48)return null;const n=this.pool.pop()??document.createElement('img');n.className='upgrade-fx '+cls;n.src=src;n.alt='';n.style.cssText='';n.onerror=()=>n.remove();this.active.push(n);this.scene.append(n);return n;}
 particles(count,row,kind){for(let i=0;i<count;i++){const n=this.node(F+`particle_${String(row*4+i%4).padStart(2,'0')}.webp`,'upgrade-'+kind);if(!n)break;n.style.left=(22+(i*31%57))+'%';n.style.top=(22+(i*17%43))+'%';n.style.setProperty('--dx',(-70+(i*37%141))+'px');n.style.setProperty('--dy',(40+(i*29%80))+'px');n.style.setProperty('--spin',(-100+i*47)+'deg');n.style.setProperty('--delay',(i%5*28)+'ms');}}
 clearVisuals(){for(const n of this.active){n.remove();n.onerror=null;if(this.pool.length<48)this.pool.push(n);}this.active=[];this.scene.classList.remove('upgrade-anticipate');this.scene.classList.remove('upgrade-build');this.scene.classList.remove('upgrade-reveal');this.scene.classList.remove('upgrade-reduced');this.scene.style.transform='';}
 cancel(){this.serial++;this.timers.forEach(clearTimeout);this.timers=[];this.audio.stop();this.clearVisuals();const done=this.done;this.done=null;this.running=false;done?.(true);}
 start({from,to,visualFrame,swap,onDone}){this.cancel();this.preload();this.running=true;this.done=onDone;const final=from<10&&to===10,reduced=this.reduced(),duration=reduced?500:2200,frame=visualFrame??houseFrame(to);this.audio.duck();
 const finish=()=>{this.timers.forEach(clearTimeout);this.timers=[];this.audio.stop();this.clearVisuals();this.running=false;const done=this.done;this.done=null;done?.(false);};
 if(reduced){this.scene.classList.add('upgrade-reduced');this.later(()=>{swap();this.audio.play(final?'final':'complete',250);},180);this.later(()=>this.audio.restore(),200);this.later(finish,duration);return;}
 this.scene.classList.add('upgrade-anticipate');this.particles(3,0,'spark');this.audio.play('magic');
 this.later(()=>{this.scene.classList.add('upgrade-build');this.audio.play('hammer',250);this.later(()=>this.audio.play('hammer',250),250);const dust=this.node('assets/home/sheet-14-0.webp','upgrade-dust');for(let i=0;i<6;i++)this.later(()=>{if(dust)dust.src='assets/home/sheet-14-'+i+'.webp';},i*85);for(let i=0;i<8;i++){const n=this.node('assets/home/sheet-13-'+(4+i%4)+'.webp','upgrade-shard');if(n){n.style.setProperty('--dx',(-70+i*20)+'px');n.style.setProperty('--dy',(-25-i%3*15)+'px');n.style.setProperty('--spin',(i*47)+'deg');}}},300);
 this.later(()=>{this.audio.play('wave');this.node(F+'01-golden-wave.webp','upgrade-wave');},760);
 this.later(()=>{const nodes=[...this.active];swap();for(const n of nodes)this.scene.append(n);this.scene.classList.remove('upgrade-build');this.scene.classList.add('upgrade-reveal');const light=this.node(F+'02-light-burst.webp','upgrade-light');if(light){light.style.setProperty('--light-max',frame<=2?'.35':'.65');light.style.setProperty('--light-time',final?'1000ms':'700ms');}},800);
 this.later(()=>this.audio.play('pop'),820);
 this.later(()=>{for(const n of [...this.active])if(/upgrade-(spark|shard|dust)/.test(n.className)){n.remove();this.active.splice(this.active.indexOf(n),1);if(this.pool.length<48)this.pool.push(n);}this.audio.play(final?'final':'complete');this.particles(frame<=2?8:12,0,'spark');this.particles(frame<=2?12:final?26:20,frame>=3?2:3,'petal');for(let i=0;i<3;i++)this.later(()=>{const n=this.node(F+'particle_00.webp','upgrade-window');if(n){n.style.left=(38+i*11)+'%';n.style.top=(40+i%2*12)+'%';}},i*75);},950);
 this.later(()=>this.audio.restore(),duration-300);this.later(finish,duration);
 }
}
