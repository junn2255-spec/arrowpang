// Presentation only: reward settlement and navigation remain owned by app/home.
export function rewardNumber(text){const match=String(text).match(/\+(\d+)/);return match?match[1]:'0';}
export function numericSize(text,max,min=14){return Math.max(min,Math.min(max,max*6/Math.max(6,String(text).length)));}
export function initClearScreen(){
 const $=id=>document.getElementById(id),game=$('game');if(!game)return;
 const replacements=[['#celebrate .star','01-golden-star'],['#celebrate .complete-clear','02-clear-ribbon'],['#next img','04-next-stage'],['#restart img','05-restart'],['#hint img','06-hint'],['#home img','07-home']].map(([s,f])=>{const el=document.querySelector(s);return{el,src:el.getAttribute('src'),clear:'assets/clear/'+f+'.webp'};});
 const panel=$('reward-panel'),art=panel.querySelector('img');const oldArt=art.getAttribute('src');
 const amount=document.createElement('div');amount.className='clear-amount';amount.innerHTML='<span class="clear-coin-stack" aria-hidden="true"><img src="assets/garden-ui-v1/03-coin-icon.webp" alt=""><img src="assets/garden-ui-v1/03-coin-icon.webp" alt=""><img src="assets/garden-ui-v1/03-coin-icon.webp" alt=""></span><strong></strong><span class="clear-coin-unit">코인</span>';
 const label=document.createElement('div');label.className='clear-earned-label';label.textContent='획득 코인';const total=document.createElement('p');total.className='clear-total';panel.append(label,amount,total);
 const home=$('home'),nav=home.parentElement,header=game.querySelector('header');
 let active=false;

 function gradientNumber(el,text,id,bottom,width,top='#fffbc3',middle='#ffe962'){
 el.replaceChildren();const measure=document.createElement('span');measure.className='reward-number-measure';measure.textContent=text;el.append(measure);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','reward-gradient-number');svg.setAttribute('aria-hidden','true');
 svg.innerHTML='<defs><linearGradient id="'+id+'" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="'+top+'"/><stop offset="32%" stop-color="'+middle+'"/><stop offset="100%" stop-color="'+bottom+'"/></linearGradient></defs><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" stroke="#701b08" stroke-width="'+width+'" stroke-linejoin="round" paint-order="stroke fill" fill="url(#'+id+')"></text>';
 svg.querySelector('text').textContent=text;el.append(svg);
 }
 function numbers(){if(!active)return;const value=rewardNumber($('reward-amount').textContent),coins=$('wallet').textContent||'0';gradientNumber(amount.querySelector('strong'),'+'+value,'earned-fill','#ff9700',8);amount.style.setProperty('--number-size',numericSize(value,42)+'px');total.replaceChildren(document.createTextNode('현재 보유 '));const held=document.createElement('strong');gradientNumber(held,coins,'held-fill','#142653',5,'#c3f36b','#72bd88');total.append(held,document.createTextNode(' 코인'));total.style.setProperty('--number-size',numericSize(coins,23)+'px');$('wallet').style.setProperty('--clear-wallet-size',numericSize(coins,32,12)+'px');}
 function sync(){const on=!$('next').hidden;const parent=on?nav:header;if(home.parentElement!==parent)parent.append(home);$('hint').hidden=on;if(on!==active){active=on;game.classList.toggle('clear-screen',on);for(const r of replacements)r.el.setAttribute('src',on?r.clear:r.src);art.setAttribute('src',on?'assets/clear/03-reward-panel.webp':oldArt);$('hint').disabled=on;if(!on){amount.querySelector('strong').textContent='';total.textContent='';$('wallet').style.removeProperty('--clear-wallet-size');}}numbers();}
 const observer=new MutationObserver(sync);observer.observe($('next'),{attributes:true,attributeFilter:['hidden']});observer.observe($('wallet'),{childList:true,characterData:true,subtree:true});observer.observe($('reward-amount'),{childList:true,characterData:true,subtree:true});sync();
 return{sync,disconnect:()=>observer.disconnect()};
}
if(typeof document!=='undefined')initClearScreen();
