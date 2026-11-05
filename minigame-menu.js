import {afterStageClear} from './mole/src/integration.js';
import {dailyState} from './rewards-economy.js';
import {REWARD} from './mole/src/engine.js';
export async function openMenuMole({home,sound,preferences}){
 if(!home.store.read().cleared?.['arrowtok-stage-02'])return;
 const runId='menu-'+crypto.randomUUID(),transactionId=`arrowpang:mole:${runId}:stage:5`;
 sound.visibility(true);
 try{return await afterStageClear(5,{runId,musicEnabled:sound.music,sfxEnabled:sound.sfx,reduceEffects:preferences.reduced,haptic:p=>preferences.vibrate(p),credit:request=>home.store.transact(v=>{
  if(!v.cleared?.['arrowtok-stage-02']||request.transactionId!==transactionId||request.coins!==REWARD||request.source!=='whack-a-mole'||request.stage!==5||request.score<20)throw Error('두더지 게임 보상을 확인해 주세요.');
  v.moleBonus??={version:1,paid:{},completed:{}};v.moleBonus.paid??={};
  if(!v.moleBonus.paid[transactionId]){if(!Number.isSafeInteger(v.coins+REWARD))throw Error('코인 저장 범위를 확인해 주세요.');const d=dailyState(v),amount=REWARD+(d.moleFirst?0:50);d.moleFirst=true;d.mole++;v.coins+=amount;v.moleBonus.paid[transactionId]={stage:5,amount};}
  return {ok:true,balance:v.coins,amount:v.moleBonus.paid[transactionId].amount};
 })});}finally{sound.visibility(document.hidden);}
}
export function installMinigameMenu({read,isBusy,onBefore,onReturn,playMole,playFishing}){
 const section=document.createElement('section');section.id='minigame-menu';section.hidden=true;section.setAttribute('aria-label','미니게임 선택');
 section.innerHTML=`<div class="minigame-menu-art"><img class="menu-base" src="assets/minigame-meadow-v1/menu.png" alt="미니게임: 두더지잡기와 낚시게임"><span class="menu-lock mole-lock" aria-hidden="true"></span><span class="menu-lock fish-lock" aria-hidden="true"></span><button class="menu-back-top" aria-label="게임으로 돌아가기"></button><button class="menu-mole" aria-label="두더지잡기"></button><button class="menu-fish" aria-label="낚시게임"></button><button class="menu-back-bottom" aria-label="게임으로 돌아가기"></button><p class="menu-error" role="status" hidden></p></div>`;
  document.body.append(section);const main=document.querySelector('main');let busy=false,previousInert=false;
 const game=document.getElementById('game'),mini=document.getElementById('minigame-preview');
 const unlockNotice=document.createElement('p');unlockNotice.className='minigame-unlock-notice';unlockNotice.setAttribute('role','status');game.append(unlockNotice);
 const unlockKey='arrowpang-minigame-unlock-seen-v1';let seen=[];
 try{seen=JSON.parse(localStorage.getItem(unlockKey)||'[]');if(!Array.isArray(seen))seen=[];}catch{}
 function updateUnlockGuide(){
  const cleared=read().cleared||{};
  const pending=[['arrowtok-stage-02','두더지잡기 게임이 오픈되었습니다.'],['arrowtok-stage-03','낚시게임이 오픈되었습니다.']].filter(([key])=>cleared[key]&&!seen.includes(key));
  const visible=pending.length>0&&section.hidden&&!game.hidden&&!game.classList.contains('clear-screen');
  game.classList.toggle('minigame-unlock-pending',visible);document.getElementById('minigame-preview')?.classList.toggle('unlock-pointing',visible);
  unlockNotice.hidden=!visible;const message=pending.at(-1)?.[1]||'';if(unlockNotice.textContent!==message)unlockNotice.textContent=message;
 }
 document.addEventListener('click',e=>{if(!e.target.closest('#minigame-preview')||isBusy())return;const cleared=read().cleared||{};for(const key of ['arrowtok-stage-02','arrowtok-stage-03'])if(cleared[key]&&!seen.includes(key))seen.push(key);try{localStorage.setItem(unlockKey,JSON.stringify(seen));}catch{}updateUnlockGuide();});
 setInterval(updateUnlockGuide,500);updateUnlockGuide();
 function refresh(){const cleared=read().cleared||{};for(const [selector,lock,key,name,n] of [['.menu-mole','.mole-lock','arrowtok-stage-02','두더지잡기',2],['.menu-fish','.fish-lock','arrowtok-stage-03','낚시게임',3]]){const unlocked=!!cleared[key];const badge=section.querySelector(lock);badge.hidden=!unlocked;badge.classList.toggle('unlocked',unlocked);badge.textContent=unlocked?'':'🔒 '+n+'스테이지 클리어 시 오픈';const button=section.querySelector(selector);button.disabled=busy||!unlocked;button.setAttribute('aria-label',unlocked?name+' 게임하기':name+' 잠김. 스테이지 '+n+' 클리어 시 오픈');}}
 function close(){if(busy)return;section.hidden=true;main.inert=previousInert;document.body.classList.remove('minigame-menu-open');onReturn();document.getElementById('minigame-preview')?.focus();}
 async function launch(kind){const key=kind==='mole'?'arrowtok-stage-02':'arrowtok-stage-03';if(busy||!read().cleared?.[key])return;busy=true;refresh();section.querySelector('.menu-error').hidden=true;try{await(kind==='mole'?playMole():playFishing());}catch{const error=section.querySelector('.menu-error');error.textContent='게임을 열지 못했어요. 다시 눌러 주세요.';error.hidden=false;}finally{busy=false;onReturn();refresh();section.querySelector(kind==='mole'?'.menu-mole':'.menu-fish').focus();}}
 section.querySelector('.menu-mole').onclick=()=>launch('mole');section.querySelector('.menu-fish').onclick=()=>launch('fish');for(const button of section.querySelectorAll('.menu-back-top,.menu-back-bottom'))button.onclick=close;
 document.addEventListener('click',e=>{if(!e.target.closest('#minigame-preview')||isBusy()||!section.hidden)return;onBefore();previousInert=main.inert;main.inert=true;refresh();section.hidden=false;document.body.classList.add('minigame-menu-open');section.querySelector('.menu-back-top').focus();});
 section.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 return {refresh};
}
