const BASE=new URL('../assets/whack-a-mole/audio/',import.meta.url);
export class Sound {
  constructor(){this.enabled=true;this.musicEnabled=true;this.context=null;this.buffers=new Map();this.music=null;this.musicGain=null;this.ready=null;}
  playIntro(){
    if(!this.enabled||document.hidden||this.intro)return;
    const intro=new Audio(new URL('sfx/minigame-intro.mp3',BASE));
    intro.volume=.8;this.intro=intro;
    intro.play().catch(()=>{if(this.intro===intro)this.stopIntro();});
  }
  stopIntro(){if(this.intro){this.intro.pause();this.intro.currentTime=0;this.intro=null;}}
  async unlock(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return;
    this.context??=new Context();
    await this.context.resume();
    if(!this.buffers.has('countdown-tick')){
      const cue=(notes,duration)=>{
        const buffer=this.context.createBuffer(1,Math.ceil(this.context.sampleRate*duration),this.context.sampleRate),samples=buffer.getChannelData(0);
        for(const [frequency,offset,length] of notes)for(let i=Math.floor(offset*buffer.sampleRate);i<Math.min(samples.length,(offset+length)*buffer.sampleRate);i++){
          const t=i/buffer.sampleRate-offset,envelope=Math.min(1,t/.006)*Math.min(1,(length-t)/.025)*Math.exp(-t*11);
          samples[i]+=.35*envelope*(Math.sin(2*Math.PI*frequency*t)+.2*Math.sin(4*Math.PI*frequency*t));
        }
        return buffer;
      };
      this.buffers.set('countdown-tick',cue([[660,0,.16]],.18));
      this.buffers.set('game-start',cue([[660,0,.16],[880,.065,.16],[1108.73,.13,.23]],.39));
    }
    if(!this.ready)this.ready=Promise.all(['mole-emerge','hammer-hit','mole-caught','mole-hide','timer-warning','minigame-fail','minigame-success','button-click','coin-reward','bgm'].map(async name=>{
      try {const data=await fetch(new URL(name==='bgm'?'bgm/bgm-loop.mp3':`sfx/${name}.mp3`,BASE)).then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();});this.buffers.set(name,await this.context.decodeAudioData(data));}catch(e){console.warn('효과음 로드 실패',name,e);}
    }));
    await this.ready;
  }
  play(name,volume=0.65,rate=1){
    if(!this.enabled||!this.context||!this.buffers.has(name))return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers.get(name);source.playbackRate.value=rate;gain.gain.value=volume;
    source.connect(gain).connect(this.context.destination);
    let offset=0;
    if(name==='hammer-hit'||name==='mole-caught'){
      const buffer=source.buffer,data=buffer.getChannelData(0);let i=0;
      while(i<Math.min(data.length,buffer.sampleRate*.25)&&Math.abs(data[i])<.012)i++;
      offset=Math.max(0,i/buffer.sampleRate-.002);
    }
    source.start(0,offset);
  }
  startMusic(){
    if(this.music||!this.context||!this.buffers.has('bgm'))return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers.get('bgm');source.loop=true;gain.gain.value=this.musicEnabled?0.27:0;
    source.connect(gain).connect(this.context.destination);source.start();this.music=source;this.musicGain=gain;
  }
  stopMusic(){if(this.music){this.music.stop();this.music.disconnect();this.music=null;this.musicGain=null;}}
  mute(){this.enabled=!this.enabled;this.musicEnabled=this.enabled;if(!this.enabled)this.stopIntro();if(this.musicGain)this.musicGain.gain.value=this.musicEnabled?0.27:0;}
  destroy(){this.stopIntro();this.stopMusic();this.context?.close();}
}
