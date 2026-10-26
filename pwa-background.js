// Retain normal browser installation and waiting-worker lifecycle without app prompts.
export function registerBackgroundPWA(w=window,d=document){
 const note=d.getElementById('offline-note');
 const offline=()=>{if(note)note.hidden=w.navigator.onLine!==false;};offline();
 w.addEventListener('offline',offline);w.addEventListener('online',offline);
 w.navigator.serviceWorker?.addEventListener('message',event=>{if(note&&event.data?.type==='CACHE_MISS'){note.hidden=false;note.textContent='아직 저장되지 않은 이미지나 소리가 필요해요. 인터넷 연결 후 다시 열어 주세요. 저장 기록은 그대로 유지됩니다.';}});
 async function register(){if(!w.isSecureContext||!w.navigator.serviceWorker)return;try{return await w.navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:new URL('./',import.meta.url).pathname,updateViaCache:'none'});}catch{return null;}}
 if(d.readyState==='complete')register();else w.addEventListener('load',register,{once:true});
 return{register};
}
