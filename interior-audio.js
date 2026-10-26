import{sound}from'./audio.js';
const FILES={door:'door.wav',fire:'fire.wav',water:'water.wav',fry:'fry.wav',boil:'boil.wav',eat:'eat.wav',switch:'switch.wav',bark:'../../sound4/bark.wav'};
export class InteriorAudio{
 constructor(){this.active=new Map();this.timers=new Map();}
 play(key,{cap=1800,volume=.2,loop=false}={}){if(!FILES[key]||!sound.ready||!sound.sfx||sound.hidden||!sound.AudioType||document.hidden)return;this.stop(key);if(this.active.size>=3)this.stop([...this.active.keys()].find(k=>k!=='fire')??this.active.keys().next().value);const a=new sound.AudioType('assets/interior/audio/'+FILES[key]);a.preload='none';a.volume=volume;a.loop=loop;this.active.set(key,a);a.addEventListener('ended',()=>{if(this.active.get(key)===a)this.stop(key);},{once:true});a.play()?.catch(()=>{if(this.active.get(key)===a)this.stop(key);});if(!loop)this.timers.set(key,setTimeout(()=>{if(this.active.get(key)===a)this.stop(key);},cap));return a;}
 stop(key){if(key!==undefined){this.active.get(key)?.pause();this.active.delete(key);clearTimeout(this.timers.get(key));this.timers.delete(key);return;}for(const a of this.active.values())a.pause();this.active.clear();for(const t of this.timers.values())clearTimeout(t);this.timers.clear();}
 sync(){if(!sound.sfx||sound.hidden||document.hidden)this.stop();}
}
