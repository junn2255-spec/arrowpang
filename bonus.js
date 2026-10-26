import{hasHomeFeature}from'./home-ownership.js';
export const BONUS_NAMES={treat:'강아지 간식',pinwheels:'바람개비',appleTree:'사과나무',lamps:'정원등'};
export const BONUS_IMAGES={treat:'treat',pinwheels:'pinwheel-wing-0',appleTree:'apple-tree',lamps:'garden-lamp'};
export const BONUS_ROOT='assets/bonus/';
// Additive save extension: existing economy, puzzle and house fields are untouched.
export function bonusState(v){
 if(!v.bonus)v.bonus={version:2,treats:0,decor:{},placed:{},broken:{},breakCount:0,drops:0};
 if(v.bonus.version!==2){v.bonus.placed={...v.bonus.decor};v.bonus.version=2;}
 v.bonus.placed??={};
 if(!v.bonus.treatStages){v.bonus.treatStages={};for(const [key,event]of Object.entries(v.bonus.broken))if(event.item==='treat')v.bonus.treatStages[key.slice(0,key.lastIndexOf(':'))]={run:event.run};}
 return v.bonus;
}
export function claimRockBonus(v,{stage,stageNumber,rockId,run}){
 if(!run||!stage||!Number.isInteger(stageNumber)||stageNumber<7||rockId==null)return null;
 const b=bonusState(v),key=stage+':'+rockId,awards=[];
 // Treats are stage awards, independent of the unique-rock decoration counter.
 // If the puppy unlocks later, the first eligible destruction can still claim it.
 if(hasHomeFeature(v,'dog')&&stageNumber<=39&&stageNumber%2===1&&!Object.hasOwn(b.treatStages,stage)){
  if(!Number.isSafeInteger(b.treats+1))throw Error('간식 수량을 저장할 수 없어요.');
  b.treats++;b.treatStages[stage]={run,rockId};awards.push('treat');
 }
 // Restarts, undo and reload never count a stage rock twice for decorations.
 if(!Object.hasOwn(b.broken,key)){
  b.broken[key]={run};b.breakCount++;
  if(b.breakCount%5===0){
   const candidates=['pinwheels','appleTree','lamps'].filter(k=>!b.decor[k]);
   if(candidates.length){const kind=candidates[b.drops%candidates.length];b.decor[kind]=true;b.drops++;b.broken[key].item=kind;awards.push(kind);}
  }
 }
 return awards.length?{kind:awards[0],name:awards.map(k=>BONUS_NAMES[k]).join(' · '),items:awards}:null;
}
export function spendTreat(v){const b=bonusState(v);if(!hasHomeFeature(v,'dog')||b.treats<1)return false;b.treats--;return true;}
export function applyDecor(v,kind){const b=bonusState(v);if(!['pinwheels','appleTree','lamps'].includes(kind)||!b.decor[kind]||b.placed[kind])return false;b.placed[kind]=true;return true;}
export function bonusDecorHTML(v){
 const d=bonusState(v).placed,img=(file,cls)=>'<img loading="lazy" class="bonus-decor '+cls+'" src="'+BONUS_ROOT+file+'.webp" alt="">';
 return (d.appleTree?img('apple-tree','bonus-tree'):'')+(d.lamps?img('garden-lamp','bonus-lamp lamp-left')+img('garden-lamp','bonus-lamp lamp-right'):'')+(d.pinwheels?'<div class="bonus-pinwheels" aria-hidden="true">'+[0,1,2].map(i=>'<span class="bonus-pinwheel wheel-'+i+'"><img class="pinwheel-post" src="'+BONUS_ROOT+'pinwheel-post.webp" alt=""><img class="pinwheel-wing" src="'+BONUS_ROOT+'pinwheel-wing-'+i+'.webp" alt=""></span>').join('')+'</div>':'');
}
export class RockBonusFX{
 constructor({reduced=()=>false,sound}={}){this.reduced=reduced;this.sound=sound;this.nodes=new Set();this.timers=new Set();this.audio=new Map();this.activeAudio=new Set();this.pending=new Set();this.preloaded=false;document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});globalThis.addEventListener('pagehide',()=>this.clear());}
 preload(){if(this.preloaded)return;this.preloaded=true;for(const name of [...Object.values(BONUS_IMAGES),...Array.from({length:8},(_,i)=>'burst-'+i)]){const im=new Image();im.src=BONUS_ROOT+name+'.webp';}}
 later(fn,ms){const t=setTimeout(()=>{this.timers.delete(t);fn();},ms);this.timers.add(t);}
 playSound(kind){
  const base=this.sound;if(!base?.ready||!base.sfx||base.hidden||!base.AudioType)return;
  const feeding=kind==='feed',file=feeding?'assets/sound3/팝통통.mp3':'assets/bonus/bonus-award.mp3',limit=feeding?600:3600;
  try{let a=this.audio.get(file);if(!a){a=new base.AudioType(file);a.preload='auto';a.addEventListener?.('ended',()=>this.activeAudio.delete(a));this.audio.set(file,a);}a.pause();a.currentTime=0;a.volume=feeding?.25:.30;this.activeAudio.add(a);Promise.resolve(a.play()).catch(()=>this.activeAudio.delete(a));
   for(let t=40;t<=limit;t+=40)this.later(()=>{if(!this.activeAudio.has(a))return;if(!base.sfx||base.hidden||t===limit){a.pause();this.activeAudio.delete(a);}else if(t>=limit-120)a.volume*=.65;},t);
  }catch{}
 }
 clear(){for(const t of this.timers)clearTimeout(t);this.timers.clear();for(const n of this.nodes){n.getAnimations?.().forEach(a=>a.cancel());n.remove();}this.nodes.clear();for(const a of this.activeAudio){try{a.pause();}catch{}}this.activeAudio.clear();for(const resolve of this.pending)resolve(false);this.pending.clear();}
 show(board,rock,n,item){
  if(document.hidden||!board?.isConnected)return;this.clear();this.preload();this.playSound('award');
  const rect=board.getBoundingClientRect(),cell=rect.width/n,size=Math.min(innerWidth*.62,250),node=document.createElement('div');node.className='rock-bonus-fx bonus-large';node.setAttribute('role','status');node.style.width=size+'px';node.style.left=Math.max(8,Math.min(innerWidth-size-8,rect.left+(rock.x+.5)*cell-size/2))+'px';node.style.top=Math.max(8,Math.min(innerHeight-size-50,rect.top+(rock.y+.5)*cell-size/2))+'px';
  const burst=document.createElement('img');burst.className='bonus-burst';burst.alt='';burst.src=BONUS_ROOT+'burst-'+(this.reduced()?3:0)+'.webp';node.append(burst);
  const items=item.items??[item.kind],icons=document.createElement('div');icons.className='bonus-award-icons';
  for(const kind of items){const icon=document.createElement('img');icon.className='bonus-drop-icon';icon.alt=BONUS_NAMES[kind];icon.src=BONUS_ROOT+BONUS_IMAGES[kind]+'.webp';icons.append(icon);}node.append(icons);
  const label=document.createElement('span');label.textContent=item.name+' 획득!';node.append(label);document.body.append(node);this.nodes.add(node);
  if(!this.reduced()){for(let i=1;i<8;i++)this.later(()=>{burst.src=BONUS_ROOT+'burst-'+i+'.webp';},i*100);for(let i=0;i<6;i++){const star=document.createElement('img');star.className='bonus-award-spark';star.src='assets/ui/sparkle-1.webp';star.alt='';star.style.left=(12+i*14)+'%';star.style.top=(i%2?72:14)+'%';star.style.animationDelay=(i*30)+'ms';node.append(star);}}
  const duration=3000;node.animate?.([{opacity:1},{opacity:1,offset:.85},{opacity:0}],{duration,fill:'forwards'});this.later(()=>{node.remove();this.nodes.delete(node);},duration);
 }
 feed(from,dog){
  this.clear();if(document.hidden||!dog?.isConnected)return Promise.resolve(false);
  const r=dog.getBoundingClientRect(),source=from?.getBoundingClientRect(),size=r.width/2,x=Math.max(8,Math.min(innerWidth-size-8,(source?.left??innerWidth*.25)-size/2)),y=Math.max(8,Math.min(innerHeight-size-8,(source?.top??r.top)-size));
  const node=document.createElement('img');node.src=BONUS_ROOT+'treat.webp';node.alt='강아지에게 간식 주는 중';node.className='bonus-flying-treat';Object.assign(node.style,{width:size+'px',height:size+'px',left:x+'px',top:y+'px'});document.body.append(node);this.nodes.add(node);this.playSound('feed');const dx=r.left+r.width*.5-size*.5-x,dy=r.top+r.height*.5-size*.5-y,duration=this.reduced()?200:750;
  node.animate?.(this.reduced()?[{opacity:1},{opacity:0}]:[{transform:'translate(0,0) scale(.85)',opacity:0},{transform:'translate(0,-15px) scale(1.1)',opacity:1,offset:.2},{transform:`translate(${dx*.45}px,${Math.min(-45,dy-35)}px) scale(1)`,opacity:1,offset:.55},{transform:`translate(${dx}px,${dy}px) scale(.5)`,opacity:0}],{duration,easing:'ease-in-out',fill:'forwards'});
  return new Promise(resolve=>{this.pending.add(resolve);this.later(()=>{this.pending.delete(resolve);node.remove();this.nodes.delete(node);resolve(true);},duration);});
 }
}
