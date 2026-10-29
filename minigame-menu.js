import {afterStageClear} from './mole/src/integration.js';
import {REWARD} from './mole/src/engine.js';
export async function openMenuMole({home,sound,preferences}){
 if(!home.store.read().cleared?.['arrowtok-stage-05'])return;
 const runId='menu-'+crypto.randomUUID(),transactionId=`arrowpang:mole:${runId}:stage:5`;
 sound.visibility(true);
 try{return await afterStageClear(5,{runId,musicEnabled:sound.music,sfxEnabled:sound.sfx,reduceEffects:preferences.reduced,haptic:p=>preferences.vibrate(p),credit:request=>home.store.transact(v=>{
  if(!v.cleared?.['arrowtok-stage-05']||request.transactionId!==transactionId||request.coins!==REWARD||request.source!=='whack-a-mole'||request.stage!==5||request.score<20)throw Error('두더지 게임 보상을 확인해 주세요.');
  v.moleBonus??={version:1,paid:{},completed:{}};v.moleBonus.paid??={};
  if(!v.moleBonus.paid[transactionId]){if(!Number.isSafeInteger(v.coins+REWARD))throw Error('코인 저장 범위를 확인해 주세요.');v.coins+=REWARD;v.moleBonus.paid[transactionId]={stage:5,amount:REWARD};}
  return {ok:true,balance:v.coins};
 })});}finally{sound.visibility(document.hidden);}
}
export function installMinigameMenu({read,isBusy,onBefore,onReturn,playMole,playFishing}){
 const section=document.createElement('section');section.id='minigame-menu';section.hidden=true;section.setAttribute('aria-label','미니게임 선택');
 section.innerHTML=`<div class="minigame-menu-art"><img class="menu-base" src="assets/minigame-menu-v158/menu.webp" alt="미니게임: 두더지잡기와 낚시게임"><img class="menu-lock mole-lock" src="assets/minigame-menu-v158/mole-locked.webp" alt=""><img class="menu-lock fish-lock" src="assets/minigame-menu-v158/fishing-locked.webp" alt=""><button class="menu-back-top" aria-label="게임으로 돌아가기"></button><button class="menu-mole" aria-label="두더지잡기"></button><button class="menu-fish" aria-label="낚시게임"></button><button class="menu-back-bottom" aria-label="게임으로 돌아가기"></button><p class="menu-error" role="status" hidden></p></div>`;
 document.body.append(section);const main=document.querySelector('main');let busy=false,previousInert=false;
 function refresh(){const cleared=read().cleared||{};for(const [selector,lock,key,name,n] of [['.menu-mole','.mole-lock','arrowtok-stage-05','두더지잡기',5],['.menu-fish','.fish-lock','arrowtok-stage-10','낚시게임',10]]){const unlocked=!!cleared[key];section.querySelector(lock).hidden=unlocked;const button=section.querySelector(selector);button.disabled=busy||!unlocked;button.setAttribute('aria-label',unlocked?name+' 게임하기':name+' 잠김. 스테이지 '+n+' 클리어 시 오픈');}}
 function close(){if(busy)return;section.hidden=true;main.inert=previousInert;document.body.classList.remove('minigame-menu-open');onReturn();document.getElementById('minigame-preview')?.focus();}
 async function launch(kind){const key=kind==='mole'?'arrowtok-stage-05':'arrowtok-stage-10';if(busy||!read().cleared?.[key])return;busy=true;refresh();section.querySelector('.menu-error').hidden=true;try{await(kind==='mole'?playMole():playFishing());}catch{const error=section.querySelector('.menu-error');error.textContent='게임을 열지 못했어요. 다시 눌러 주세요.';error.hidden=false;}finally{busy=false;onReturn();refresh();section.querySelector(kind==='mole'?'.menu-mole':'.menu-fish').focus();}}
 section.querySelector('.menu-mole').onclick=()=>launch('mole');section.querySelector('.menu-fish').onclick=()=>launch('fish');for(const button of section.querySelectorAll('.menu-back-top,.menu-back-bottom'))button.onclick=close;
 document.addEventListener('click',e=>{if(!e.target.closest('#minigame-preview')||isBusy()||!section.hidden)return;onBefore();previousInert=main.inert;main.inert=true;refresh();section.hidden=false;document.body.classList.add('minigame-menu-open');section.querySelector('.menu-back-top').focus();});
 section.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 return {refresh};
}
