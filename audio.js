// Supplied recordings only. No synthesized, guessed, or fallback sound assets.
export class Sound {
 constructor(AudioType=globalThis.Audio,storage=globalThis.localStorage){
  this.AudioType=AudioType;this.storage=storage;this.ready=false;this.hidden=false;this.effects=new Set();
  this.music=true;this.sfx=true;try{const v=JSON.parse(storage?.getItem('arrowtok-audio')??'null');if(v){this.music=v.music!==false;this.sfx=v.sfx!==false;}}catch{}
  if(AudioType){this.bgm=new AudioType('assets/sound4/global-loop.wav');this.bgm.loop=true;this.bgm.volume=.16;this.bgm.preload='none';}
 }
 unlock(){this.ready=true;this.sync();}
 sync(){if(!this.bgm)return;if(this.ready&&this.music&&!this.hidden){if(this.bgm.paused)this.bgm.play()?.catch(()=>{});}else this.bgm.pause();}
 set(kind,value){this[kind]=value;try{this.storage?.setItem('arrowtok-audio',JSON.stringify({music:this.music,sfx:this.sfx}));}catch{}if(!this.sfx)this.stopEffects();this.sync();}
 visibility(hidden){this.hidden=hidden;if(hidden)this.stopEffects();this.sync();}
 play(name){if(!this.ready||!this.sfx||this.hidden||!this.AudioType)return;if(name==='success'||name==='combo')for(const playing of this.effects)playing.volume=Math.min(playing.volume??.38,.12);const a=new this.AudioType(`assets/sound/${name}.mp3`);a.volume=name==='success'?.40:name==='combo'?.28:.32;this.effects.add(a);a.addEventListener?.('ended',()=>this.effects.delete(a),{once:true});a.play()?.catch(()=>this.effects.delete(a));}
 stopEffects(){for(const a of this.effects)a.pause();this.effects.clear();}
}
export const sound=new Sound();
globalThis.document?.addEventListener?.('pointerdown',()=>sound.unlock(),{once:true});
globalThis.document?.addEventListener?.('keydown',()=>sound.unlock(),{once:true});
globalThis.document?.addEventListener?.('visibilitychange',()=>sound.visibility(document.hidden));
