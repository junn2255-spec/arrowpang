import './app.js';
const root=document.getElementById('game'),asset=name=>name==='02-arrowpang-logo'?'assets/logo-red-arrow-v2/logo.webp':name.startsWith('jewel:')?'assets/next-game-v132/button.webp':name.startsWith('obstacle:')?'assets/stone-obstacles-v2/'+name.slice(9)+'.webp':name.startsWith('wood:')?'assets/wood-action-buttons-v2/'+name.slice(5)+'.webp':name.startsWith('stone:')?'assets/stone-refresh-v1/'+name.slice(6)+'.webp':'assets/garden-ui-v1/'+name+'.webp';
document.body.classList.add('garden-theme');
const nav=root.querySelector('nav'),header=root.querySelector('header'),help=document.createElement('button');help.id='garden-help';help.type='button';help.setAttribute('aria-label','게임 도움말');help.innerHTML='<img src="'+asset('22-help')+'" alt="">';header.append(help);help.onclick=()=>document.dispatchEvent(new Event('garden-help'));
const images={'#game header h1 img':'02-arrowpang-logo','#welcome h1 img':'02-arrowpang-logo','#undo img':'wood:undo','#restart img':'wood:restart','#hint img':'wood:hint','#home img':'wood:home','#next img':'jewel:next','#celebrate .complete-clear':'24-stage-clear','#reward-panel>img':'25-reward-panel','#reward-panel .clear-amount img':'03-coin-icon'};
function set(img,name){const src=asset(name);if(img&&img.getAttribute('src')!==src)img.setAttribute('src',src);}
function styleStatusNumbers(){
 const palettes={stage:['#ecffff','#21ddff','#008cf0','#082b66'],remaining:['#fffbc3','#ffe962','#ff9700','#702000'],moves:['#fffab0','#ffd900','#ff6600','#702000']};
 for(const [id,colors] of Object.entries(palettes)){
 const el=document.getElementById(id);if(!el||el.querySelector('svg'))continue;
 const value=el.textContent.trim(),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 300 116');svg.setAttribute('class','status-number-art');svg.setAttribute('role','img');svg.setAttribute('aria-label',value);
 const stageValue=document.getElementById('stage').textContent.trim();const size=98;
 svg.innerHTML='<defs><linearGradient id="status-fill-'+id+'" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="'+colors[0]+'"/><stop offset="30%" stop-color="'+colors[1]+'"/><stop offset="100%" stop-color="'+colors[2]+'"/></linearGradient></defs><text x="150" y="88" text-anchor="middle" stroke="'+colors[3]+'" stroke-width="8" stroke-linejoin="round" paint-order="stroke fill" fill="url(#status-fill-'+id+')" style="font-size:'+size+'px!important;font-family:User Paperlogy Black!important;font-weight:900!important"></text>';
 svg.querySelector('text').textContent=id==='stage'?value.replace(/\s/g,''):value;if(id==='moves'&&!/[가-힣]/.test(value))svg.querySelector('text').style.setProperty('font-size',(value.length>3?112:150)+'px','important');if(id==='moves'&&/[가-힣]/.test(value)){svg.querySelector('text').setAttribute('textLength','270');svg.querySelector('text').setAttribute('lengthAdjust','spacingAndGlyphs');}el.replaceChildren(svg);
 }
}
function sync(){styleStatusNumbers();const home=document.getElementById('home');if(home.parentElement!==nav)nav.append(home);const fishingEntry=document.getElementById('fishing-entry');if(fishingEntry&&home.nextElementSibling!==fishingEntry)home.after(fishingEntry);for(const[selector,name]of Object.entries(images))set(document.querySelector(selector),name);let on=true;try{const p=JSON.parse(localStorage.getItem('arrowtok-audio')||'null');if(p)on=p.music!==false||p.sfx!==false;}catch{}set(document.querySelector('#settings img'),on?'36-sound-off-large':'36-sound-on-large');document.getElementById('settings').setAttribute('aria-label',on?'소리 끄기':'소리 켜기');document.getElementById('settings').setAttribute('aria-pressed',String(!on));
for(const img of root.querySelectorAll('.rotation-zone img'))set(img,'obstacle:rotation-90');for(const img of root.querySelectorAll('.frog-actor img,.frog-notice-portrait img'))set(img,'28-frog');for(const marker of root.querySelectorAll('.special-marker')){const label=marker.getAttribute('aria-label')||'';set(marker.querySelector('img'),label.startsWith('황금열쇠')?'15-key':'12-bomb');}}
let pending=false;const observer=new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(()=>{pending=false;sync();});}});observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['src','hidden']});observer.observe(document.getElementById('audio-panel'),{childList:true,subtree:true,characterData:true});sync();

document.addEventListener('garden-audio-change',sync);


// Show the combined touch hint only when entering stage one.
(()=>{
 const game=document.getElementById('game'),stage=document.getElementById('stage'),slot=game.querySelector('.board-slot');
 const hint=new Image();hint.id='stage-one-touch-hint';hint.alt='화살표를 터치해서 밖으로 빼내세요!';hint.src='assets/touch-bubble-v1/touch-bubble.webp';hint.draggable=false;
 let eligible=false,timer;
 function update(){
  const active=!game.hidden&&!game.classList.contains('clear-screen')&&parseInt(stage.textContent,10)===1;
  if(active===eligible)return;eligible=active;clearTimeout(timer);hint.remove();
  if(active){slot.append(hint);timer=setTimeout(()=>hint.remove(),3000);}
 }
 new MutationObserver(update).observe(game,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});update();
})();

// Upgrade readiness is derived from persisted coins and the next house purchase.
const topStats=document.querySelector('#game .stats');
topStats.children[1].querySelector('span').textContent='보유 코인';
topStats.children[2].querySelector('span').textContent='집 업그레이드까지';
const upgradeGauge=document.createElement('i');upgradeGauge.className='top-upgrade-gauge';upgradeGauge.setAttribute('aria-hidden','true');topStats.append(upgradeGauge);
const upgradeHit=document.createElement('button');upgradeHit.id='top-upgrade-home';upgradeHit.type='button';upgradeHit.setAttribute('aria-label','집을 업그레이드 하세요! 나의집으로 이동');upgradeHit.onclick=()=>document.getElementById('home').click();topStats.append(upgradeHit);
function syncUpgradeHit(){document.getElementById('home').classList.toggle('upgrade-glowing',topStats.dataset.upgradeReady==='true');upgradeHit.hidden=topStats.dataset.upgradeReady!=='true';upgradeHit.disabled=document.getElementById('home').disabled;}
new MutationObserver(syncUpgradeHit).observe(topStats,{attributes:true,attributeFilter:['data-upgrade-ready']});new MutationObserver(syncUpgradeHit).observe(document.getElementById('home'),{attributes:true,attributeFilter:['disabled']});syncUpgradeHit();

document.querySelector("#next")?.setAttribute("aria-label","다음게임");document.querySelector("#next img")?.setAttribute("alt","다음게임");

const miniPreview=document.createElement('button');miniPreview.id='minigame-preview';miniPreview.type='button';miniPreview.className='complete-button';miniPreview.setAttribute('aria-label','미니게임');miniPreview.innerHTML='<img src="assets/minigame-button-v152/button.webp" alt="미니게임">';nav.prepend(miniPreview);
