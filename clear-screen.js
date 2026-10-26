// Presentation only: reward settlement and navigation remain owned by app/home.
export function rewardNumber(text){const match=String(text).match(/\+(\d+)/);return match?match[1]:'0';}
export function numericSize(text,max,min=14){return Math.max(min,Math.min(max,max*6/Math.max(6,String(text).length)));}
export function initClearScreen(){
 const $=id=>document.getElementById(id),game=$('game');if(!game)return;
 const replacements=[['#celebrate .star','01-golden-star'],['#celebrate .complete-clear','02-clear-ribbon'],['#next img','04-next-stage'],['#restart img','05-restart'],['#hint img','06-hint'],['#home img','07-home']].map(([s,f])=>{const el=document.querySelector(s);return{el,src:el.getAttribute('src'),clear:'assets/clear/'+f+'.webp'};});
 const panel=$('reward-panel'),art=panel.querySelector('img');const oldArt=art.getAttribute('src');
 const amount=document.createElement('div');amount.className='clear-amount';amount.innerHTML='<img src="assets/home/24-coin.webp" alt=""><strong></strong>';
 const total=document.createElement('p');total.className='clear-total';panel.append(amount,total);
 const home=$('home'),nav=home.parentElement,header=game.querySelector('header');
 let active=false;
 function numbers(){if(!active)return;const value=rewardNumber($('reward-amount').textContent),coins=$('wallet').textContent||'0';amount.querySelector('strong').textContent='+'+value+' 코인';amount.style.setProperty('--number-size',numericSize(value,42)+'px');total.textContent='보유 코인 '+coins;total.style.setProperty('--number-size',numericSize(coins,23)+'px');$('wallet').style.setProperty('--clear-wallet-size',numericSize(coins,32,12)+'px');}
 function sync(){const on=!$('next').hidden;const parent=on?nav:header;if(home.parentElement!==parent)parent.append(home);$('hint').hidden=on;if(on!==active){active=on;game.classList.toggle('clear-screen',on);for(const r of replacements)r.el.setAttribute('src',on?r.clear:r.src);art.setAttribute('src',on?'assets/clear/03-reward-panel.webp':oldArt);$('hint').disabled=on;if(!on){amount.querySelector('strong').textContent='';total.textContent='';$('wallet').style.removeProperty('--clear-wallet-size');}}numbers();}
 const observer=new MutationObserver(sync);observer.observe($('next'),{attributes:true,attributeFilter:['hidden']});observer.observe($('wallet'),{childList:true,characterData:true,subtree:true});observer.observe($('reward-amount'),{childList:true,characterData:true,subtree:true});sync();
 return{sync,disconnect:()=>observer.disconnect()};
}
if(typeof document!=='undefined')initClearScreen();
