const DIFFICULTY=Object.freeze({duration:50,target:20,maxMoles:3,minStay:2200,maxStay:3100,fastChance:.30,fastMin:850,fastMax:1350,spawnEvery:510});
export const STAGES=Object.freeze({5:DIFFICULTY,15:DIFFICULTY,25:DIFFICULTY});
export const shouldOpenMoleGame = stage => Object.hasOwn(STAGES, stage);
export const REWARD = 50;
export class MoleGame {
  constructor({stage=5, random=Math.random, onEvent=()=>{}}={}) {
    if (!shouldOpenMoleGame(stage)) throw new Error('미니게임은 5·15·25스테이지 뒤에 등장합니다.');
    this.stage=stage; this.config=STAGES[stage]; this.random=random; this.onEvent=onEvent;
    this.state='ready'; this.elapsed=0; this.score=0; this.spawnAt=0; this.lastWarning=6;
    this.holes=Array.from({length:9},()=>null); this.serial=0;
  }
  emit(type, detail={}) { this.onEvent({type,...detail}); }
  start() { if(this.state!=='ready')return; this.state='playing';this.emit('start');this.spawn(); }
  get remaining() {return Math.max(0,this.config.duration-this.elapsed/1000);}
  spawn() {
    const active=this.holes.filter(m=>m && m.phase==='active').length;
    const empty=this.holes.flatMap((m,i)=>!m?[i]:[]);
    if(active>=this.config.maxMoles || !empty.length)return;
    const hole=empty[Math.min(empty.length-1,Math.floor(this.random()*empty.length))];
    const fast=this.random()<this.config.fastChance;
    const min=fast?this.config.fastMin:this.config.minStay,max=fast?this.config.fastMax:this.config.maxStay;
    this.holes[hole]={id:++this.serial,hits:0,fast,born:this.elapsed,until:this.elapsed+min+this.random()*(max-min),phase:'active',hitAt:-1000};
    this.emit('spawn',{hole});
  }
  tick(dt) {
    if(this.state!=='playing')return;
    this.elapsed+=Math.max(0,dt);
    // Expire first: a mole cannot be hit once its allotted time has ended.
    for(let i=0;i<9;i++){
      const m=this.holes[i]; if(!m)continue;
      if(m.phase==='active' && this.elapsed>=m.until){m.phase='hiding';m.hideAt=this.elapsed;this.emit('hide',{hole:i});}
      if(m.phase==='hiding' && this.elapsed-m.hideAt>=240)this.holes[i]=null;
      if(m.phase==='caught' && this.elapsed-m.caughtAt>=900)this.holes[i]=null;
    }
    if(this.remaining<=0){this.finish(false);return;}
    const sec=Math.ceil(this.remaining);
    if(sec<=5 && sec<this.lastWarning){this.lastWarning=sec;this.emit('warning',{seconds:sec});}
    if(this.elapsed>=this.spawnAt){this.spawnAt=this.elapsed+this.config.spawnEvery;this.spawn();}
  }
  aim(hole){
    if(this.state!=='playing')return null;
    const m=this.holes[hole];
    if(!m||m.phase!=='active'||this.elapsed>=m.until)return null;
    if(m.fast){m.phase='hiding';m.hideAt=this.elapsed;this.emit('hide',{hole,dodged:true});return null;}
    return m.id;
  }
  hit(hole,expectedId){
    if(this.state!=='playing')return false;
    const m=this.holes[hole];
    if(!m || (expectedId!==undefined&&m.id!==expectedId) || m.phase!=='active' || this.elapsed>=m.until || this.elapsed-m.born<170 || this.elapsed-m.hitAt<95)return false;
    m.hits++; m.hitAt=this.elapsed;this.emit('hit',{hole,hits:m.hits});
    if(m.hits===3){m.phase='caught';m.caughtAt=this.elapsed;this.score++;this.emit('caught',{hole,score:this.score});if(this.score>=this.config.target)this.finish(true);}
    return true;
  }
  pause(){if(this.state==='playing'){this.state='paused';this.emit('pause');}}
  resume(){if(this.state==='paused'){this.state='playing';this.emit('resume');}}
  finish(success){if(this.state!=='playing')return;this.state=success?'won':'lost';this.emit('finish',{success,score:this.score,reward:success?REWARD:0});}
  stop(){this.state='closed';}
}
