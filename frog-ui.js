export class FrogUI{
 constructor({board,sound,reduced,isBusy,onRemove}){Object.assign(this,{board,sound,reduced,isBusy,onRemove});this.taps=new Map();this.timers=new Set();this.active=new Set();this.notice=null;this.departing=false;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./frog.css',import.meta.url);document.head.append(css);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});
 }
 later(fn,ms){const id=setTimeout(()=>{this.timers.delete(id);fn();},ms);this.timers.add(id);}
 clear(){for(const id of this.timers)clearTimeout(id);this.timers.clear();for(const el of this.active)el.remove();this.active.clear();this.notice?.remove();this.notice=null;this.taps.clear();this.departing=false;}
 render(game){for(const f of game.frogs??[]){const el=document.createElement('button');el.className='frog-actor';el.dataset.frog=f.id;el.style.setProperty('--x',f.x);el.style.setProperty('--y',f.y);el.setAttribute('aria-label',`개구리 ${f.y+1}행 ${f.x+1}열, 두 번 눌러 쫓아내기`);el.innerHTML='<img src="assets/frog-v1/frog-idle.png" alt="">';
   el.onclick=()=>{if(this.isBusy()||this.departing)return;const now=performance.now(),last=this.taps.get(f.id);this.taps.set(f.id,now);if(last!==undefined&&now-last<450){this.taps.delete(f.id);this.flee(f,el);}else this.sound.play('frog-croak');};
   el.ondblclick=e=>e.preventDefault();this.board.append(el);
  }}
 blocked(f){this.notice?.remove();const tip=document.createElement('div');tip.className='frog-notice';tip.setAttribute('role','status');tip.innerHTML='<span class="frog-notice-portrait" aria-hidden="true"><img src="assets/frog-v1/frog-idle.png" alt=""></span><span class="frog-notice-copy">개구리를 <strong>더블클릭하면</strong><br>개구리가 달아납니다.</span>';tip.style.top=`${Math.min(76,(f.y+1)*100/Number(this.board.dataset.n))}%`;tip.style.setProperty('--tail',`${Math.max(12,Math.min(88,(f.x+.5)*100/Number(this.board.dataset.n)))}%`);this.board.append(tip);this.notice=tip;this.sound.play('frog-notice');this.later(()=>{tip.remove();if(this.notice===tip)this.notice=null;},3200);}
 flee(f,el){this.departing=true;this.notice?.remove();this.sound.play('frog-hop');this.onRemove(f.id);el.remove();
  const actor=document.createElement('div');actor.className='frog-flight';actor.style.setProperty('--x',f.x);actor.style.setProperty('--y',f.y);this.board.append(actor);this.active.add(actor);
  const reduced=this.reduced(),duration=reduced?120:640,step=this.board.clientWidth/Number(this.board.dataset.n),dx=f.x<Number(this.board.dataset.n)/2?-step*2:step*2;
  if(!reduced){for(let frame=0;frame<8;frame++)this.later(()=>{actor.style.backgroundPosition=`${frame%4*100/3}% ${Math.floor(frame/4)*100}%`;},frame*80);}
  actor.animate(reduced?[{opacity:1},{opacity:0}]:[{transform:'translate(0,0)',opacity:1},{transform:`translate(${dx*.5}px,${-step}px)`,opacity:1,offset:.5},{transform:`translate(${dx}px,${-step*.4}px)`,opacity:0}],{duration,fill:'forwards'});
  const dust=document.createElement('div');dust.className='frog-dust';dust.style.setProperty('--x',f.x);dust.style.setProperty('--y',f.y);this.board.append(dust);this.active.add(dust);
  for(let frame=0;frame<8;frame++)this.later(()=>{dust.style.backgroundPosition=`${frame%4*100/3}% ${Math.floor(frame/4)*100}%`;},frame*45);
  this.later(()=>{actor.remove();dust.remove();this.active.delete(actor);this.active.delete(dust);this.departing=false;this.sound.play('frog-land');},duration);
 }
}

