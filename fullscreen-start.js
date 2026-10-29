const welcome=document.getElementById('welcome'),start=document.getElementById('start');
if(welcome&&start){
 const button=document.createElement('button');button.id='fullscreen-start';button.type='button';button.textContent='⛶ 풀화면으로 시작';welcome.querySelector('.menu-actions').before(button);
 const fullscreen=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
 let requested=false,locking=false,checkTimer;
 const mobile=()=>matchMedia('(pointer:coarse)').matches;
 const landscape=()=>innerWidth>innerHeight;
 async function lockPortrait(){
  if(!requested||!fullscreen()||locking)return;locking=true;
  try{if(screen.orientation?.lock)await screen.orientation.lock('portrait-primary');}catch{}finally{locking=false;}
  clearTimeout(checkTimer);checkTimer=setTimeout(()=>{if(requested&&fullscreen()&&mobile()&&landscape()){
   // Some mobile browsers force landscape in fullscreen and reject orientation locks.
   // Return to the portrait browser view instead of leaving the game landscape-locked.
   try{const exit=document.exitFullscreen||document.webkitExitFullscreen;Promise.resolve(exit?.call(document)).catch(()=>{});}catch{}
  }},700);
 }
 function changed(){if(fullscreen())void lockPortrait();else{clearTimeout(checkTimer);try{screen.orientation?.unlock?.();}catch{}}}
 document.addEventListener('fullscreenchange',changed);document.addEventListener('webkitfullscreenchange',changed);
 window.addEventListener('orientationchange',()=>setTimeout(lockPortrait,150));window.addEventListener('resize',()=>{if(fullscreen()&&landscape())void lockPortrait();});
 button.addEventListener('click',()=>{
  requested=true;document.body.classList.add('portrait-play');start.click();
  const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
  try{if(!fullscreen()&&request)Promise.resolve(request.call(root)).then(lockPortrait,()=>{});else void lockPortrait();}catch{}
 });
}
