import{rainbowLevel,rainbowExit}from'./rainbow-rules.js';
import{DIR,CLOCKWISE,clone,key,move as ordinaryMove}from'./engine.js';
import{move as chainMove}from'./chain-engine.js';
export{DIR,clone,key};
const copy=x=>structuredClone(x);
export function missionSpecials(level,number=Number(String(level.id??'').match(/(\d+)$/)?.[1])){if(!Number.isInteger(number)||number<1)return level;return {...rainbowLevel(level,number),specials:(level.specials??[]).filter(q=>q.kind==='bomb'?number%2===1:q.kind==='key'?number%3===0:true)};}
function single(s,id,n,rocks,zones,specials,used){
 if(!specials.length)return rainbowExit({...ordinaryMove(s,id,n,rocks,zones),used:[...used]},s.find(b=>b.id===id));
 const b=s.find(q=>q.id===id);if(!b)return{changed:false,moved:false,state:s,rocks,events:[],used:[...used]};
 let state=clone(s),stone=clone(rocks),x=b.x,y=b.y,d=b.d,moved=false,hit=null,collision=false;const consumed=new Set(used),seen=new Set(),events=[];let segment={x,y};
 const flush=(exit=false)=>{if(x!==segment.x||y!==segment.y){events.push({type:'move',x,y,d,exit});segment={x,y};}};
 while(true){const k=`${x},${y},${d},${[...consumed].sort()}`;if(seen.has(k))return{changed:false,moved:false,state:s,rocks,events:[],loop:true,used:[...used]};seen.add(k);const[dx,dy]=DIR[d],nx=x+dx,ny=y+dy;
  if(nx<0||ny<0||nx>=n||ny>=n){x=nx;y=ny;flush(true);return rainbowExit({changed:true,moved:true,exit:true,state:state.filter(q=>q.id!==id),rocks:stone,to:{x,y},events,used:[...consumed],collision:false},b);}
  if(state.some(q=>q.id!==id&&q.x===nx&&q.y===ny)){collision=true;break;}hit=stone.find(q=>q.hp>0&&q.x===nx&&q.y===ny);if(hit){collision=true;break;}x=nx;y=ny;moved=true;
  const pickup=specials.find(q=>q.x===x&&q.y===y&&!consumed.has(q.id));if(pickup){flush();consumed.add(pickup.id);let removedRocks=[],removedBlocks=[];if(pickup.kind==='key'){
    // Remove up to two nearest rocks. One key per stage.
    for(const q of specials.filter(q=>q.kind==='key'))consumed.add(q.id);
    const ordered=[...stone].sort((a,b)=>(Math.abs(a.x-x)+Math.abs(a.y-y))-(Math.abs(b.x-x)+Math.abs(b.y-y))||String(a.id).localeCompare(String(b.id)));removedRocks=ordered.slice(0,2);const ids=new Set(removedRocks.map(q=>q.id));stone=stone.filter(q=>!ids.has(q.id));
   }else{removedBlocks=[{...b,x,y,d},...state.filter(q=>q.id!==id).sort((a,b)=>Math.max(Math.abs(a.x-x),Math.abs(a.y-y))-Math.max(Math.abs(b.x-x),Math.abs(b.y-y))||(Math.abs(a.x-x)+Math.abs(a.y-y))-(Math.abs(b.x-x)+Math.abs(b.y-y))||String(a.id).localeCompare(String(b.id))).slice(0,2)];const ids=new Set(removedBlocks.map(q=>q.id));state=state.filter(q=>!ids.has(q.id));}
   events.push({type:'special',kind:pickup.kind,id:pickup.id,x,y,removedRocks,removedBlocks,duration:pickup.kind==='key'?560:640});
   if(pickup.kind==='bomb')return{changed:true,moved:true,exit:false,bombRemoved:true,state,rocks:stone,to:{x,y},events,used:[...consumed],collision:false};
  }
  if(zones.some(q=>q.x===x&&q.y===y)){flush();events.push({type:'pause',duration:100});const from=d;d=CLOCKWISE[d];events.push({type:'rotate',from,d,duration:200});}
 }
 flush();const hitResult=hit?{id:hit.id,hp:hit.hp-1,broken:hit.hp===1}:null;if(hit){stone=stone.filter(q=>q.id!==hit.id||q.hp>1).map(q=>q.id===hit.id?{...q,hp:q.hp-1}:q);events.push({type:'hit',...hitResult});}
 return{changed:moved||!!hit,moved,exit:false,to:{x,y},state:moved?state.map(q=>q.id===id?{...q,x,y,d}:q):state,rocks:stone,hit:hitResult,events,collision,used:[...consumed]};
}
export function move(s,id,n,rocks=[],zones=[],specials=[],used=[]){
 if(!specials.length&&!s.some(b=>b.rainbow)){const r=chainMove(s,id,n,rocks,zones);return{...r,used:[...used],collision:!r.exit&&!r.loop};}
 const first=single(s,id,n,rocks,zones,specials,used);if(!first.changed)return{...first,steps:[]};const steps=[{id,before:clone(s),beforeRocks:clone(rocks),beforeUsed:[...used],result:first}];let state=first.state,stone=first.rocks,consumed=first.used;const leader=s.find(q=>q.id===id);
 if(first.exit&&!first.events.some(e=>e.type==='rotate')){const[dx,dy]=DIR[leader.d];let x=leader.x-dx,y=leader.y-dy;while(x>=0&&y>=0&&x<n&&y<n){if(stone.some(q=>q.x===x&&q.y===y))break;const b=state.find(q=>q.x===x&&q.y===y);if(b){if(b.d!==leader.d)break;const r=single(state,b.id,n,stone,zones,specials,consumed);if(!r.exit||r.hit||r.loop||r.events.some(e=>e.type==='rotate'))break;steps.push({id:b.id,before:clone(state),beforeRocks:clone(stone),beforeUsed:[...consumed],result:r});state=r.state;stone=r.rocks;consumed=r.used;}x-=dx;y-=dy;}}
 return{...first,state,rocks:stone,used:consumed,steps,chainCount:steps.filter(q=>q.result.exit).length,specialEvents:steps.flatMap(q=>q.result.events.filter(e=>e.type==='special'))};
}
export function facingPairs(blocks,rocks=[],zones=[]){const pairs=[];for(const a of blocks){const[dx,dy]=DIR[a.d];let x=a.x+dx,y=a.y+dy;while(x>=0&&y>=0&&x<100&&y<100){if(rocks.some(q=>q.x===x&&q.y===y)||zones.some(q=>q.x===x&&q.y===y))break;const b=blocks.find(q=>q.id!==a.id&&q.x===x&&q.y===y);if(b){if(DIR[b.d][0]===-dx&&DIR[b.d][1]===-dy&&!pairs.some(p=>p.includes(a.id)&&p.includes(b.id)))pairs.push([a.id,b.id]);break;}x+=dx;y+=dy;}}return pairs;}
export function solve(s,n,limit=150000,rocks=[],zones=[],specials=[],used=[]){const nodes=[{state:s,rocks,used,parent:-1,id:null}],stack=[0],seen=new Set([key(s,rocks)+'#'+[...used].sort()]);let visited=0;while(stack.length){if(visited>=limit)return{path:null,visited,status:'limit'};const i=stack.pop(),node=nodes[i];visited++;if(!node.state.length){const path=[];for(let j=i;nodes[j].parent!==-1;j=nodes[j].parent)path.push(nodes[j].id);return{path:path.reverse(),visited,status:'solved'};}const options=node.state.map(b=>({id:b.id,...move(node.state,b.id,n,node.rocks,zones,specials,node.used)})).filter(r=>r.changed);options.sort((a,b)=>a.state.length-b.state.length||a.rocks.length-b.rocks.length);for(let j=options.length-1;j>=0;j--){const m=options[j],k=key(m.state,m.rocks)+'#'+m.used.slice().sort();if(seen.has(k))continue;seen.add(k);nodes.push({state:m.state,rocks:m.rocks,used:m.used,parent:i,id:m.id});stack.push(nodes.length-1);}}return{path:null,visited,status:'unsolvable'};}
export class Game{
 constructor(level){this.level=missionSpecials(level);this.restart();}
 restart(){this.blocks=clone(this.level.blocks);this.rocks=clone(this.level.rocks??[]);this.used=[];this.naturalEscaped=[];this.bombEscaped=[];this.moves=0;this.combo=0;this.won=false;this.history=[];}
 snapshot(){return copy({blocks:this.blocks,rocks:this.rocks,used:this.used,naturalEscaped:this.naturalEscaped,bombEscaped:this.bombEscaped,moves:this.moves,combo:this.combo,won:this.won});}
 play(id){if(this.won)return{changed:false,events:[]};const r=move(this.blocks,id,this.level.n,this.rocks,this.level.zones??[],this.level.specials??[],this.used);r.comboEvents=[];if(!r.changed){if(!r.loop)this.combo=0;return r;}this.history.push(this.snapshot());this.blocks=r.state;this.rocks=r.rocks;this.used=r.used;if(r.moved)this.moves++;
  for(const step of r.steps??[{id,result:r}]){for(const e of step.result.events??[])if(e.type==='special'&&e.kind==='bomb')this.bombEscaped.push(...e.removedBlocks.map(b=>b.id));if(step.result.exit){this.naturalEscaped.push(step.id);const tier=this.combo+1;this.combo=tier===5?0:tier;r.comboEvents.push({tier,amount:tier>=3?tier*10:0,naturalCount:this.naturalEscaped.length});}else if(!step.result.loop&&!step.result.bombRemoved)this.combo=0;}
  this.won=this.blocks.length===0;return r;
 }
 undo(){const s=this.history.pop();if(!s)return false;Object.assign(this,copy(s));return true;}
 get stuck(){return this.blocks.length>0&&!this.blocks.some(b=>move(this.blocks,b.id,this.level.n,this.rocks,this.level.zones??[],this.level.specials??[],this.used).changed);}
}
