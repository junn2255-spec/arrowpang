export function statusParts(text){const m=text.match(/^(돌 내구도 \d+)(.*)$/);return m?[m[1],m[2]]:null;}
export function walletFont(text){return Math.max(10,Math.min(36,180/Math.max(5,String(text).length)));}
export function initPlayUI({doc=globalThis.document,reduced=()=>false,schedule=setTimeout,unschedule=clearTimeout,Observer=globalThis.MutationObserver}={}){
 const board=doc.getElementById('board'), notice=doc.createElement('div');notice.id='blocked-notice';notice.hidden=true;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.textContent='화살표가 마주보면 탈출할수 없어요 한단계 되돌려주세요';board?.parentElement?.append(notice);
 const setBlocked=value=>{const show=!!value;if(notice.hidden===!show)return;notice.hidden=!show;doc.getElementById('game')?.toggleAttribute('data-blocked',show);};
 const message=doc.getElementById('message'),wallet=doc.getElementById('wallet');let lastMessage='',lastCoins=wallet?.textContent,timer,animation,coinAnimation;
 const lane=doc.createElement('div');lane.id='play-notice-lane';lane.hidden=true;board?.parentElement?.append(lane);const combo=doc.getElementById('combo');if(combo)lane.append(combo);if(message)lane.append(message);
 const clear=()=>{setBlocked(false);unschedule(timer);animation?.cancel();coinAnimation?.cancel();animation=coinAnimation=null;if(message)message.textContent='';lastMessage='';};
 const updateMessage=()=>{const text=message?.textContent??'';if(text===lastMessage)return;lastMessage=text;unschedule(timer);animation?.cancel();const parts=statusParts(text);if(parts){const gold=doc.createElement('span');gold.className='stone-durability';gold.textContent=parts[0];const body=doc.createElement('span');body.textContent=parts[1];message.replaceChildren(gold,body);}
 if(text&&!reduced())animation=message.animate?.([{transform:'scale(.92)'},{transform:'scale(1.06)',offset:.55},{transform:'scale(1)'}],{duration:200,easing:'ease-out'});
 if(/돌 내구도|돌이 깨졌|막혔|장애물 바로/.test(text))timer=schedule(()=>{if(message.textContent===text)message.textContent='';},2400);
 };
 const updateWallet=()=>{const text=wallet?.textContent??'';if(wallet){wallet.style.setProperty('--wallet-font',walletFont(text)+'px');wallet.dataset.digits=String(text.length);}if(text!==lastCoins){lastCoins=text;coinAnimation?.cancel();if(!reduced())coinAnimation=wallet?.animate?.([{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}],{duration:200});}};
 if(Observer){new Observer(updateMessage).observe(message,{childList:true,subtree:true,characterData:true});new Observer(updateWallet).observe(wallet,{childList:true,subtree:true,characterData:true});}
 updateWallet();return{clear,updateMessage,updateWallet,setBlocked};
}
