// Mission availability is derived from stable IDs, never UI numbers or reward totals.
export function missionAccess(levels,save){
 const cleared=levels.map(l=>!!save.cleared?.[l.id]);
 const next=cleared.findIndex(done=>!done);
 return {cleared,next,count:cleared.filter(Boolean).length,allowed:cleared.map((done,i)=>done||i===next),defaultIndex:next<0?levels.length-1:next};
}
export function initMissionMenu({levels,read,sound,launch}){
 const $=id=>document.getElementById(id),screen=$('mission-screen'),grid=$('mission-grid');let selected=-1,starting=false;
 function state(){try{$('mission-error').hidden=true;return missionAccess(levels,read());}catch(e){$('mission-error').textContent='저장 기록을 읽지 못했어요. 기록을 보존한 채 다시 시도해 주세요.';$('mission-error').hidden=false;return null;}}
 function refresh(){const s=state();if(!s){$('mission-start').disabled=true;grid.replaceChildren();return;}
  if(!s.allowed[selected])selected=s.defaultIndex;
  $('mission-progress').textContent=`클리어 ${s.count} / ${levels.length}`;
  grid.replaceChildren(...levels.map((level,i)=>{const b=document.createElement('button');b.type='button';b.className='mission-tile';b.dataset.state=s.cleared[i]?'cleared':s.allowed[i]?'current':'locked';b.disabled=!s.allowed[i];b.setAttribute('aria-pressed',String(i===selected));b.setAttribute('aria-label',`${i+1}번 미션, ${s.cleared[i]?'클리어, 재도전 가능':s.allowed[i]?'도전 가능':'잠금'}`);b.textContent=String(i+1);
   if(s.cleared[i]||!s.allowed[i]){const badge=document.createElement('img');badge.src=`assets/mission-menu/${s.cleared[i]?'07-badge-check':'08-badge-lock'}.webp`;badge.alt='';b.append(badge);}
   b.addEventListener('click',()=>{selected=i;sound.play('menu');refresh();grid.children[i]?.focus({preventScroll:true});});return b;}));
  $('mission-start').disabled=false;$('mission-start').textContent=`${selected+1}번 미션 ${s.cleared[selected]?'다시 도전':'시작'}`;
 }
 function start(i){if(starting||$('welcome').inert||screen.inert||(screen.hidden&&$('welcome').hidden))return;const s=state();if(!s||!s.allowed[i]){refresh();return;}starting=true;try{sound.unlock();sound.play('menu');launch(i);}finally{starting=false;}}
 $('stage-select').addEventListener('click',()=>{sound.unlock();sound.play('menu');$('welcome').hidden=true;screen.hidden=false;refresh();$('mission-back').focus({preventScroll:true});});
 $('mission-back').addEventListener('click',()=>{sound.play('menu');screen.hidden=true;$('welcome').hidden=false;$('stage-select').focus({preventScroll:true});});
 $('mission-start').addEventListener('click',()=>start(selected));
 $('start').addEventListener('click',()=>{const s=state();if(s)start(s.defaultIndex);else{$('welcome').hidden=true;screen.hidden=false;}});
 addEventListener('storage',()=>{if(!screen.hidden)refresh();});return{refresh};
}
