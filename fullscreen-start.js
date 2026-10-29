const welcome=document.getElementById('welcome'),start=document.getElementById('start');
if(welcome&&start){
 const button=document.createElement('button');button.id='fullscreen-start';button.type='button';button.textContent='⛶ 풀화면으로 시작';welcome.querySelector('.menu-actions').before(button);
 const lockPortrait=()=>{if(document.fullscreenElement||document.webkitFullscreenElement){try{screen.orientation?.lock?.('portrait').catch(()=>{});}catch{}}};
 document.addEventListener('fullscreenchange',lockPortrait);document.addEventListener('webkitfullscreenchange',lockPortrait);
 button.addEventListener('click',()=>{
  start.click();
  const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
  try{if(!document.fullscreenElement&&request){const result=request.call(root);result?.then?.(lockPortrait,()=>{});}}catch{}
 });
}
