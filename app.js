import {initGameOver} from './game-over.js';
import {nextYard} from './home-ownership.js';
import {interiorState} from './interior-progress.js';
import{installFishingBonus,shouldOpenFishingGame}from'./fishing-bonus.js';
import{FrogUI}from'./frog-ui.js';
import{RainbowEffects}from'./rainbow-effects.js';
import {openMoleBonus,shouldOpenMoleGame} from './mole-bonus.js';
import{SpecialEffects}from'./special-effects.js';
import {initMissionMenu} from './mission-menu.js';
import {initPlayUI} from './play-ui.js';
import {initTutorials} from './tutorials.js';
import {initHome} from './home.js';
import {zoneEntries,zoneMarkup} from './zone-display.js';
import {Feedback,preferences} from './feedback.js';
import {EscapeEffects} from './escape-effects.js';
import {motionPlan} from './motion.js';
import {Game,solve,move,facingPairs,missionSpecials} from './special-engine.js';import {LEVELS} from './levels.js';import {sound} from './audio.js';
const $=id=>document.getElementById(id),names={U:'위',D:'아래',L:'왼쪽',R:'오른쪽'};
const playUI=initPlayUI({reduced:()=>preferences.reduced});
const specialFX=new SpecialEffects();const rainbowFX=new RainbowEffects();
const completed=new Set();const escapeEffects=new EscapeEffects();const feedback=new Feedback();let comboTimer;
let index=0,game=new Game(LEVELS[0]),locked=false,assistBusy=false,epoch=0,timer,wasStuck=false,starTimer,moleOpening=false;
const stageKey=i=>LEVELS[i].id;
const gameOver=initGameOver(()=>$('restart').click());
const tutorials=initTutorials();
const home=initHome({capture:()=>({index,stageKey:stageKey(index),level:game.level,game:{...game.snapshot(),history:game.history}}),restore:p=>{if(p.level?.specialRules!==1||!Number.isInteger(p.index)||p.index<0||p.index>=LEVELS.length||p.stageKey!==stageKey(p.index)||!Array.isArray(p.game?.blocks)||!Array.isArray(p.game?.rocks)||!Array.isArray(p.game?.history))return false;index=p.index;game=new Game(missionSpecials(p.level??LEVELS[index],index+1));Object.assign(game,structuredClone(p.game));const rainbowIds=new Set(game.level.blocks.filter(b=>b.rainbow).map(b=>b.id));for(const list of [game.blocks,...game.history.map(h=>h.blocks)])for(const b of list)b.rainbow=rainbowIds.has(b.id);return true;},isBusy:()=>locked||assistBusy,cancelEffects:()=>cancel(),onHomeIntro:()=>tutorials.home()});
const frogUI=new FrogUI({board:$('board'),sound,reduced:()=>preferences.reduced,isBusy:()=>locked||assistBusy||home.transitionPending||game.won,onRemove:id=>{game.frogs=game.frogs.filter(f=>f.id!==id);home.commit(false);}});
let pendingAction=null;
function cancel(){frogUI.clear();rainbowFX.clear();specialFX.clear();playUI.clear();if(pendingAction){Object.assign(game,pendingAction);pendingAction=null;}feedback.clear();clearTimeout(comboTimer);if($('combo')){$('combo').hidden=true;$('combo').getAnimations?.().forEach(a=>a.cancel());}escapeEffects.clear();epoch++;clearTimeout(timer);clearTimeout(starTimer);locked=false;sound.stopEffects();$('board').removeAttribute('aria-busy');}
function controls(){for(const id of ['next','settings','home'])if($(id))$(id).disabled=locked||(['next','home'].includes(id)&&home.transitionPending);$('restart').disabled=moleOpening||(locked&&game.won);$('undo').disabled=moleOpening||(locked&&game.won);$('hint').disabled=moleOpening||(locked&&game.won);}
let statusUpgradeCount=null,statusUpgradeStage=null;
function updateStatusCounters(){
 const v=home.store.read(),run=v.assistRun,key=stageKey(index),inside=interiorState(v);
 const upgradeCount=(Number(v.home)||1)+inside.built;
 if(statusUpgradeCount!==null&&upgradeCount>statusUpgradeCount)statusUpgradeStage=key;
 if(upgradeCount<statusUpgradeCount||statusUpgradeStage!==key)statusUpgradeStage=null;
 statusUpgradeCount=upgradeCount;
 const used=run?.stage===key?Number(run.undo)||0:0;$('remaining').textContent=v.coins.toLocaleString('ko-KR');
 const next=v.home<10?nextYard(v):inside.next,needed=next?Math.max(0,next.cost-v.coins):0;
 $('moves').textContent=needed.toLocaleString('ko-KR');
 const stats=$('stage').closest('.stats');stats.dataset.upgradeReady=String(!!next&&needed===0);stats.style.setProperty('--upgrade-progress',(next?Math.min(1,Math.max(0,v.coins/next.cost))*100:100)+'%');

}
function render(note=''){
 const level=game.level;$('stage').textContent=`${index+1} / ${LEVELS.length}`;updateStatusCounters();
 $('board').dataset.n=level.n;$('board').style.setProperty('--n',level.n);$('board').replaceChildren();
 for(let y=0;y<level.n;y++)for(let x=0;x<level.n;x++){const el=document.createElement('div');el.className='floor';el.dataset.tile=String((x+y*3)%4);el.style.setProperty('--x',x);el.style.setProperty('--y',y);el.style.backgroundImage=`url('assets/ui/floor-${(x+y*3)%4}.webp')`;$('board').append(el);}
 for(const zone of level.zones??[]){const el=document.createElement('div');el.className='rotation-zone';el.dataset.zone=`${zone.x},${zone.y}`;el.dataset.occupied=String(game.blocks.some(b=>b.x===zone.x&&b.y===zone.y));el.style.setProperty('--x',zone.x);el.style.setProperty('--y',zone.y);el.setAttribute('role','img');el.setAttribute('aria-label',`${zone.y+1}행 ${zone.x+1}열, 모든 진입 방향에서 시계방향 90도 회전`);el.innerHTML=zoneMarkup(zoneEntries(game.blocks,game.rocks,level.n,level.zones??[],zone));$('board').append(el);}
 for(const pickup of level.specials??[]){if(game.used.includes(pickup.id))continue;const el=document.createElement('div');el.className='special-marker';el.dataset.special=pickup.id;el.style.setProperty('--x',pickup.x);el.style.setProperty('--y',pickup.y);el.setAttribute('role','img');el.setAttribute('aria-label',pickup.kind==='key'?'황금열쇠: 가까운 돌 최대 2개 제거':'폭탄: 발동 화살표 포함 최대 3개 제거');el.innerHTML='<img src="assets/special/'+(pickup.kind==='key'?'01-golden-key':'02-bomb')+'.webp" alt="">';$('board').append(el);}
 for(const rock of game.rocks){const el=document.createElement('div');el.className='rock';el.dataset.rock=rock.id;el.dataset.hp=rock.hp;el.style.setProperty('--x',rock.x);el.style.setProperty('--y',rock.y);el.setAttribute('role','img');el.setAttribute('aria-label',`돌 ${rock.id}, 내구도 ${rock.hp}, ${rock.y+1}행 ${rock.x+1}열`);el.innerHTML=`<span><b>${rock.hp}</b></span>`;$('board').append(el);}
 for(const b of game.blocks){const el=document.createElement('button');el.className='block';el.dataset.id=b.id;el.dataset.dir=b.d;el.dataset.rainbow=String(!!b.rainbow);el.dataset.tutorial=String(index===0&&!game.history.length&&b.id===1);el.style.setProperty('--x',b.x);el.style.setProperty('--y',b.y);el.setAttribute('aria-label',`${b.rainbow?'무지개 화살표 · 탈출 시 주변 3개 제거 · 15코인 · ':''}블록 ${b.id}, ${b.y+1}행 ${b.x+1}열, ${names[b.d]}`);el.innerHTML=`<span aria-hidden="true"></span>`;el.addEventListener('click',()=>play(b.id,el));$('board').append(el);}
 frogUI.render(game);
 const warnings=new Set(facingPairs(game.blocks,game.rocks,level.zones??[]).flat());for(const el of $('board').querySelectorAll('.block')){if(warnings.has(Number(el.dataset.id))){el.classList.add('facing-warning');el.setAttribute('aria-label',el.getAttribute('aria-label')+', 서로 마주 보는 화살표');}}
 $('next').hidden=!game.won;$('next').setAttribute('aria-label',index===LEVELS.length-1?`${LEVELS.length}단계 완료, 1단계 다시 시작`:'다음 스테이지');if($('all-complete'))$('all-complete').hidden=!(game.won&&index===LEVELS.length-1);
 if($('celebrate')){$('celebrate').hidden=!game.won;if(!game.won)$('celebrate').classList.remove('stars-in');}if($('combo')){$('combo').hidden=true;$('combo-count').textContent='×'+game.combo;}
 const impossible=!game.won&&(game.stuck||solve(game.blocks,level.n,1200,game.rocks,level.zones??[],level.specials??[],game.used).status==='unsolvable');
 playUI.setBlocked(!game.won&&warnings.size>0);
 const assist=home.store.read().assistRun;gameOver.update(impossible&&assist?.stage===stageKey(index)&&Number(assist.undo)>=3);
 if(impossible&&!wasStuck)sound.play('stuck');wasStuck=impossible;
 $('message').textContent=game.won?'':impossible?'이 상태로는 탈출할 수 없어요. 되돌려 주세요.':note||'';controls();
}
function play(id,el){if(locked||assistBusy||game.won||frogUI.departing)return;let before=game.blocks.find(b=>b.id===id);if(!before)return;playUI.clear();$('message').textContent='';feedback.settle();sound.unlock();sound.play('touch');
 // Preview keeps collision state intact until the final break frame finishes.
 const overall=move(game.blocks,id,game.level.n,game.rocks,game.level.zones??[],game.level.specials??[],game.used,game.frogs);if(overall.frog){frogUI.blocked(overall.frog);return;}let r=overall.steps?.[0]?.result??overall;const steps=overall.steps??[];let stepIndex=0;const rootId=id;
 if(!r.changed){game.play(id);home.commit(false);playUI.setBlocked(facingPairs(game.blocks,game.rocks,game.level.zones??[]).length>0);feedback.pulse(el,'pressing',75);el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');if(!r.loop){sound.play('blocked');feedback.impact($('board'),before,before.d,'spark');}feedback.later(()=>el.classList.remove('shake'),200);$('message').textContent=r.loop?'회전 경로가 반복되어 원래 자리로 돌아왔어요.':'바로 앞이 막혔어요. 다른 화살표를 움직여 보세요.';return;}
 locked=true;controls();$('board').setAttribute('aria-busy','true');pendingAction={...game.snapshot(),history:structuredClone(game.history)};const ticket=epoch,step=$('board').clientWidth/game.level.n;let plan=motionPlan(r);let pos=0,movingSound=false,cursor={x:before.x,y:before.y};
 function advance(){if(ticket!==epoch)return;if(pos>=plan.length){
   if(stepIndex+1<steps.length){stepIndex++;game.blocks=steps[stepIndex].before.map(b=>({...b}));game.rocks=steps[stepIndex].beforeRocks.map(r=>({...r}));game.used=steps[stepIndex].beforeUsed??pendingAction.used;game.combo=(pendingAction.combo+stepIndex)%5;render();if(stepIndex>=1){$('combo-count').textContent=(stepIndex+1)+'연쇄';showCombo(stepIndex+1);}id=steps[stepIndex].id;before=game.blocks.find(b=>b.id===id);el=document.querySelector('[data-id="'+id+'"]');r=steps[stepIndex].result;plan=motionPlan(r);pos=0;movingSound=false;cursor={x:before.x,y:before.y};advance();return;}
   const rocksBefore=pendingAction.rocks.map(rock=>({...rock}));Object.assign(game,pendingAction);pendingAction=null;const committed=game.play(rootId);const rainbowEvents=(committed.steps??[{result:committed}]).flatMap(q=>(q.result.events??[]).filter(e=>e.kind==='rainbow'));if(rainbowEvents.length)home.rainbowReward(rainbowEvents).then(awards=>{if(ticket===epoch)for(const a of awards)rainbowFX.reward($('board'),a);}).catch(()=>{$('message').textContent='무지개 보상을 저장하지 못했어요.';});for(const event of committed.comboEvents??[])if(event.tier===2)specialFX.combo($('board'),2);home.comboReward(committed.comboEvents??[]).then(awards=>{if(ticket===epoch)for(const [j,a]of awards.entries())specialFX.later(()=>specialFX.combo($('board'),a.tier,a.amount,j*8),j*230);}).catch(()=>{$('message').textContent='콤보 보상을 저장하지 못했어요.';});for(const rock of rocksBefore)if(!game.rocks.some(q=>q.id===rock.id&&q.hp>0))home.rockBroken(rock);locked=false;$('board').removeAttribute('aria-busy');
   if(!r.exit&&!r.bombRemoved&&r.moved&&!r.hit)sound.play('collision');
   render(r.bombRemoved?'폭탄으로 화살표를 제거했어요.':r.hit?(r.hit.broken?'돌이 깨졌어요! 다음 터치에 진행하세요.':`돌 내구도 ${r.hit.hp} · ${r.moved?'이동하며 충돌':'돌 타격'}`):r.exit?(game.combo>1?`${game.combo} 연속 탈출!`:'탈출 성공!'):'장애물 바로 앞에 멈췄어요.');
   if(!r.exit&&!r.bombRemoved&&!r.hit&&r.moved){const b=game.blocks.find(b=>b.id===id);feedback.impact($('board'),b,b.d);const dirs={U:[0,-1],R:[1,0],D:[0,1],L:[-1,0]},[dx,dy]=dirs[b.d];const target=game.blocks.find(q=>q.x===b.x+dx&&q.y===b.y+dy);feedback.pulse(document.querySelector(`[data-id="${target?.id}"]`),'bumped',180);}
   if(r.exit&&game.combo>1&&!game.won){if(steps.length>1)$('combo-count').textContent=steps.length+'연쇄';showCombo();}
   home.commit(game.won);
   if(game.won){if(shouldOpenMoleGame(index+1)||shouldOpenFishingGame(index+1)){locked=true;controls();setTimeout(()=>{if(ticket===epoch&&game.won){locked=false;launchClearMinigames();}},2100);}clearTimeout(comboTimer);if($('combo'))$('combo').hidden=true;feedback.shakeScreen();completed.add(index);sound.play('success');starTimer=setTimeout(()=>{if(ticket===epoch&&game.won){$('celebrate')?.classList.add('stars-in');sound.play('star');}},350);}return;
  }
  const e=plan[pos++];if(e.type==='move'){const previousZone=document.querySelector(`[data-zone="${cursor.x},${cursor.y}"]`);if(previousZone)previousZone.dataset.occupied='false';}if(e.type==='move'&&e.exit){if(!movingSound){sound.play('move');movingSound=true;}escapeEffects.run({board:$('board'),element:el,from:cursor,d:e.d,n:game.level.n,onBoundary:()=>{if(before.rainbow)rainbowFX.escape($('board'),cursor,e.d);sound.play(game.combo>=1?'combo':'exit');preferences.vibrate(game.blocks.length===1?22:14);},last:game.blocks.length===1,bright:game.combo>=1,reduced:preferences.reduced,onComplete:advance});return;}if(e.type==='move'){if(!movingSound){sound.play('move');movingSound=true;}el.style.transform=`translate(${(e.x-before.x)*step}px,${(e.y-before.y)*step}px)`;el.classList.remove('moving');void el.offsetWidth;el.classList.add('moving');cursor={x:e.x,y:e.y};

  }
  if(e.type==='special'){if(e.kind==='rainbow')rainbowFX.burst($('board'),e);else specialFX.burst($('board'),e);specialFX.later(()=>{if(ticket!==epoch)return;for(const q of e.removedRocks??[])document.querySelector(`[data-rock="${q.id}"]`)?.remove();for(const [i,q]of (e.removedBlocks??[]).entries()){if(e.kind==='rainbow')rainbowFX.later(()=>{if(ticket===epoch)document.querySelector(`[data-id="${q.id}"]`)?.remove();},65*i+40);else document.querySelector(`[data-id="${q.id}"]`)?.remove();}},preferences.reduced?0:200);document.querySelector(`[data-special="${e.id}"]`)?.remove();}
  if(e.type==='rotate'){const face=el.querySelector('span');face.style.transition='transform 200ms ease-in-out';face.style.transform='rotate(90deg)';}
  if(e.type==='hit'){sound.play('collision');const rockEl=document.querySelector(`[data-rock="${e.id}"]`);if(e.broken)rockEl?.classList.add('breaking');const rock=game.rocks.find(q=>q.id===e.id);if(rock)feedback.stone($('board'),rock,rockEl,el.dataset.dir,e.hp);if(e.broken){feedback.shakeScreen();if(rock&&!document.body.classList.contains('garden-theme'))specialFX.vanish($('board'),rock,'rock',80);}}
  timer=setTimeout(()=>{if(ticket!==epoch)return;if(e.type==='move'){const zone=document.querySelector(`[data-zone="${e.x},${e.y}"]`);if(zone){zone.dataset.occupied='true';feedback.pulse(zone,'zone-lit',300);zone.dataset.entry=e.d;zone.innerHTML=zoneMarkup([e.d]);}}if(e.type==='rotate'){const face=el.querySelector('span');face.style.transition='none';face.style.transform='none';el.dataset.dir=e.d;}advance();},e.duration);
 }
 el.classList.add('pressing');timer=setTimeout(()=>{if(ticket!==epoch)return;el.classList.remove('pressing');advance();},75);
}
function beginAssistRun(stage,force=false){home.store.startAssists(stage,force).then(updateStatusCounters).catch(()=>{$('message').textContent='사용 횟수를 저장하지 못했어요. 다시 시도해 주세요.';});}
const assistNotice=count=>count>=3?'사용횟수가 끝났습니다.':`3회 중 ${count}회 사용`;
async function useAssist(kind,action){
 if(assistBusy||locked||home.transitionPending)return;
 assistBusy=true;
 try{const r=await home.store.consumeAssist(stageKey(index),kind);if(r.used)action();$('message').textContent=assistNotice(r.count);}
 catch(e){$('message').textContent='사용 횟수를 저장하지 못했어요. 다시 시도해 주세요.';}
 finally{assistBusy=false;controls();}
}
$('undo').addEventListener('click',()=>{
 if(assistBusy||locked||home.transitionPending)return;
 const exhausted=home.store.read().assistRun;if(exhausted?.stage===stageKey(index)&&exhausted.undo>=3){$('message').textContent=assistNotice(3);return;}
 if(!game.history.length){$('message').textContent='되돌릴 기록이 없어요.';return;}
 const previous=game.blocks.map(b=>({...b}));useAssist('undo',()=>{cancel();game.undo();home.clear();home.commit(false);sound.play('undo');render();feedback.undo($('board'),previous,game.blocks);});
});
$('restart').addEventListener('click',()=>{if(assistBusy)return;cancel();sound.play('menu');game.restart();beginAssistRun(stageKey(index),true);home.newRun();wasStuck=false;render('처음 위치로 돌아왔어요.');});
$('hint').addEventListener('click',()=>{
 if(assistBusy||locked||home.transitionPending)return;
 const exhausted=home.store.read().assistRun;if(exhausted?.stage===stageKey(index)&&exhausted.hint>=3){$('message').textContent=assistNotice(3);return;}
 if(game.won)return;
 const result=solve(game.blocks,game.level.n,150000,game.rocks,game.level.zones??[],game.level.specials??[],game.used);
 const id=result.path?.[0],target=id==null?null:document.querySelector(`[data-id="${id}"]`);
 if(!target){$('message').textContent=result.status==='limit'?'해답 검색 한도에 도달했어요. 해답 없음으로 판정하지 않았어요.':'이 상태에서는 해답이 없어요. 되돌리기 또는 다시 시작하세요.';return;}
 const frogHint=id==null?null:move(game.blocks,id,game.level.n,game.rocks,game.level.zones??[],game.level.specials??[],game.used,game.frogs).frog;if(frogHint){frogUI.blocked(frogHint);return;}
 useAssist('hint',()=>{document.querySelectorAll('.hinted').forEach(e=>e.classList.remove('hinted'));target.classList.add('hinted');sound.play('hint');});
});
function advanceStage(){cancel();sound.play('next');index=(index+1)%LEVELS.length;game=new Game(LEVELS[index]);beginAssistRun(stageKey(index));home.newRun();wasStuck=false;render();}
async function launchClearMinigames(){
 if(moleOpening||!game.won||(!shouldOpenMoleGame(index+1)&&!shouldOpenFishingGame(index+1)))return false;
 moleOpening=true;locked=true;controls();
 try{await home.store.queue;const run=home.runId,key=stageKey(index),stage=index+1;if(home.store.read().paid[run]?.stage!==key)throw Error('클리어 보상을 먼저 저장해야 합니다.');if(shouldOpenFishingGame(stage)){const result=await fishingBonus.open({automatic:true,clearKey:run+':'+key});if(!result?.success)return false;}if(shouldOpenMoleGame(stage))await openMoleBonus({home,sound,preferences,stage,runId:run,stageKey:key});advanceStage();return true;}
 catch(e){$('message').textContent='미니게임을 준비하지 못했어요. 다음 버튼으로 다시 시도해 주세요.';console.error(e);return false;}
 finally{moleOpening=false;locked=false;controls();}
}
$('next').addEventListener('click',()=>{if(locked||assistBusy||home.transitionPending||!game.won)return;if(shouldOpenMoleGame(index+1)||shouldOpenFishingGame(index+1)){launchClearMinigames();return;}advanceStage();});
const missionMenu=initMissionMenu({levels:LEVELS,read:()=>home.store.read(),sound,launch:i=>{
 if(locked||assistBusy||home.transitionPending)return false;
 cancel();tutorials.close();index=i;game=new Game(LEVELS[i]);beginAssistRun(stageKey(i));home.newRun();wasStuck=false;render();
 $('welcome').hidden=true;$('mission-screen').hidden=true;$('game').hidden=false;
 return true;
}});
let resettingProgress=false;
$('reset-game').addEventListener('click',async()=>{
 if(resettingProgress||$('welcome').hidden)return;
 resettingProgress=true;
 try{
  if(!globalThis.confirm('게임을 초기화할까요? 코인, 나의 집, 미션 클리어 기록, 간식과 꾸미기 아이템이 초기화됩니다. 소리·접근성 설정은 유지하며, 현재 기록은 이 기기에 복구용으로 보관합니다.'))return;
  $('welcome').inert=true;$('reset-game').disabled=true;
  cancel();tutorials.close();await home.resetProgress();index=0;game=new Game(LEVELS[0]);completed.clear();wasStuck=false;tutorials.reset();render();missionMenu.refresh();
  $('reset-status').textContent='게임을 초기화했어요. 이전 기록은 이 기기에 보관했어요.';$('reset-status').hidden=false;
 }catch(e){$('reset-status').textContent='초기화를 완료하지 못했어요. 기록을 지우지 말고 다시 확인해 주세요.';$('reset-status').hidden=false;}
 finally{resettingProgress=false;$('welcome').inert=false;$('reset-game').disabled=false;}
});
function settings(){if(locked)return;sound.unlock();sound.play('menu');$('audio-panel').hidden=false;$('game').inert=true;$('welcome').inert=true;refreshSettings();$('music')?.focus?.();}
function refreshSettings(){for(const kind of ['music','sfx'])if($(kind)){$(kind).textContent=`${kind==='music'?'배경음악':'효과음'} ${sound[kind]?'켜짐':'꺼짐'}`;$(kind).setAttribute('aria-pressed',String(sound[kind]));}}
$('settings')?.addEventListener('click',()=>{if(locked)return;const enable=!(sound.music||sound.sfx);sound.set('music',enable);sound.set('sfx',enable);sound.unlock();refreshSettings();document.dispatchEvent(new Event('garden-audio-change'));});$('title-settings')?.addEventListener('click',settings);
$('close-settings')?.addEventListener('click',()=>{sound.play('menu');$('audio-panel').hidden=true;$('game').inert=false;$('welcome').inert=false;($('welcome').hidden?$('settings'):$('title-settings'))?.focus?.();});
for(const kind of ['music','sfx'])$(kind)?.addEventListener('click',()=>{sound.set(kind,!sound[kind]);sound.play('menu');refreshSettings();});
render();



function showCombo(count=game.combo){const el=$('combo');if(!el)return;clearTimeout(comboTimer);el.getAnimations?.().forEach(a=>a.cancel());const text=$('message').textContent;if(/연속.*탈출/.test(text)){$('combo-count').textContent=text;$('message').textContent='';}el.hidden=false;el.dataset.tier=String(Math.min(4,count));if(count>=4)feedback.burst($('board'),$('board').clientWidth*.5,3,4,'spark');const reduced=preferences.reduced,duration=reduced?250:1000;el.animate?.(reduced?[{opacity:.8},{opacity:0}]:[{opacity:0,translate:'0 4px'},{opacity:.8,translate:'0 0',offset:.12},{opacity:.8,translate:'0 0',offset:.65},{opacity:0,translate:'0 -7px'}],{duration,fill:'forwards',easing:'ease-out'});comboTimer=setTimeout(()=>{el.hidden=true;el.getAnimations?.().forEach(a=>a.cancel());},duration);}
function refreshEffects(){if(document.documentElement)document.documentElement.dataset.reduceEffects=String(preferences.reduced);for(const key of ['vibration','reduce'])if($(key)){$(key).textContent=(key==='vibration'?'진동':'효과 줄이기')+' '+(preferences[key]?'켜짐':'꺼짐');$(key).setAttribute('aria-pressed',String(preferences[key]));}}
for(const key of ['vibration','reduce'])$(key)?.addEventListener('click',()=>{preferences.toggle(key);sound.play('menu');refreshEffects();});refreshEffects();


const fishingBonus=installFishingBonus({home,sound,isBusy:()=>locked||assistBusy||moleOpening||home.transitionPending,onBefore:()=>{cancel();tutorials.close();home.commit(false);},onReturn:()=>render()});

document.addEventListener('garden-help',()=>{if(!locked) tutorials.play(true);});

new MutationObserver(updateStatusCounters).observe($('wallet'),{childList:true,characterData:true,subtree:true});
