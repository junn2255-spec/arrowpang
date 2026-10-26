import {move as singleMove,DIR,clone,key,hasBlockedCycle,Game as SingleGame} from './engine.js';
export{DIR,clone,key};
export function move(s,id,n,rocks=[],zones=[]){
 const first=singleMove(s,id,n,rocks,zones);if(!first.changed)return {...first,steps:[]};
 const steps=[{id,before:clone(s),beforeRocks:clone(rocks),result:first}];let state=first.state,currentRocks=first.rocks;
 // Only the original straight line behind a non-turning leader qualifies.
 const leader=s.find(b=>b.id===id);
 if(first.exit&&!first.events.some(e=>e.type==='rotate')){
  const [dx,dy]=DIR[leader.d];let x=leader.x-dx,y=leader.y-dy;
  while(x>=0&&y>=0&&x<n&&y<n){
   if(currentRocks.some(r=>r.hp>0&&r.x===x&&r.y===y))break;
   const b=state.find(q=>q.x===x&&q.y===y);
   if(b){if(b.d!==leader.d)break;const r=singleMove(state,b.id,n,currentRocks,zones);
    if(!r.exit||r.hit||r.loop||r.events.some(e=>e.type==='rotate'))break;
    steps.push({id:b.id,before:clone(state),beforeRocks:clone(currentRocks),result:r});state=r.state;currentRocks=r.rocks;
   }x-=dx;y-=dy;
  }
 }
 return {...first,state,rocks:currentRocks,steps,chainCount:steps.filter(s=>s.result.exit).length};
}
export const legal=(s,n,rocks=[],zones=[])=>s.map(b=>({id:b.id,...move(s,b.id,n,rocks,zones)})).filter(r=>r.changed);
export function solve(s,n,limit=150000,rocks=[],zones=[]){
 const nodes=[{state:s,rocks,parent:-1,id:null}],stack=[0],seen=new Set([key(s,rocks)]);let visited=0;
 while(stack.length){if(visited>=limit)return {path:null,visited,status:'limit'};const index=stack.pop(),node=nodes[index];visited++;
  if(!node.state.length){const path=[];for(let i=index;nodes[i].parent!==-1;i=nodes[i].parent)path.push(nodes[i].id);return{path:path.reverse(),visited,status:'solved'};}
   if(hasBlockedCycle(node.state))continue;
  const options=legal(node.state,n,node.rocks,zones);for(let i=options.length-1;i>=0;i--){const m=options[i],k=key(m.state,m.rocks);if(seen.has(k))continue;seen.add(k);nodes.push({state:m.state,rocks:m.rocks,parent:index,id:m.id});stack.push(nodes.length-1);}
 }return {path:null,visited,status:'unsolvable'};
}
export class Game extends SingleGame{
 play(id){if(this.won)return {changed:false,moved:false,state:this.blocks,rocks:this.rocks,events:[]};const r=move(this.blocks,id,this.level.n,this.rocks,this.level.zones??[]);if(!r.changed)return r;this.history.push({blocks:clone(this.blocks),rocks:clone(this.rocks),moves:this.moves,combo:this.combo,won:this.won});this.blocks=r.state;this.rocks=r.rocks;if(r.moved)this.moves++;this.combo=r.exit?this.combo+(r.chainCount||1):0;this.won=!this.blocks.length;return r;}
 get stuck(){return this.blocks.length>0&&!legal(this.blocks,this.level.n,this.rocks,this.level.zones??[]).length;}
}
