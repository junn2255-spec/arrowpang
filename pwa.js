export const SHARE_URL='https://arrow-escape-two-20261022.junn2255.chatgpt.site/';
export function environment(w){const ua=w.navigator?.userAgent??'';return{ios:/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&(w.navigator.maxTouchPoints??0)>1),android:/Android/.test(ua),kakao:/KAKAOTALK/i.test(ua),standalone:!!(w.navigator?.standalone||w.matchMedia?.('(display-mode: standalone)').matches)};}
export function instructions(e){if(e.kakao)return '홈 화면에 설치하려면 외부 브라우저에서 열어 주세요. 카카오톡 화면 메뉴에서 다른 브라우저로 열기를 찾아 '+(e.ios?'Safari':'Chrome')+'로 열어 주세요. 메뉴가 없으면 링크를 복사해 '+(e.ios?'Safari':'Chrome')+' 주소창에 붙여 넣으세요.';if(e.ios)return 'Safari에서 공유 → 홈 화면에 추가 → 추가를 선택하세요. Safari가 아니라면 링크를 복사해 Safari에서 열어 주세요.';return '브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 찾아 주세요. 메뉴가 없으면 지원되는 브라우저에서 열거나 바로 플레이를 이용하세요.';}
export function initPWA(w=window,d=document){
 const $=id=>d.getElementById(id);if(!$('install-app'))return;let deferred=null,registration=null;
 const status=t=>{$('install-status').textContent=t;};
 const paint=()=>{const e=environment(w);$('install-area').hidden=e.standalone;$('install-help').textContent=instructions(e);$('copy-link').hidden=!e.kakao;};
 paint();w.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',paint);
 w.addEventListener('beforeinstallprompt',event=>{const e=environment(w);if(!e.android||e.ios||e.kakao||e.standalone)return;event.preventDefault();deferred=event;});
 $('install-app').addEventListener('click',async()=>{const e=environment(w);if(e.standalone){paint();return;}if(e.android&&!e.ios&&!e.kakao&&deferred){const event=deferred;deferred=null;try{await event.prompt();const choice=await event.userChoice;status(choice.outcome==='accepted'?'설치 요청을 보냈어요. 완료되면 홈 화면의 아이콘을 확인하세요.':'설치를 취소했어요. 바로 플레이로 계속 즐길 수 있어요.');}catch{status(instructions(e));}}else status(instructions(e));$('install-help').hidden=false;});
 w.addEventListener('appinstalled',()=>{deferred=null;status('브라우저가 설치 완료를 알려왔어요. 홈 화면에서 아이콘을 확인하세요.');paint();});
 $('copy-link').addEventListener('click',async()=>{try{await w.navigator.clipboard.writeText(SHARE_URL);status('링크를 복사했어요. 외부 브라우저 주소창에 붙여 넣으세요.');}catch{$('share-link').hidden=false;$('share-link').value=SHARE_URL;$('share-link').focus?.();$('share-link').select?.();status('아래 주소를 길게 눌러 복사하세요.');}});
 const offline=()=>{$('offline-note').hidden=w.navigator.onLine!==false;};offline();w.addEventListener('offline',offline);w.addEventListener('online',offline);
 w.navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='CACHE_MISS'){$('offline-note').hidden=false;$('offline-note').textContent='아직 저장되지 않은 이미지나 소리가 필요해요. 인터넷 연결 후 다시 열어 주세요. 진행 기록은 그대로 유지됩니다.';}});
 const safe=()=>d.getElementById('board')?.getAttribute?.('aria-busy')!=='true'&&d.getElementById('coin-fly')?.hidden!==false&&!d.getElementById('home-scene')?.classList?.contains?.('repairing');
 $('update-app').addEventListener('click',()=>{if(!safe()){$('update-status').textContent='현재 이동·보상·수리가 끝난 뒤 다시 눌러 주세요.';return;}$('update-status').textContent='진행 기록을 유지하려면 모든 화살표팡 창을 닫은 뒤 다시 열어 주세요. 새 버전은 다음 실행에 적용됩니다.';});
 const waiting=()=>{if(registration?.waiting)$('update-area').hidden=false;};
 async function register(){if(!w.isSecureContext||!w.navigator.serviceWorker){status('이 환경에서는 웹앱 기능 일부를 사용할 수 없어요. 바로 플레이는 계속 이용할 수 있어요.');return;}try{registration=await w.navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:new URL('./',import.meta.url).pathname,updateViaCache:'none'});waiting();registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',waiting));}catch{status('오프라인 준비를 완료하지 못했어요. 인터넷에 연결해 바로 플레이하거나 브라우저 메뉴의 홈 화면 추가를 확인하세요.');}}
 if(d.readyState==='complete')register();else w.addEventListener('load',register,{once:true});
 // No redirect, automatic prompt, skipWaiting, forced reload or saved-game mutation.
 return{paint,register,safe};
}
