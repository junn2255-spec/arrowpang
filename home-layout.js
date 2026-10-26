// Keep scene-owned lock text in the scene; project it into one stable output node.
const panel=document.getElementById('home-panel'),wrap=panel?.querySelector('.home-wrap');
if(wrap){
 const bubble=document.createElement('div');bubble.id='home-guidance';wrap.append(bubble);
 let lastStatus='',statusTimer;
 const arrange=()=>{
  for(const id of ['home-stage','home-cost','home-status']){const el=document.getElementById(id);if(el&&el.parentElement!==bubble)bubble.append(el);}
  const status=document.getElementById('home-status'),current=status?.textContent??'';
  if(current!==lastStatus){clearTimeout(statusTimer);lastStatus=current;
   if(current==='집이 업그레이드됐어요!')statusTimer=setTimeout(()=>{if(status.textContent===current)status.textContent='';},4000);
  }
 };
 arrange();new MutationObserver(arrange).observe(wrap,{childList:true,subtree:true,characterData:true});
 new MutationObserver(()=>{if(panel.hidden){clearTimeout(statusTimer);const status=document.getElementById('home-status');if(status?.textContent==='집이 업그레이드됐어요!')status.textContent='';}}).observe(panel,{attributes:true,attributeFilter:['hidden']});
}
const inside=document.getElementById('interior-panel');
if(inside){const group=document.createElement('div');group.className='interior-guidance';inside.querySelector('.interior-shell').append(group);for(const id of ['interior-status','interior-next']){const el=document.getElementById(id);if(el)group.append(el);}}
