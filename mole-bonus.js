import {REWARD} from './mole/src/engine.js';
import {afterStageClear,shouldOpenMoleGame} from './mole/src/integration.js';
export {shouldOpenMoleGame};
export function bonusTransaction(runId,stage){return `arrowpang:mole:${runId}:stage:${stage}`;}
export function creditBonus(store,{runId,stageKey,stage},request){
  return store.transact(v=>{
    if(!shouldOpenMoleGame(stage)||request.stage!==stage||request.coins!==REWARD||request.source!=='whack-a-mole'||request.transactionId!==bonusTransaction(runId,stage)||v.paid[runId]?.stage!==stageKey)throw Error('완료한 본게임과 미니게임 보상을 확인해 주세요.');
    v.moleBonus??={version:1,paid:{},completed:{}};
    v.moleBonus.paid??={};v.moleBonus.completed??={};
    if(!v.moleBonus.paid[request.transactionId]){
      if(!Number.isSafeInteger(v.coins+REWARD))throw Error('코인 저장 범위를 확인해 주세요.');
      v.coins+=REWARD;v.moleBonus.paid[request.transactionId]={stage,amount:REWARD};
    }
    v.moleBonus.completed[request.transactionId]={stage,success:true};
    return {ok:true,balance:v.coins};
  });
}
export async function openMoleBonus({home,sound,preferences,stage,runId,stageKey}){
  if(!shouldOpenMoleGame(stage))return {skipped:true};
  await home.store.queue;
  const tx=bonusTransaction(runId,stage),state=home.store.read();
  if(state.moleBonus?.completed?.[tx])return {skipped:true};
  if(state.paid[runId]?.stage!==stageKey)throw Error('스테이지 클리어 보상을 먼저 저장해야 합니다.');
  home.clear();sound.visibility(true);
  const main=document.querySelector('main'),wasInert=main?.inert;if(main)main.inert=true;
  const restore=()=>{if(main)main.inert=wasInert;sound.visibility(document.hidden);};
  try{
    const result=await afterStageClear(stage,{runId,credit:request=>creditBonus(home.store,{runId,stageKey,stage},request),haptic:pattern=>preferences.vibrate(pattern),musicEnabled:sound.music,sfxEnabled:sound.sfx,reduceEffects:preferences.reduced});
    if(!result.success)await home.store.transact(v=>{v.moleBonus??={version:1,paid:{},completed:{}};v.moleBonus.completed??={};v.moleBonus.completed[tx]={stage,success:false};});
    const coins=home.store.read().coins;for(const id of ['wallet','home-wallet']){const el=document.getElementById(id);if(el)el.textContent=coins;}
    return result;
  }finally{restore();}
}
