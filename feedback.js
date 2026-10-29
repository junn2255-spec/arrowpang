import {stonePlan,shardFrame} from './impact-plan.js';
const vectors={R:[1,0],D:[0,1],L:[-1,0],U:[0,-1]};
export class EffectPreferences{
 constructor(storage=globalThis.localStorage){this.storage=storage;this.vibration=true;this.reduce=false;try{const s=JSON.parse(storage?.getItem('arrowtok-effects')??'null');if(s){this.vibration=s.vibration!==false;this.reduce=s.reduce===true;}}catch{}}
 get reduced(){return this.reduce||!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
 toggle(key){this[key]=!this[key];try{this.storage?.setItem('arrowtok-effects',JSON.stringify({vibration:this.vibration,reduce:this.reduce}));}catch{}}
 vibrate(ms){if(this.vibration)try{globalThis.navigator?.vibrate?.(ms);}catch{}}
}
export const preferences=new EffectPreferences();
export class Feedback{
 constructor(doc=globalThis.document){this.doc=doc;this.pool=[];this.root=null;this.timers=new Set();this.cleanups=[];this.generation=0;this.maxParticles=24;}
 later(fn,ms){const g=this.generation;const id=setTimeout(()=>{this.timers.delete(id);if(g===this.generation)fn();},ms);this.timers.add(id);return id;}
 clear(){this.generation++;for(const id of this.timers)clearTimeout(id);this.timers.clear();for(const f of this.cleanups)f();this.cleanups=[];for(const p of this.pool){p.active=false;p.el.hidden=true;}this.root?.remove();this.attached=false;}
 attach(board){const r=board.getBoundingClientRect();if(!this.root){this.root=this.doc.createElement('div');this.root.className='feedback-layer';this.root.setAttribute('aria-hidden','true');for(let i=0;i<this.maxParticles;i++){const el=this.doc.createElement('i');el.hidden=true;this.root.append(el);this.pool.push({el,active:false});}}if(!this.attached){this.doc.body.append(this.root);this.attached=true;}Object.assign(this.root.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});this.cell=board.clientWidth/Number(board.dataset.n||5);return this.root;}
 pulse(el,name,duration=240){if(!el)return;el.classList.remove(name);void el.offsetWidth;el.classList.add(name);const remove=()=>el.classList.remove(name);this.cleanups.push(remove);this.later(remove,duration);}
 burst(board,x,y,count=5,kind='spark'){this.attach(board);const cap=preferences.reduced?Math.min(2,count):count;for(let i=0;i<cap;i++){const p=this.take(),v=p.version;p.el.style.backgroundImage='';p.el.style.width=p.el.style.height='';p.el.className='feedback-particle '+kind;const angle=2*Math.PI*i/cap,range=kind==='dust'?14:10;p.el.style.left=x+'px';p.el.style.top=y+'px';p.el.style.setProperty('--dx',Math.cos(angle)*range+'px');p.el.style.setProperty('--dy',Math.sin(angle)*range+'px');p.el.style.animation='none';void p.el.offsetWidth;p.el.style.animation='feedback-out 300ms ease-out forwards';this.later(()=>{if(p.version===v){p.active=false;p.el.hidden=true;}},300);}}
 impact(board,b,d,kind='spark'){const cell=board.clientWidth/Number(board.dataset.n||5),[dx,dy]=vectors[d];this.burst(board,(b.x+.5+dx*.45)*cell,(b.y+.5+dy*.45)*cell,kind==='dust'?5:4,kind);}
 settle(){for(const f of this.cleanups)f();this.cleanups=[];}
 take(){const p=this.pool.find(p=>!p.active)??this.pool.reduce((a,b)=>(a.serial??0)<(b.serial??0)?a:b);p.active=true;p.el.hidden=false;p.serial=(this.serial=(this.serial??0)+1);p.version=(p.version??0)+1;return p;}
 stone(board,rock,el,d,hp){this.attach(board);const rockArt=hp>=2?'assets/stone-obstacles-v2/cracked-rock.webp':'assets/stone-damage-v1/rock-hp'+(hp===1?2:1)+'.webp';const cell=this.cell,plan=stonePlan({hp,cell,d}),x=(rock.x+.5-plan.dx*.42)*cell,y=(rock.y+.5-plan.dy*.42)*cell;
  el?.style.setProperty('--hit-x',plan.dx*plan.push+'px');el?.style.setProperty('--hit-y',plan.dy*plan.push+'px');if(!preferences.reduced)this.pulse(el,'stone-push',170);
  if(this.doc.body.classList.contains('garden-theme')){if(hp>=0){const effect=this.doc.createElement('div');effect.className='garden-stone-break';Object.assign(effect.style,{left:rock.x*cell+'px',top:rock.y*cell+'px',width:cell+'px',height:cell+'px'});this.root.append(effect);const remove=()=>effect.remove();this.cleanups.push(remove);if(preferences.reduced){effect.style.backgroundImage="url('"+rockArt+"')";effect.animate?.([{opacity:1},{opacity:0}],{duration:150,fill:'forwards'});this.later(remove,150);}else{
// Full-size rock flashes into independently rotating, ballistic stone fragments.
const count=hp===0?12:6;
for(let i=0;i<count;i++){
 const piece=this.doc.createElement('i'),angle=(i/count)*Math.PI*2-.35;
 const size=cell*(hp===0?(i<4?.42:i<8?.25:.14):(.12+(i%3)*.04)),speed=cell*(hp===0?(.7+(i%4)*.22):(.35+(i%3)*.15));
 const dx=Math.cos(angle)*speed+plan.dx*cell*.18,dy=Math.sin(angle)*speed*.65;
 const spin=(i%2?1:-1)*(100+(i%5)*55),duration=560+(i%4)*65;
 piece.className='garden-stone-break-piece';
 Object.assign(piece.style,{left:(cell-size)/2+'px',top:(cell-size)/2+'px',width:size+'px',height:size+'px',backgroundImage:"url('assets/stone-shards-v1/shard-"+(i%4+1)+".webp')",backgroundSize:'contain',backgroundPosition:'center',filter:'drop-shadow(0 2px 1px rgba(0,0,0,.55))'});
 effect.append(piece);
 const frames=[0,.2,.4,.6,.8,1].map(t=>({offset:t,transform:'translate('+(dx*t)+'px,'+(dy*t+cell*1.2*t*t-cell*.65*t)+'px) rotate('+(spin*t)+'deg)',opacity:t<.6?1:1-(t-.6)/.4}));
 piece.animate?.(frames,{duration,delay:80,fill:'forwards',easing:'linear'});
}
this.burst(board,(rock.x+.5)*cell,(rock.y+.5)*cell,6,'dust');
this.later(remove,900);}}preferences.vibrate(plan.vibration);return plan;}
  const parts=preferences.reduced?plan.particles.slice(0,4):plan.particles;
  for(const particle of parts){const p=this.take(),v=p.version,e=p.el,q={...particle};if(x+q.dx<0||x+q.dx>board.clientWidth)q.dx=-q.dx;if(y+q.dy<0||y+q.dy>board.clientWidth)q.dy=-q.dy;q.arc=Math.min(q.arc,y+12);
   e.className='feedback-particle shard';e.style.left=x+'px';e.style.top=y+'px';e.style.width=e.style.height=q.size+'px';e.style.backgroundImage=`url('assets/ui/particle-${q.asset}.webp')`;for(const t of [.25,.5,.75,1]){const f=shardFrame(q,t),key=t*100;e.style.setProperty('--x'+key,f.x+'px');e.style.setProperty('--y'+key,f.y+'px');e.style.setProperty('--r'+key,f.rotation+'deg');}e.style.animation='none';void e.offsetWidth;e.style.animation=`shard-flight ${q.duration}ms linear forwards`;this.later(()=>{if(p.version===v){p.active=false;e.hidden=true;}},q.duration);
  }
  for(let i=0;i<(preferences.reduced?1:plan.dust);i++){const p=this.take(),v=p.version,e=p.el;e.className='feedback-particle stone-dust';e.style.backgroundImage="url('assets/ui/particle-4.webp')";e.style.width=e.style.height=cell*(hp===0?1.15:.75)+'px';e.style.left=(x+(i-1)*cell*.15)+'px';e.style.top=y+'px';e.style.setProperty('--dx',plan.dx*cell*.15+'px');e.style.setProperty('--dy',cell*.12+'px');e.style.animation='none';void e.offsetWidth;e.style.animation='feedback-out 420ms ease-out forwards';this.later(()=>{if(p.version===v){p.active=false;e.hidden=true;}},420);}
  if(!preferences.reduced){const p=this.take(),v=p.version,e=p.el;e.className='feedback-particle stone-flash';e.style.backgroundImage='none';e.style.width=e.style.height=cell*.25+'px';e.style.left=x+'px';e.style.top=y+'px';e.style.animation='impact-flash 65ms ease-out forwards';this.later(()=>{if(p.version===v){p.active=false;e.hidden=true;}},65);}
  preferences.vibrate(plan.vibration);return plan;
 }
 shakeScreen(){if(!preferences.reduced)this.pulse(this.doc.querySelector('main'),'gentle-shake',180);}
 undo(board,previous,restored){this.attach(board);const cell=this.cell;for(const b of restored){const old=previous.find(q=>q.id===b.id);if(old&&old.x===b.x&&old.y===b.y&&old.d===b.d)continue;const target=this.doc.querySelector(`[data-id="${b.id}"]`);if(!target)continue;const source=old??{x:b.d==='R'?Number(board.dataset.n):b.d==='L'?-1:b.x,y:b.d==='D'?Number(board.dataset.n):b.d==='U'?-1:b.y};const proxy=this.doc.createElement('div');proxy.className='block feedback-return';proxy.dataset.dir=b.d;proxy.innerHTML='<span></span>';proxy.style.width=proxy.style.height=cell+'px';proxy.style.transform=`translate(${source.x*cell}px,${source.y*cell}px)`;this.root.append(proxy);target.style.visibility='hidden';const restore=()=>{target.style.visibility='';proxy.remove();};this.cleanups.push(restore);this.later(()=>{proxy.style.transition='transform 170ms ease-out';proxy.style.transform=`translate(${b.x*cell}px,${b.y*cell}px)`;},1);this.later(restore,180);this.burst(board,(b.x+.5)*cell,(b.y+.5)*cell,2,'reverse');}}
}
