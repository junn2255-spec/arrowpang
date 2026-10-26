export const RAINBOW_STAGES=Object.freeze({4:1,6:1,8:1,12:2,16:1,20:1,23:2,28:1,31:2,35:1,38:1});
export function rainbowLevel(level,number){
 const count=RAINBOW_STAGES[number]??0;
 const ids=new Set(Array.from({length:count},(_,i)=>level.blocks[Math.floor(i*level.blocks.length/count)]?.id));
 return {...level,blocks:level.blocks.map(b=>({...b,rainbow:ids.has(b.id)}))};
}
// Keep a second rainbow available for its own escape and reward.
export function rainbowExit(result,leader){
 if(!leader?.rainbow||!result.exit)return result;
 const targets=result.state.filter(b=>!b.rainbow).sort((a,b)=>
  Math.max(Math.abs(a.x-leader.x),Math.abs(a.y-leader.y))-Math.max(Math.abs(b.x-leader.x),Math.abs(b.y-leader.y))||
  Math.abs(a.x-leader.x)+Math.abs(a.y-leader.y)-Math.abs(b.x-leader.x)-Math.abs(b.y-leader.y)||String(a.id).localeCompare(String(b.id))).slice(0,3);
 const ids=new Set(targets.map(b=>b.id));
 return {...result,state:result.state.filter(b=>!ids.has(b.id)),events:[...result.events,{type:'special',kind:'rainbow',id:leader.id,x:leader.x,y:leader.y,removedBlocks:targets,removedRocks:[],duration:650}]};
}
