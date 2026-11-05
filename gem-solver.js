import {facingPairs} from './special-engine.js';
import {VERIFIED_ROUTES} from './gem-routes.js';
import {Game,GEM_STAGES} from './gem-game.js';
export function copyGame(g){const c=Object.create(Game.prototype);Object.assign(c,g,{level:structuredClone(g.level),blocks:structuredClone(g.blocks),rocks:structuredClone(g.rocks),used:[...g.used],naturalEscaped:[...g.naturalEscaped],escapeColors:[...g.escapeColors],gemState:structuredClone(g.gemState),history:[]});return c;}
export function stateKey(g){const s=g.gemState;return JSON.stringify([g.blocks,g.rocks,g.used,g.level.specials,g.level.zones,g.activeGems,s.wave,s.cleared,s.waveCleared,s.color,s.run]);}
export function solveMission(game,cap=60000,shortest=false){if(!shortest){const route=witnessSuffix(game);if(route)return {status:"solved",path:route,visited:route.length,minimum:false,method:"verified authored route"};}const nodes=[{g:copyGame(game),parent:-1,id:null}],pending=[0],seen=new Map([[stateKey(game),game.moves]]);let visited=0,head=0;
 while((shortest?head<nodes.length:pending.length)&&visited<cap){const at=shortest?head++:pending.pop(),node=nodes[at],g=node.g;visited++;if(g.won){const path=[];for(let i=at;nodes[i].parent>=0;i=nodes[i].parent)path.push(nodes[i].id);return {status:'solved',path:path.reverse(),visited,minimum:shortest};}if(g.gemState.failed)continue;
 const options=[];for(const b of g.blocks){const c=copyGame(g),r=c.play(b.id);if(!r.changed)continue;const k=stateKey(c);if((seen.get(k)??Infinity)<=c.moves)continue;seen.set(k,c.moves);options.push({g:c,parent:at,id:b.id,score:(c.gemState.cleared-g.gemState.cleared)*100+(r.exit?20:0)+(r.removedCount>=3?30:0)+(r.hit?10:0)-c.blocks.length});}
 if(!shortest)options.sort((a,b)=>a.score-b.score);for(const o of options){nodes.push(o);pending.push(nodes.length-1);}}
 return {status:(shortest?head<nodes.length:pending.length)?'limit':'unsolvable',path:null,visited,minimum:false};}
export function newMission(stage){return new Game({n:8,blocks:[],rocks:[],specials:[],zones:[],gemMission:true,gemConfig:GEM_STAGES[stage-1]});}

function witnessSuffix(game){const g=newMission(game.level.gemConfig.stage),route=VERIFIED_ROUTES[game.level.gemConfig.stage-1]??[];for(let i=0;i<route.length;i++){if(stateKey(g)===stateKey(game)){const suffix=route.slice(i),test=copyGame(game);for(const id of suffix)test.play(id);return test.won?suffix:null;}g.play(route[i]);}return null;}

// Conservatively warn only after every reachable current-board state is exhausted.
export function canResolveFacing(game,cap=3000){
 const wave=game.gemState.wave,stack=[copyGame(game)],seen=new Map();let visited=0;
 while(stack.length){
  if(visited++>=cap)return true;
  const g=stack.pop(),key=stateKey(g);if((seen.get(key)??Infinity)<=g.moves)continue;seen.set(key,g.moves);
  if(g.won||g.gemState.wave!==wave||facingPairs(g.blocks,g.rocks,g.level.zones??[]).length===0)return true;
  // Remaining moves may be exhausted; this is handled by the separate move-limit dialog.
  if(g.gemState.failed)continue;
  const options=[];for(const b of g.blocks){const c=copyGame(g),r=c.play(b.id);if(r.changed&&(seen.get(stateKey(c))??Infinity)>c.moves)options.push({g:c,score:r.removedCount??0});}
  options.sort((a,b)=>a.score-b.score);for(const o of options)stack.push(o.g);
 }
 return false;
}
