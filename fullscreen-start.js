const welcome=document.getElementById('welcome'),start=document.getElementById('start');
if(welcome&&start){
 const button=document.createElement('button');button.id='fullscreen-start';button.type='button';button.textContent='⛶ 풀화면으로 시작';welcome.querySelector('.menu-actions').before(button);
 button.addEventListener('click',()=>{
  const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
  let result;
  try{if(!document.fullscreenElement&&request)result=request.call(root);}catch{}
  start.click();
  if(result?.catch)result.catch(()=>{});
 });
}
