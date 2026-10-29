// Keep scene-owned lock text in the scene; project it into one stable output node.
const panel=document.getElementById('home-panel'),wrap=panel?.querySelector('.home-wrap');
if(wrap){
 const bubble=document.createElement('div');bubble.id='home-guidance';wrap.append(bubble);
 let lastStatus='',statusTimer;
 const arrange=()=>{
  for(const id of ['home-stage','home-cost','home-status']){const el=document.getElementById(id);if(!el)continue;const toast=id==='home-status'&&el.textContent.startsWith('업그레이드됐어요!');const target=toast?wrap:bubble;if(el.parentElement!==target)target.append(el);if(id==='home-status'){el.classList.toggle('home-upgrade-toast',toast);if(toast){if(!el.querySelector('.home-upgrade-detail')&&el.textContent.includes('\n')){const lines=el.textContent.split('\n'),detail=document.createElement('span');detail.className='home-upgrade-detail';detail.textContent=lines.slice(1).join('\n');detail.dataset.label=detail.textContent;const label=detail.textContent,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='800 32px "User Paperlogy ExtraBold"';const width=Math.ceil(ctx.measureText(label).width)+20,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 '+width+' 52');svg.setAttribute('width',width);svg.setAttribute('height','52');svg.innerHTML='<defs><linearGradient id="home-upgrade-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff76a"/><stop offset="35%" stop-color="#ffe323"/><stop offset="70%" stop-color="#ffb300"/><stop offset="100%" stop-color="#ff8100"/></linearGradient></defs><text x="50%" y="35" text-anchor="middle" font-size="32" stroke="#064747" stroke-width="6" stroke-linejoin="round" paint-order="stroke fill" fill="url(#home-upgrade-gold)"></text>';svg.querySelector('text').textContent=label;detail.replaceChildren(svg);el.replaceChildren(document.createTextNode(lines[0]+'\n'),detail);}const house=document.querySelector('#home-scene .house-body');if(house)el.style.top=Math.max(100,house.getBoundingClientRect().top-wrap.getBoundingClientRect().top-82)+'px';}}}
  const status=document.getElementById('home-status'),current=status?.textContent??'';
  if(current!==lastStatus){clearTimeout(statusTimer);lastStatus=current;
   if(current.startsWith('업그레이드됐어요!'))statusTimer=setTimeout(()=>{if(status.textContent===current)status.textContent='';},4000);
  }
 };
 arrange();new MutationObserver(arrange).observe(wrap,{childList:true,subtree:true,characterData:true});
 new MutationObserver(()=>{if(panel.hidden){clearTimeout(statusTimer);const status=document.getElementById('home-status');if(status?.textContent.startsWith('업그레이드됐어요!'))status.textContent='';}}).observe(panel,{attributes:true,attributeFilter:['hidden']});
}
const inside=document.getElementById('interior-panel');
if(inside){const group=document.createElement('div');group.className='interior-guidance';inside.querySelector('.interior-shell').append(group);for(const id of ['interior-status','interior-next']){const el=document.getElementById(id);if(el)group.append(el);}}
