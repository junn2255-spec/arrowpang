export function guideSize(w,h,ratio,padX=32,padY=32){const width=Math.max(0,Math.min(520,w-padX,(h-padY)*ratio));return{width,height:width/ratio};}
export const PLAY_GUIDE='화살표를 눌러 모두 화면 밖으로 빼내세요\n돌이 막히면 3번만에 돌이 깨집니다.\n황금열쇠는 돌 최대 2개, 폭탄은 발동 화살표 포함 최대 3개를 없애요.\n폭탄은 홀수 미션, 열쇠는 3의 배수 미션에 나와요.\n3·4·5콤보: +30·+40·+50코인!\n폭탄으로 사라진 화살표는 콤보에서 제외돼요.\n코인을 모아 집을 건설하세요!';
export const HOME_GUIDE='코인이 모이면\n나의 숲속집을\n멋있게 꾸밀수 있어요';
export function initTutorials(){
 const $=id=>document.getElementById(id);let played=false,target=null,returnFocus=null;
 function fit(){const overlay=$('tutorial'),img=$('tutorial-image');if(!overlay||overlay.hidden)return;const v=globalThis.visualViewport,w=v?.width??globalThis.innerWidth??360,h=v?.height??globalThis.innerHeight??640;const css=globalThis.getComputedStyle?.(overlay);const px=(parseFloat(css?.paddingLeft)||16)+(parseFloat(css?.paddingRight)||16),py=(parseFloat(css?.paddingTop)||16)+(parseFloat(css?.paddingBottom)||16);const size=guideSize(w,h,overlay.dataset.guide==='home'?4/3:1.25,px,py);Object.assign(overlay.style,{inset:'auto',left:(v?.offsetLeft??0)+'px',top:(v?.offsetTop??0)+'px',width:w+'px',height:h+'px'});overlay.style.setProperty('--guide-width',size.width+'px');}
 globalThis.addEventListener?.('resize',fit);globalThis.addEventListener?.('orientationchange',fit);globalThis.visualViewport?.addEventListener('resize',fit);globalThis.visualViewport?.addEventListener('scroll',fit);
 function close(){if($('tutorial'))$('tutorial').hidden=true;if(target)target.inert=false;target=null;const previous=returnFocus;returnFocus=null;if(previous?.isConnected!==false)previous?.focus?.({preventScroll:true});}
 function show(text,area){if(!$('tutorial'))return;close();returnFocus=document.activeElement;$('tutorial').dataset.keyboard='false';$('tutorial').dataset.guide=area==='game'?'play':'home';if($('tutorial-image')){$('tutorial-image').hidden=false;$('tutorial-image').src=area==='game'?'assets/ui/play-guide.webp':'assets/ui/home-guide.webp';$('tutorial-image').width=area==='game'?800:900;$('tutorial-image').height=area==='game'?640:675;}$('tutorial-text').textContent=text;target=$(area);if(target)target.inert=true;$('tutorial').hidden=false;fit();$('tutorial-close')?.focus?.({preventScroll:true});}
 $('tutorial-close')?.addEventListener('click',close);
 $('tutorial')?.addEventListener('pointerdown',()=>{$('tutorial').dataset.keyboard='false';});
 $('tutorial')?.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();$('tutorial').dataset.keyboard='true';$('tutorial-close')?.focus?.({preventScroll:true});}});
 return{reset(){close();played=false;},play(){if(played)return;played=true;show(PLAY_GUIDE,'game');},home(){show(HOME_GUIDE,'home-panel');},close};
}
