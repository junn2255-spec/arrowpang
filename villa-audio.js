import {sound} from './audio.js';
// Reuse the fishing coast recordings and the forest house construction sounds.
export class VillaAudio{
 constructor(){this.opened=false;this.loops=[];this.effects=new Set();this.timers=new Set();}
 enter(){this.opened=true;document.body.classList.add('seaside-villa-open');sound.sync();if(!this.loops.length&&sound.AudioType){for(const[file,volume]of [['fishing/assets/audio/seaside-ambience.mp3',.13],['fishing/assets/audio/environment-v40/water.mp3',.065]]){const a=new sound.AudioType(file);a.loop=true;a.volume=volume;a.preload='none';this.loops.push(a);}}this.sync();}
 sync(){const on=this.opened&&!document.hidden&&!sound.hidden&&sound.ready;for(const a of this.loops){if(on&&sound.music){if(a.paused)a.play()?.catch(()=>{});}else a.pause();}if(!on||!sound.sfx)for(const a of this.effects)a.pause();}
 play(key){if(!this.opened||!sound.ready||!sound.sfx||document.hidden||!sound.AudioType)return;const config={click:['assets/sound/menu.mp3',.2,500],spend:['assets/sound2/coin-spend.mp3',.25,750],build:['assets/special/audio/build.wav',.28,750],complete:['assets/special/audio/levelup.wav',.38,1400],bonus:['assets/bonus/bonus-award.mp3',.24,1800],bark:['assets/sound4/bark.wav',.12,800]}[key];if(!config)return;const[file,volume,cap]=config,a=new sound.AudioType(file);a.volume=volume;this.effects.add(a);a.play()?.catch(()=>this.effects.delete(a));const timer=setTimeout(()=>{a.pause();this.effects.delete(a);this.timers.delete(timer);},cap);this.timers.add(timer);}
 leave(){this.opened=false;for(const a of this.loops)a.pause();for(const a of this.effects)a.pause();this.effects.clear();for(const t of this.timers)clearTimeout(t);this.timers.clear();document.body.classList.remove('seaside-villa-open');sound.sync();}
}
