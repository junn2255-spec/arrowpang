export function initGameOver(restart){
 const dialog=document.createElement('dialog');dialog.id='game-over-popup';dialog.setAttribute('aria-label','게임 종료');
 dialog.innerHTML='<img src="assets/game-over-v157/popup.webp" alt="게임 종료. 더 이상 이동할 수 없어요. 되돌리기 횟수를 모두 사용했어요."><button type="button" aria-label="다시 시작하기"></button>';
 document.body.append(dialog);let ended=false;
 function sync(){const visible=ended&&!document.getElementById('game').hidden;if(visible&&!dialog.open){dialog.showModal();dialog.querySelector('button').focus();}else if(!visible&&dialog.open)dialog.close();}
 dialog.addEventListener('cancel',e=>e.preventDefault());
 dialog.querySelector('button').onclick=()=>{ended=false;dialog.close();restart();};
 new MutationObserver(sync).observe(document.getElementById('game'),{attributes:true,attributeFilter:['hidden']});
 return {update(value){ended=!!value;sync();}};
}
