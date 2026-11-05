export function initGameOver(restart){
 const dialog=document.createElement('dialog');dialog.id='game-over-popup';dialog.setAttribute('aria-label','게임 종료');
 dialog.innerHTML='<img src="assets/facing-retry-v1/popup-aqua-two-buttons.png" alt="더 이상 진행할 수 없습니다. 마주 보는 화살표를 해결할 수 없어요. 다시 도전해 보세요."><button type="button" class="facing-retry" aria-label="게임 다시 도전"></button><button class="facing-item" aria-label="아이템으로 클리어하기, 준비 중" disabled></button>';
 document.body.append(dialog);let ended=false;
 function sync(){const visible=ended&&!document.getElementById('game').hidden;if(visible&&!dialog.open){dialog.style.width=(document.getElementById('board').getBoundingClientRect().width*.8)+'px';dialog.showModal();dialog.querySelector('button').focus();}else if(!visible&&dialog.open)dialog.close();}
 dialog.addEventListener('cancel',e=>e.preventDefault());
 dialog.querySelector('button').onclick=async()=>{const button=dialog.querySelector('button');button.disabled=true;ended=false;dialog.close();try{await restart();}finally{button.disabled=false;}};
 new MutationObserver(sync).observe(document.getElementById('game'),{attributes:true,attributeFilter:['hidden']});
 return {update(value){ended=!!value;sync();}};
}
