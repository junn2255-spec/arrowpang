import{sound}from'./audio.js';
export class HomeAudio{
 constructor(base=sound){this.base=base;this.effects=new Set();this.home=false;this.forest=null;this.fade=[];}
 play(name){if(!this.base.ready||!this.base.sfx||this.base.hidden||!this.base.AudioType)return;while(this.effects.size>=3){const a=this.effects.values().next().value;a.pause();this.effects.delete(a);}const a=new this.base.AudioType('assets/sound2/'+name+'.mp3');a.volume=name==='repair'?.16:.25;this.effects.add(a);a.addEventListener?.('ended',()=>this.effects.delete(a),{once:true});a.play()?.catch(()=>this.effects.delete(a));}
 stop(){for(const a of this.effects)a.pause();this.effects.clear();}
 sync(){if(!this.home)return;if(!this.forest&&this.base.AudioType){this.forest=new this.base.AudioType('assets/sound2/forest.mp3');this.forest.loop=true;this.forest.volume=.09;this.forest.preload='none';}if(!this.base.music||this.base.hidden){this.forest?.pause();this.stop();}else if(this.base.ready&&this.forest?.paused)this.forest.play()?.catch(()=>{});if(!this.base.sfx)this.stop();}
 enter(){this.fade.forEach(clearTimeout);this.fade=[];this.home=true;this.base.homeScene=true;if(this.forest)this.forest.volume=.09;this.sync();}
 leave(){this.stop();this.home=false;this.base.homeScene=false;this.fade.forEach(clearTimeout);this.fade=[];const a=this.forest;if(a)for(let i=1;i<=4;i++)this.fade.push(setTimeout(()=>{a.volume=.09*(1-i/4);if(i===4)a.pause();},i*45));this.base.sync();}
}
export const homeAudio=new HomeAudio();
globalThis.document?.addEventListener?.('visibilitychange',()=>homeAudio.sync());
