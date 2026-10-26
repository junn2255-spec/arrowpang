import{sound}from'./audio.js';import{homeAudio}from'./home-audio.js';
export const UPGRADE_SOUNDS={magic:['반짝임마법.mp3',.30,300],hammer:['../special/audio/build.wav',.35,700],wave:['금빛 파동과 집전환.mp3',.30,650],pop:['팝통통.mp3',.35,350],complete:['../special/audio/levelup.wav',.45,1200],final:['../special/audio/levelup.wav',.50,1500]};
export class UpgradeAudio{
 constructor(base=sound,home=homeAudio){this.base=base;this.home=home;this.cache=new Map();this.active=new Set();this.timers=[];this.ducked=null;}
 later(fn,ms){this.timers.push(setTimeout(fn,ms));}
 preload(){if(!this.base.AudioType)return;for(const[k,[file]]of Object.entries(UPGRADE_SOUNDS))if(!this.cache.has(k)){try{const a=new this.base.AudioType('assets/sound3/'+file);a.preload='auto';this.cache.set(k,a);}catch{}}}
 duck(){const a=this.base.bgm;if(a&&!this.ducked){this.ducked={a,volume:a.volume};a.volume*=.65;}}
 restore(){const d=this.ducked;if(!d)return;for(let i=1;i<=6;i++)this.later(()=>{d.a.volume=d.volume*(.65+.35*i/6);if(i===6)this.ducked=null;},i*50);}
 play(k,cap){if(!this.base.ready||!this.base.sfx||this.base.hidden)return;this.preload();const a=this.cache.get(k);if(!a)return;while(this.active.size>=3){const old=this.active.values().next().value;old.pause();this.active.delete(old);}const[,volume,defaultDuration]=UPGRADE_SOUNDS[k],duration=Math.min(defaultDuration,cap??defaultDuration),token=(a._upgradeToken??0)+1;a._upgradeToken=token;try{a.pause();a.currentTime=0;a.volume=volume;this.active.add(a);Promise.resolve(a.play()).catch(()=>this.active.delete(a));for(let t=40;t<duration;t+=40)this.later(()=>{if(a._upgradeToken===token&&(!this.base.sfx||this.base.hidden)){a.pause();this.active.delete(a);}},t);for(let i=1;i<=4;i++)this.later(()=>{if(!this.active.has(a)||a._upgradeToken!==token)return;a.volume=volume*(1-i/4);if(i===4){a.pause();this.active.delete(a);}},duration-80+i*20);}catch{this.active.delete(a);}}
 stop(){this.timers.forEach(clearTimeout);this.timers=[];for(const a of this.active){try{a.pause();}catch{}}this.active.clear();if(this.ducked){this.ducked.a.volume=this.ducked.volume;this.ducked=null;}}
}
