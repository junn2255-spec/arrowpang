export const DIR={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]};
export const CLOCKWISE={U:'R',R:'D',D:'L',L:'U'};
export const clone=s=>s.map(b=>({...b}));
export function move(s,id,n,rocks=[],zones=[]){
 const b=s.find(b=>b.id===id),unchanged={moved:false,changed:false,state:s,rocks,events:[]};if(!b)return unchanged;
 let x=b.x,y=b.y,d=b.d,moved=false,hit=null;const seen=new Set(),events=[];let segment={x,y};
 const flush=(exit=false)=>{if(x!==segment.x||y!==segment.y){events.push({type:'move',x,y,d,exit});segment={x,y};}};
 // Only entry into a zone turns. Starting on a zone does not trigger it.
 while(true){const routeKey=`${x},${y},${d},advance`;if(seen.has(routeKey))return {...unchanged,loop:true,reason:'rotation-loop'};seen.add(routeKey);
  const [dx,dy]=DIR[d],nx=x+dx,ny=y+dy;
  if(nx<0||ny<0||nx>=n||ny>=n){x=nx;y=ny;flush(true);return {moved:true,changed:true,exit:true,state:s.filter(q=>q.id!==id),rocks,to:{x,y},events};}
  if(s.some(q=>q.id!==id&&q.x===nx&&q.y===ny))break;
  hit=rocks.find(q=>q.hp>0&&q.x===nx&&q.y===ny);if(hit)break;
  x=nx;y=ny;moved=true;
  if(zones.some(z=>z.x===x&&z.y===y)){flush();events.push({type:'pause',duration:100});const from=d;d=CLOCKWISE[d];events.push({type:'rotate',from,d,duration:200});}
 }
 flush();const nextRocks=hit?rocks.filter(q=>q.id!==hit.id||q.hp>1).map(q=>q.id===hit.id?{...q,hp:q.hp-1}:q):rocks;
 const hitResult=hit?{id:hit.id,hp:hit.hp-1,broken:hit.hp===1}:null;if(hitResult)events.push({type:'hit',...hitResult});
 return {moved,changed:moved||!!hit,exit:false,to:{x,y},state:moved?s.map(q=>q.id===id?{...q,x,y,d}:q):s,rocks:nextRocks,hit:hitResult,events};
}
export const key=(s,rocks=[])=>s.map(b=>`${b.id}:${b.x},${b.y},${b.d}`).sort().join('|')+'#'+rocks.map(r=>`${r.id}:${r.x},${r.y},${r.hp}`).sort().join('|');
export const legal=(s,n,rocks=[],zones=[])=>s.map(b=>({id:b.id,...move(s,b.id,n,rocks,zones)})).filter(m=>m.changed);
// Iterative graph search handles cross-action cycles and distinguishes a search cap.
// This is a valid solution, not a shortest-click or minimum-displayed-move claim.
// A cycle of immediately adjacent arrows cannot move even once: no member
// can reach a zone or rock until another member moves. Other actions cannot
// release this cycle. This is an exact unsolvability certificate, not a budget.
export function hasBlockedCycle(s){
 const occupied=new Map(s.map(b=>[`${b.x},${b.y}`,b])),done=new Set();
 for(const start of s){const route=new Set();let b=start;while(b&&!done.has(b.id)){if(route.has(b.id))return true;route.add(b.id);const[dx,dy]=DIR[b.d];b=occupied.get(`${b.x+dx},${b.y+dy}`);}for(const id of route)done.add(id);}
 return false;
}
export function solve(s,n,limit=150000,rocks=[],zones=[]){
 const nodes=[{state:s,rocks,parent:-1,id:null}],stack=[0],seen=new Set([key(s,rocks)]);let visited=0;
 while(stack.length){if(visited>=limit)return {path:null,visited,status:'limit'};const index=stack.pop(),node=nodes[index];visited++;
  if(!node.state.length){const path=[];for(let i=index;nodes[i].parent!==-1;i=nodes[i].parent)path.push(nodes[i].id);return{path:path.reverse(),visited,status:'solved'};}
   if(hasBlockedCycle(node.state))continue;
  const options=legal(node.state,n,node.rocks,zones);for(let i=options.length-1;i>=0;i--){const m=options[i],k=key(m.state,m.rocks);if(seen.has(k))continue;seen.add(k);nodes.push({state:m.state,rocks:m.rocks,parent:index,id:m.id});stack.push(nodes.length-1);}
 }return {path:null,visited,status:'unsolvable'};
}
export class Game{
 constructor(level){this.level=level;this.restart();}
 restart(){this.blocks=clone(this.level.blocks);this.rocks=clone(this.level.rocks??[]);this.moves=0;this.combo=0;this.won=false;this.history=[];}
 play(id){if(this.won)return {moved:false,changed:false,state:this.blocks,rocks:this.rocks,events:[]};const r=move(this.blocks,id,this.level.n,this.rocks,this.level.zones??[]);if(!r.changed)return r;
  this.history.push({blocks:clone(this.blocks),rocks:clone(this.rocks),moves:this.moves,combo:this.combo,won:this.won});this.blocks=r.state;this.rocks=r.rocks;if(r.moved)this.moves++;this.combo=r.exit?this.combo+1:0;this.won=!this.blocks.length;return r;
 }
 undo(){const s=this.history.pop();if(!s)return false;Object.assign(this,s);return true;}
 get stuck(){return this.blocks.length>0&&!legal(this.blocks,this.level.n,this.rocks,this.level.zones??[]).length;}
}
