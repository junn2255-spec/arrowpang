export const FROG_STAGES=[21,23,26,28,33,35,39];
const dirs={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]};
export function initialFrogs(level){
 const stage=Number(String(level.id).match(/(\d+)$/)?.[1]);if(!FROG_STAGES.includes(stage))return [];
 const occupied=new Set([...level.blocks,...(level.rocks??[]),...(level.zones??[]),...(level.specials??[])].map(p=>`${p.x},${p.y}`));
 const candidates=[],seen=new Set();
 const add=(x,y)=>{const key=`${x},${y}`;if(x<0||y<0||x>=level.n||y>=level.n||occupied.has(key)||seen.has(key))return;seen.add(key);candidates.push({id:`frog-${stage}-${candidates.length+1}`,x,y});};
 for(const b of level.blocks){const [dx,dy]=dirs[b.d];add(b.x+dx,b.y+dy);}
 for(let y=0;y<level.n;y++)for(let x=0;x<level.n;x++)add(x,y);
 return candidates.slice(0,2);
}
export function frogOnPath(result,blocks,id,frogs){
 for(const step of result.steps?.length?result.steps:[{id,before:blocks,result}]){
  const b=step.before.find(b=>b.id===step.id);if(!b)continue;let x=b.x,y=b.y;
  for(const event of step.result.events??[]){if(event.type!=='move')continue;
   const dx=Math.sign(event.x-x),dy=Math.sign(event.y-y),length=Math.max(Math.abs(event.x-x),Math.abs(event.y-y));
   for(let i=0;i<length;i++){x+=dx;y+=dy;const f=frogs.find(f=>f.x===x&&f.y===y);if(f)return f;}
  }
 }
 return null;
}
