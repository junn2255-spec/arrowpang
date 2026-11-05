
import {Game as Original} from './special-engine.js';
import {move as singleMove,DIR,clone} from './engine.js';
import {FIXED_BOARDS} from './gem-layouts.js';
export const GEM_STAGES=Array.from({length:20},(_,i)=>({stage:i+1,target:5,limit:i<10?[80,80,80,80,80,80,80,80,80,85][i]:[75,85,70,80,85,65,75,90,74,80][i-10],specialCount:0}));
export function makeWave(config,wave=0){


 const source=FIXED_BOARDS[config.stage-1][wave];
 return structuredClone(source);
}
// Resolve each arrow against the current board before advancing its followers.
export function gemMove(blocks,id,n,rocks=[],zones=[],specials=[],used=[],gems=[]){
 const leader=blocks.find(b=>b.id===id);if(!leader)return {changed:false,events:[],state:blocks,rocks};
 const [dx,dy]=DIR[leader.d],followers=[];
 for(let x=leader.x-dx,y=leader.y-dy;x>=0&&y>=0&&x<n&&y<n;x-=dx,y-=dy){const b=blocks.find(q=>q.x===x&&q.y===y);if(b){if(b.d!==leader.d||b.rainbow)break;followers.push(b.id);}}
 const protectedIds=new Set([id,...followers]);let state=clone(blocks),currentRocks=clone(rocks);const consumed=new Set(used),steps=[],specialEvents=[];
 for(const arrowId of [id,...followers]){
  const arrow=state.find(q=>q.id===arrowId);if(!arrow)continue;
  const before=clone(state),beforeRocks=clone(currentRocks),beforeUsed=[...consumed];
  const markers=[...gems,...specials.filter(p=>!consumed.has(p.id))].map((p,i)=>({...p,id:'obstacle-'+i,d:'U',obstacle:true}));
  let r=singleMove([...state,...markers],arrowId,n,currentRocks,zones);
  r.state=r.state.filter(q=>!q.obstacle);
  const end=r.state.find(q=>q.id===arrowId)??arrow,[sx,sy]=DIR[end.d];
  const pickup=!r.exit&&!r.hit&&!r.loop&&specials.find(p=>!consumed.has(p.id)&&p.x===end.x+sx&&p.y===end.y+sy);
  if(pickup){const last=r.events.at(-1);if(last?.type==='move'&&last.d===end.d){last.x=pickup.x;last.y=pickup.y;last.contact=true;}else r.events.push({type:'move',x:pickup.x,y:pickup.y,d:end.d,exit:false,contact:true});r.state=r.state.filter(q=>q.id!==arrowId);r.changed=true;r.moved=true;r.consumed=true;r.to={x:pickup.x,y:pickup.y};}
  if(!r.changed){if(!steps.length)return {...r,steps:[],used:[...consumed]};break;}
  state=r.state;currentRocks=r.rocks;
  const queue=pickup?[pickup]:[];if((r.exit||r.consumed)&&arrow.rainbow)queue.push({...r.to,id:arrow.id,kind:'rainbow'});
  while(queue.length){const p=queue.shift();if(consumed.has(p.id))continue;consumed.add(p.id);
   const keyGuards=new Set(state.filter(b=>!b.rainbow && specials.some(k=>k.kind==='key' && !consumed.has(k.id) && b.x+DIR[b.d][0]===k.x && b.y+DIR[b.d][1]===k.y)).map(b=>b.id));
   const groups=['L','R','U','D'].map(d=>state.filter(q=>!protectedIds.has(q.id)&&!keyGuards.has(q.id)&&q.d===d));
   const removed=(groups.filter(g=>g.length>=3).sort((a,b)=>distance(a[0],p)-distance(b[0],p))[0]??[]).slice(0,3);
   for (const bomb of specials) {
    if (bomb.kind !== 'bomb' || consumed.has(bomb.id)) continue;
    if (distance(p, bomb) === 1 || removed.some(block => distance(block, bomb) === 1)) queue.push(bomb);
   }
   const ids=new Set(removed.map(q=>q.id));state=state.filter(q=>!ids.has(q.id));
   const event={type:'special',kind:p.kind,id:p.id,x:p.x,y:p.y,contactId:pickup===p?arrowId:null,removedBlocks:removed,removedRocks:[],duration:420};r.events.push(event);specialEvents.push(event);
   for(const q of removed)if(q.rainbow)queue.push({...q,kind:'rainbow'});
  }
  r.state=clone(state);steps.push({id:arrowId,before,beforeRocks,beforeUsed,result:r});
  if(!(r.exit||r.consumed)||r.events.some(e=>e.type==='rotate'))break;
 }
 const first=steps[0].result,remaining=new Set(state.map(q=>q.id)),removed=blocks.filter(q=>!remaining.has(q.id));
 return {...first,state,rocks:currentRocks,steps,used:[...consumed],specialEvents,chainCount:steps.filter(s=>s.result.exit||s.result.consumed).length,qualifies:removed.length>=3};
}
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export class Game extends Original{
 constructor(level){super(level);if(level.gemMission){this.level={...level};this.restart();}}
 restart(){super.restart();if(this.level.gemMission){this.gemState={rule:14,cleared:0,wave:0,pair:0,color:null,run:0,waveCleared:0,failed:false};this.loadWave();this.frogs=[];}}
 loadWave(){const w=makeWave(this.level.gemConfig,this.gemState.wave);this.blocks=w.blocks;this.rocks=w.rocks;this.used=[];this.level={...this.level,blocks:w.blocks,specials:w.specials,zones:w.zones};this.gemState.gems=w.gems;this.gemState.waveCleared=0;this.gemState.color=null;this.gemState.run=0;this.gemState.pair=0;}
 snapshot(){return {...super.snapshot(),...(this.level.gemMission?{level:structuredClone(this.level)}:{}),gemState:this.gemState?structuredClone(this.gemState):null};}
 get activeGems(){const s=this.gemState;return s?s.gems.slice(s.waveCleared,s.waveCleared+this.level.gemConfig.target-s.cleared):[];}
 play(id){if(!this.level.gemMission)return super.play(id);if(this.gemState.failed||this.won)return {changed:false,events:[]};
 const r=gemMove(this.blocks,id,this.level.n,this.rocks,this.level.zones??[],this.level.specials,this.used,this.activeGems);if(!r.changed)return r;
 this.history.push(this.snapshot());this.blocks=r.state;this.rocks=r.rocks;this.used=r.used;this.moves++;r.comboEvents=[];
 const s=this.gemState,c=this.level.gemConfig;r.gemBreaks=[];
 // Coin rewards retain their existing natural-escape accounting.
 for(const step of r.steps??[]){if(!step.result.exit)continue;
  const arrow=step.before.find(q=>q.id===step.id),color=arrow.color??arrow.d;

  this.naturalEscaped.push(step.id);this.escapeColors.push({id:step.id,color});
  this.combo=this.comboColor===color?this.combo+1:1;this.comboColor=color;
  if(this.combo===3||this.combo===4)r.comboEvents.push({rule:'same-color-v1',tier:this.combo,color,amount:this.combo===3?15:20,naturalCount:this.naturalEscaped.length,escapeCount:this.escapeColors.length});
 }
 // One action removing at least three arrows is one success, regardless of color or cause.
 const beforeIds=new Set(this.history.at(-1).blocks.map(b=>b.id));
 const remainingIds=new Set(this.blocks.map(b=>b.id));
 r.removedCount=[...beforeIds].filter(id=>!remainingIds.has(id)).length;
 if(!this.blocks.length){this.rocks=[];this.level={...this.level,zones:[],specials:[]};r.railBreak=s.cleared++;}
 this.won=s.cleared>=c.target;s.failed=!this.won&&this.moves>=c.limit;
 if(!this.won&&!s.failed&&!this.blocks.length){s.wave++;this.loadWave();r.refilled=true;}
 return r;}
}
