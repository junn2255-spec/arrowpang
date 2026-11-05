import {gemMove as move} from './gem-game.js';
export function installGemUI({read,restart,sound}){
 const root=document.getElementById('game'),board=document.getElementById('board');const hud=document.createElement('div');hud.id='gem-hud';root.append(hud);
 document.getElementById('aqua-shop').addEventListener('click',()=>document.getElementById('aqua-shop-dialog').showModal());
 const fail=document.createElement('dialog');fail.id='gem-fail';fail.innerHTML='<img src="assets/move-limit-v1/popup.png" alt="이동횟수를 모두 썼어요"><button class="move-limit-restart" aria-label="다시 시작하기"></button><button class="move-limit-item" aria-label="아이템으로 클리어하기, 준비 중" disabled></button>';document.body.append(fail);fail.querySelector('.move-limit-restart').onclick=()=>{fail.close();restart();};fail.oncancel=e=>e.preventDefault();
 function render(result){board.querySelectorAll(".mission-gem").forEach(el=>el.remove());const g=read();root.classList.toggle('gem-mission',!!g.level.gemMission);hud.hidden=!g.level.gemMission||g.won;if(!g.level.gemMission)return;const s=g.gemState;const values=[
   ['스테이지',g.level.gemConfig.stage],
   ['라운드 진행',Math.min(s.cleared,g.level.gemConfig.target)],
   ['남은 이동',Math.max(0,g.level.gemConfig.limit-g.moves)]
 ];
 hud.replaceChildren(...values.map(([label,value])=>{
   const cell=document.createElement('div'),amount=document.createElement('b');
      if(label==='라운드 진행'){
     const completed=Math.max(0,Math.min(5,Number(value)));
     cell.className='round-progress-cell';
     const gauge=document.createElement('img');gauge.className='round-progress-art';
     gauge.src=`assets/round-gauge-sky-v2/step-${completed}.png`;gauge.alt='';
     cell.setAttribute('role','progressbar');cell.setAttribute('aria-label','라운드 진행');
     cell.setAttribute('aria-valuemin','0');cell.setAttribute('aria-valuemax',String(g.level.gemConfig.target));cell.setAttribute('aria-valuenow',String(value));
     cell.append(gauge);
   }else{cell.setAttribute('aria-label',label+' '+value);amount.textContent=value;cell.append(amount);}return cell;
 }));
 if(result?.railBreak!=null)sound.play('star'); for(let i=s.waveCleared;i<Math.min(s.gems.length,s.waveCleared+g.level.gemConfig.target-s.cleared)&&!g.won;i++){const img=document.createElement('img');img.src='assets/gem-mission-v1/gem.webp';img.className='mission-gem';img.style.left=(s.gems[i].x*100/g.level.n)+'%';img.style.top=(s.gems[i].y*100/g.level.n)+'%';img.alt='목표 보석';board.append(img);}
 if(result?.gemBroken){sound.play('star');sound.play('combo');for(const position of result.gemBreaks??[result.gemPosition]){const fx=document.createElement('img');fx.src='assets/gem-mission-v1/burst.webp';fx.className='gem-burst';fx.style.left=((position.x+.5)*100/g.level.n)+'%';fx.style.top=((position.y+.5)*100/g.level.n)+'%';board.append(fx);setTimeout(()=>fx.remove(),850);}}
 if(result?.refilled){
  sound.play('board-refill');
  board.querySelectorAll('.block,.rotation-zone,.rock,.special-marker').forEach((el,i)=>el.animate([{translate:'0 -260px',opacity:0},{translate:'0 0',opacity:1}],{duration:600,delay:i*35,easing:'cubic-bezier(.2,.8,.3,1)'}));
 }
 if(s.failed&&!root.hidden&&!fail.open){fail.style.width=(board.getBoundingClientRect().width*.8)+'px';fail.showModal();}}
 return {render};
}
