import {MoleGame, REWARD} from './engine.js';
import {RewardGate} from './reward.js';
import {Sound} from './audio.js';
import {HAMMER_PIVOTS,HAMMER_DURATION,HAMMER_IMPACT,hammerPoseAt} from './hammer-motion.js';
import {art,createArtTextures,applyArt} from './art.js';
const ASSETS=new URL('../assets/whack-a-mole/',import.meta.url);
const loadImage=path=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error(`이미지 로드 실패: ${path}`));im.src=new URL(path,ASSETS);});
const uuid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fontPromise=typeof FontFace==='function'?new FontFace('Mole Paperlogy ExtraBold',`url("${new URL('../../assets/user-fonts-paperlogy/Paperlogy-8ExtraBold.ttf',import.meta.url)}")`,{weight:'800'}).load().then(font=>document.fonts.add(font)).catch(e=>console.warn('게임 서체 로드 실패',e)):Promise.resolve();
const FX_MARGIN=380;
const HAMMER_SCALE=1.3*1.5;
const CHARACTER_SCALE=1.08*1.12;

export function mountMoleGame(root,{stage=5,runId=uuid(),credit,onExit=()=>{},preview=false,balance=0,haptic,musicEnabled=true,sfxEnabled=true,reduceEffects=false}={}){
  if(typeof credit!=='function')throw new Error('보상 저장을 위한 credit 함수를 연결해야 합니다.');
  const abort=new AbortController(),sound=new Sound();sound.enabled=sfxEnabled;sound.musicEnabled=musicEnabled;
  let game,images={},raf,clock=0,destroyed=false,starting=false,counting=false,countdown=0,strikes=[],sparks=[],floats=[],hitstop=0,settled=false,swingSerial=0;
  let vibration=true,gate,result=null,settlement=0,resultNotBefore=0,textures={},effects=[],pendingFinish=null;
  const reduced=reduceEffects||matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.innerHTML=`<section class="mole-app">
    <header class="topbar"><span class="brand">화살표팡 <b>미니게임</b></span><div class="settings"><button class="icon-btn sound-btn" aria-label="소리 끄기" aria-pressed="true">♪</button><button class="icon-btn vibration-btn" aria-label="진동 끄기" aria-pressed="true">≋</button></div></header>
    <div class="heading"><h1 class="sr-only">두더지 잡기!</h1>${art('logo','title-art')}</div>
    <div class="status"><div class="status-box timer">${art('timeCircle','panel-art')}<span class="sr-only">남은 시간</span><strong><b data-time>50</b><small>초</small></strong></div><div class="status-box">${art('scoreCircle','panel-art')}<span class="sr-only">잡은 두더지</span><strong><b data-score>0</b><small> /<b data-target>20</b></small></strong></div></div>
    <div class="progress-track" aria-hidden="true">${art('gaugeFrame','gauge-frame')}<div class="progress-well"><div class="progress-fill">${art('gaugeFill','gauge-texture')}<span class="progress-glint"></span></div><span class="progress-head">${art('gaugeJewel')}</span></div></div>
    <div class="board-viewport"><div class="playfield"><canvas aria-label="두더지 구멍 9개. 키보드는 Q W E, A S D, Z X C로 타격합니다." tabindex="0"></canvas><div class="countdown" hidden></div></div></div>
    <span class="live-message sr-only" aria-live="polite"></span>
    <div class="bottom-bar"><button class="pause-button art-button" aria-label="일시정지">${art('pause')}</button><button class="restart-button art-button" aria-label="두더지 게임 다시 시작">${art('restart')}</button></div>
    ${preview?`<div class="preview-bar"><span>독립 실행 미리보기 · 코인 <b class="wallet">${balance}</b></span><label>진입 단계 <select aria-label="진입 단계"><option value="5">5단계 후</option><option value="15">15단계 후</option><option value="25">25단계 후</option></select></label></div>`:''}
    <div class="modal-scrim"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"></section></div>
  </section>`;
  const $=s=>root.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d');
  canvas.className='action-canvas';
  const burrowLayer=document.createElement('canvas'),frontLayer=document.createElement('canvas');
  const fxLayer=document.createElement('canvas'),fx=fxLayer.getContext('2d');fxLayer.className='fx-layer';
  burrowLayer.className='burrow-layer';frontLayer.className='burrow-front';
  for(const layer of [burrowLayer,frontLayer,fxLayer]){layer.setAttribute('aria-hidden','true');layer.style.pointerEvents='none';}
  canvas.after(burrowLayer,frontLayer,fxLayer);
  const modal=$('.modal'),scrim=$('.modal-scrim');
  const positions=Array.from({length:9},(_,i)=>({x:140+(i%3)*220,y:175+Math.floor(i/3)*245}));
  const assetPromise=Promise.all([loadImage('characters/mole-burrow.png'),loadImage('characters/burrow-empty.png'),loadImage('hammer/hammer-sketch-6frames-v5.png'),loadImage('effects/effects-pips.png'),loadImage('ui/ui-art.png'),loadImage('ui/popups.png'),loadImage('ui/approved-header-v13.png'),loadImage('ui/approved-controls-v13.png'),loadImage('ui/intro-reward-text-v24.png')]).then(([mole,hole,hammer,fx,ui,popups,approvedHeader,approvedControls,introReward])=>{images={mole,hole,hammer,fx,ui,popups,approvedHeader,approvedControls,introReward};textures=createArtTextures(images);applyArt(root,textures);});
  function listen(el,type,fn){el.addEventListener(type,fn,{signal:abort.signal});}
  function message(text){$('.live-message').textContent=text;}
  function vibrate(pattern){if(!vibration)return;try{if(haptic)haptic(pattern);else navigator.vibrate?.(pattern);}catch{}}
  function modalView(html){modal.innerHTML=html;applyArt(modal,textures);scrim.hidden=false;queueMicrotask(()=>modal.querySelector('button')?.focus({preventScroll:true}));}
  function hideModal(){scrim.hidden=true;$('.mole-app').dataset.view='playing';canvas.focus({preventScroll:true});}
  function newRound(nextStage=stage){
    stage=Number(nextStage);game?.stop();sound.stopMusic();settlement++;gate=new RewardGate({transactionId:`arrowpang:mole:${runId}:stage:${stage}`,credit});
    settled=false;result=null;pendingFinish=null;hitstop=0;strikes=[];sparks=[];floats=[];effects=[];counting=false;starting=false;$('.countdown').hidden=true;
    game=new MoleGame({stage,onEvent:handleEvent});
    $('.timer').classList.remove('urgent');$('.pause-button').disabled=false;
    message('');updateHud();showReady();
  }
  function showReady(){
    $('.mole-app').dataset.view='ready';
    modalView(`${art('logo','ready-logo')}<div class="ready-tagline" role="img" aria-label="화살표팡 미니게임 · 클리어 시 ${REWARD}코인 지급">${art('introReward','intro-reward-art')}</div><div class="illustrated-panel instructions-only">${art('instructions','popup-art')}<h2 id="modal-title" class="sr-only">게임 방법 · 두더지 머리를 3번 터치하세요</h2><button class="panel-button" data-action="start" aria-label="게임 시작"><span class="sr-only">게임 시작</span></button></div>`);
  }
  async function start(){
    if(starting||destroyed)return;starting=true;sound.stopIntro();const token=settlement;
    const button=modal.querySelector('button');if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
    try{
      await Promise.all([assetPromise,fontPromise,sound.unlock()]);if(destroyed||token!==settlement)return;
      hideModal();counting=true;countdown=3;$('.countdown').dataset.value='';$('.countdown').hidden=false;showCountdown('3');
    }catch(e){if(!destroyed&&token===settlement)modalView(`<div class="plain-modal"><h2 id="modal-title">준비하지 못했어요</h2><p>에셋 파일을 확인한 뒤 다시 시도해주세요.</p><button class="primary" data-action="start">다시 준비</button></div>`);console.error(e);}
    finally{if(token===settlement)starting=false;}
  }
  function showCountdown(text){
    const el=$('.countdown');if(el.dataset.value===text)return;el.dataset.value=text;
    el.innerHTML=`<span class="count-ring"></span><span class="count-text">${text}</span><span class="count-spark">✦</span>`;
    if(text==='시작!')sound.play('game-start',.8);
    else sound.play('countdown-tick',.75,text==='3'?1:text==='2'?1.08:1.16);
  }
  function handleEvent(e){
    if(e.type==='spawn')sound.play('mole-emerge',.3);
    if(e.type==='hide'){sound.play('mole-hide',.2);effects.push({kind:'dust',hole:e.hole,life:0});}
    if(e.type==='hit'){
      const p=positions[e.hole];
      sound.play('hammer-hit',.8,1+(e.hits-1)*.04);
      vibrate(e.hits===3?[40,25,75,25,35]:e.hits===2?30:20);
      hitstop=reduced?0:e.hits===3?200:35;
      effects.push({kind:e.hits===3?'success':'hit',hole:e.hole,life:0});
      for(let i=0;i<(reduced?3:e.hits===3?44:12);i++){const a=Math.random()*Math.PI*2;const speed=110+Math.random()*260;sparks.push({x:p.x,y:p.y-70,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-100,life:0,total:e.hits===3?1000:400});}
      floats=floats.filter(f=>!f.number||f.x!==p.x||f.y!==p.y-85);
      floats.push({x:p.x,y:p.y-85,text:String(e.hits),number:true,life:0});
      if(e.hits===3){
        if(!reduced)for(let i=0;i<24;i++){const a=i/24*Math.PI*2,speed=130+Math.random()*190;sparks.push({kind:'confetti',color:['#ffdc48','#ff793c','#8df064','#5ce1fa','#ff91c6'][i%5],angle:Math.random()*Math.PI,x:p.x,y:p.y-70,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-170,life:0,total:1000+Math.random()*200});}
        floats.push({x:p.x,y:p.y-165,text:'잡았다!',life:0});$('.status-box:last-child').animate([{filter:'brightness(1.8)',transform:'scale(1.1)'},{filter:'brightness(1)',transform:'scale(1)'}],{duration:450});}
    }
    if(e.type==='warning'){sound.play('timer-warning',.42);$('.timer').classList.add('urgent');}
    if(e.type==='finish'){
      sound.stopMusic();$('.pause-button').disabled=true;result=e;counting=false;$('.countdown').hidden=true;$('.mole-app').dataset.view='result';
      pendingFinish={event:e,left:e.success?1400:0};
    }
  }
  async function settleReward(){
    const token=settlement;
    modalView(resultPanel(true,true));
    try{
      const receipt=await gate.claim({success:true,stage,score:game.score});
      if(destroyed||token!==settlement)return;
      settled=true;if(preview&&Number.isFinite(receipt.balance))$('.wallet').textContent=receipt.balance;
      sound.play('coin-reward',.5);showResult();
    }catch(e){
      if(destroyed||token!==settlement)return;
      modalView(`<h2 id="modal-title">보상을 저장하지 못했어요</h2><p>잡기 성공 기록은 유지됩니다.<br>다시 저장해도 중복 지급되지 않아요.</p><button class="primary" data-action="reward-retry">보상 저장 다시 시도</button>`);console.error(e);
    }
  }
  function resultPanel(won,saving=false){
    const label=won?(preview?'결과 확인':'화살표팡 계속하기'):'다시 도전';
    return `<div class="result-card ${won?'won':'lost'}"><h2 id="modal-title">${won?'성공!':'다시 도전!'}</h2>${won?`<div class="coin-celebration"><span class="prize-stack" aria-hidden="true">${art('coin','prize-coin coin-back-left')}${art('coin','prize-coin coin-back-right')}${art('coin','prize-coin coin-middle')}${art('coin','prize-coin coin-front')}</span><div class="prize-amount">+${REWARD}<small>코인</small></div></div>`:`<div class="result-score"><span>잡은 두더지</span><strong>${game.score}<small> / ${game.config.target}마리</small></strong></div>`}${saving?'<p class="saving">보상을 저장하고 있어요…</p>':!won?'<p>조금만 더! 다시 도전해 봐요</p>':''}<button class="primary result-primary" data-action="${won?'continue':'retry'}" aria-label="${label}" disabled>${saving?'저장 중…':won?'계속하기':'다시 도전'}<span aria-hidden="true">${won?'▶':'↻'}</span></button></div>${!won?'<button class="secondary" data-action="continue">본게임 계속하기 →</button>':''}${preview&&won&&!saving?'<button class="secondary" data-action="demo-again">연습 다시 하기 · 추가 보상 없음</button>':''}`;
  }
  function showResult(){
    const won=game.state==='won';resultNotBefore=performance.now()+650;
    modalView(resultPanel(won));
    const button=modal.querySelector('.result-primary');setTimeout(()=>{if(!destroyed&&button.isConnected)button.disabled=false;},650);
  }
  function pause(){
    if(counting){counting=false;$('.countdown').hidden=true;showReady();return;}
    if(game.state!=='playing')return;game.pause();sound.stopMusic();$('.mole-app').dataset.view='paused';
    modalView(`<div class="plain-modal pause-card">${art('pause','pause-art')}<h2 id="modal-title">일시정지</h2><p>잠깐 쉬어가요.<br>두더지와 시간은 기다려 줄게요.</p><button class="primary" data-action="resume">${art('play','button-icon')} 계속하기</button></div>`);
  }
  function updateHud(){
    $('[data-time]').textContent=Math.ceil(game.remaining);$('[data-score]').textContent=game.score;$('[data-target]').textContent=game.config.target;
    const fraction=game.remaining/game.config.duration;$('.progress-fill').style.width=`${100*fraction}%`;$('.progress-head').style.left=`${100*fraction}%`;$('.progress-head').hidden=fraction<=0;
    $('.progress-track').classList.toggle('warning',game.remaining<=10);
  }
  function drawSprite(frame,x,y,opacity=1){
    if(!images.mole)return;ctx.save();ctx.translate(x,y);ctx.scale(CHARACTER_SCALE,CHARACTER_SCALE);ctx.translate(-x,-y);ctx.globalAlpha=opacity;
    // Keep the entire face and both paws. No geometric silhouette mask:
    // independently joined ellipses used to cut diagonally through the art.
    const left=76,top=frame===0?145:frame===5?120:frame>=3?74:101,width=105;
    const bottom=frame>=3?168:187,height=bottom-top,offset=187-bottom,scale=290/256;
    ctx.drawImage(images.mole,(frame%3)*256+left,Math.floor(frame/3)*256+top,width,height,x-145+left*scale,y-213+(top+offset)*scale,width*scale,height*scale);ctx.restore();
  }
  function drawBurrow(target,p,foreground=false){
    if(!images.hole)return;
    target.save();target.translate(p.x,p.y);target.scale(CHARACTER_SCALE,CHARACTER_SCALE);target.translate(-p.x,-p.y);
    if(foreground){
      // Fixed front lip occludes the character, including during retreat.
      const top=125,scale=165/images.hole.height;
      target.drawImage(images.hole,0,top,images.hole.width,images.hole.height-top,p.x-110,p.y-112+top*scale,220,(images.hole.height-top)*scale);
    }else target.drawImage(images.hole,p.x-110,p.y-112,220,165);
    target.restore();
  }
  function paintBurrows(){
    const base=burrowLayer.getContext('2d'),front=frontLayer.getContext('2d');
    base.clearRect(0,0,720,810);front.clearRect(0,0,720,810);
    for(const p of positions){
      base.fillStyle='rgba(78,38,7,.16)';base.beginPath();base.ellipse(p.x,p.y+17,103,27,0,0,Math.PI*2);base.fill();
      drawBurrow(base,p);drawBurrow(front,p,true);
    }
  }
  function render(dt){
    ctx.clearRect(0,0,720,810);fx.clearRect(-FX_MARGIN,-FX_MARGIN,720+FX_MARGIN*2,810+FX_MARGIN*2);
    for(let i=0;i<9;i++){
      const p=positions[i],m=game.holes[i];
      if(!m)continue;
      const age=game.elapsed-m.born;
      let frame=m.phase==='hiding'?5:m.phase==='caught'?4:age<220?0:m.hits===2?3:m.hits===1?2:1;
      const alpha=m.phase==='hiding'?Math.max(0,1-(game.elapsed-m.hideAt)/260):1;
      drawSprite(frame,p.x,p.y,alpha);

    }
    effects=effects.filter(e=>e.life<(e.kind==='success'?1000:350));
    for(const e of effects){e.life+=dt;if(e.kind==='success'&&!e.sounded&&e.life>=150){e.sounded=true;sound.play('mole-caught',.65);}const p=positions[e.hole];const index=e.kind==='dust'?6:e.kind==='success'?3+Math.min(2,Math.floor(e.life/180)):Math.min(2,Math.floor(e.life/100));const opacity=Math.max(0,1-e.life/(e.kind==='success'?1000:350));if(e.kind==='success')drawCatchBurst(p,e.life);drawEffect(index,p.x,p.y-(e.kind==='dust'?20:75),e.kind==='success'?350:190,opacity);if(e.kind!=='dust'&&!reduced){fx.save();fx.globalAlpha=opacity*.8;fx.strokeStyle=e.kind==='success'?'#ffdd52':'#fff8d8';fx.lineWidth=e.kind==='success'?7:4;fx.beginPath();fx.ellipse(p.x,p.y-70,20+e.life*.19,10+e.life*.09,0,0,Math.PI*2);fx.stroke();fx.restore();}}
    sparks=sparks.filter(s=>s.life<s.total);for(const s of sparks){s.life+=dt;s.x+=s.vx*dt/1000;s.y+=s.vy*dt/1000;s.vy+=400*dt/1000;if(s.kind==='confetti'){fx.save();fx.globalAlpha=Math.max(0,1-s.life/s.total);fx.translate(s.x,s.y);fx.rotate(s.angle+s.life*.006);fx.fillStyle=s.color;fx.fillRect(-6,-3,12,6);fx.restore();}else drawEffect(3,s.x,s.y,36+10*Math.sin(s.life*.014),Math.max(0,1-s.life/s.total));}
    strikes=strikes.filter(s=>s.life<HAMMER_DURATION);for(const s of strikes){
      const pose=hammerPoseAt(s.life,s.variant,reduced);if(!images.hammer||!pose)continue;
      const pivot=HAMMER_PIVOTS[pose.frame],scale=HAMMER_SCALE;
      fx.save();fx.globalAlpha=pose.opacity;
      // Keep the grip fixed while changing the actual 3D sprite pose. At the
      // vertical impact frame the lower striking cap lands on the tap target.
      fx.drawImage(images.hammer,(pose.frame%3)*256,Math.floor(pose.frame/3)*256,256,256,s.x+(92-pivot.x)*scale,s.y+(-29-pivot.y)*scale,256*scale,256*scale);fx.restore();
    }
    floats=floats.filter(f=>f.life<850);for(const f of floats){f.life+=dt;fx.save();fx.globalAlpha=Math.max(0,1-f.life/850);fx.font=`800 ${f.number?104:Math.round(76*(1+.16*Math.sin(Math.min(1,f.life/240)*Math.PI)))}px "Mole Paperlogy ExtraBold", sans-serif`;fx.textAlign='center';const inset=fx.measureText(f.text).width/2+18,textX=Math.max(inset,Math.min(720-inset,f.x));fx.lineWidth=10;fx.strokeStyle='#7c3516';fx.shadowColor='#ffca3c';fx.shadowBlur=14;fx.strokeText(f.text,textX,f.y-f.life*.07);fx.fillStyle=f.number?(f.text==='3'?'#ffdf3e':'#ffffff'):'#fff4a6';fx.fillText(f.text,textX,f.y-f.life*.07);fx.restore();}
  }
  function drawCatchBurst(p,age){
    if(reduced)return;
    const t=Math.min(1,age/650),x=p.x,y=p.y-75;fx.save();
    if(age<360){const r=100+age*.24,g=fx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#fffde5e0');g.addColorStop(.35,'#ffda6e88');g.addColorStop(1,'#ffc84100');fx.globalAlpha=(1-age/360)*.85;fx.fillStyle=g;fx.beginPath();fx.arc(x,y,r,0,Math.PI*2);fx.fill();}
    fx.globalAlpha=(1-t)*.85;fx.lineCap='round';
    for(let i=0;i<12;i++){const a=i*Math.PI/6+age*.0005,inner=40+120*t,outer=inner+38*(1-t);fx.strokeStyle=i%2?'#fff5bd':'#ffb93f';fx.lineWidth=i%2?5:8;fx.beginPath();fx.moveTo(x+Math.cos(a)*inner,y+Math.sin(a)*inner);fx.lineTo(x+Math.cos(a)*outer,y+Math.sin(a)*outer);fx.stroke();}
    for(let i=0;i<2;i++){fx.globalAlpha=Math.max(0,1-t-i*.12);fx.strokeStyle=i?'#fff8ce':'#ffc541';fx.lineWidth=i?3:6;fx.beginPath();fx.ellipse(x,y+20,42+150*t+i*20,23+70*t+i*12,0,0,Math.PI*2);fx.stroke();}
    fx.restore();
  }
  function drawEffect(index,x,y,size,opacity=1){if(!images.fx)return;fx.save();fx.globalAlpha=opacity;fx.drawImage(images.fx,(index%3)*192,Math.floor(index/3)*192,192,192,x-size/2,y-size/2,size,size);fx.restore();}
  function strike(hole,x,y){
    if(game.state!=='playing')return;
    const p=positions[hole],target=game.aim(hole);strikes.push({hole,target,x:p?.x??x,y:p?p.y-65*CHARACTER_SCALE:y,life:0,impacted:false,variant:swingSerial++%2});
  }
  listen(canvas,'pointerdown',e=>{
    if(game.state!=='playing')return;e.preventDefault();
    const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*720/rect.width,y=(e.clientY-rect.top)*810/rect.height;
    const distances=positions.map(p=>((x-p.x)/(100*CHARACTER_SCALE))**2+((y-(p.y-65*CHARACTER_SCALE))/(105*CHARACTER_SCALE))**2),closest=Math.min(...distances),index=closest<=1?distances.indexOf(closest):-1;
    strike(index,x,y);
  });
  listen(canvas,'keydown',e=>{const i='qweasdzxc'.indexOf(e.key.toLowerCase());if(i>=0){e.preventDefault();if(!e.repeat)strike(i,positions[i].x,positions[i].y-65);}});
  listen($('.pause-button'),'click',pause);
  listen($('.restart-button'),'click',()=>{sound.play('button-click',.3);newRound();});
  listen($('.sound-btn'),'click',e=>{sound.mute();e.currentTarget.textContent=sound.enabled?'♪':'♫̸';e.currentTarget.setAttribute('aria-pressed',String(sound.enabled));e.currentTarget.setAttribute('aria-label',sound.enabled?'소리 끄기':'소리 켜기');});
  listen($('.vibration-btn'),'click',e=>{vibration=!vibration;e.currentTarget.classList.toggle('off',!vibration);e.currentTarget.setAttribute('aria-pressed',String(vibration));e.currentTarget.setAttribute('aria-label',vibration?'진동 끄기':'진동 켜기');if(vibration)vibrate(20);});
  $('.sound-btn').setAttribute('aria-pressed',String(sound.enabled));$('.sound-btn').setAttribute('aria-label',sound.enabled?'소리 끄기':'소리 켜기');
  listen(modal,'click',async e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
    if(action!=='start')sound.play('button-click',.3);
    if(action==='start')start();
    if(action==='resume'){await sound.unlock();hideModal();game.resume();sound.startMusic();}
    if(action==='retry'||action==='demo-again'){newRound();}
    if(action==='reward-retry')settleReward();
    if(action==='continue'){
      if(performance.now()<resultNotBefore)return;
      if(result?.success&&!settled)return;
      const final={stage,success:!!result?.success,score:game.score,coins:result?.success?REWARD:0,transactionId:gate.transactionId};
      if(preview){modalView(`<h2 id="modal-title">미리보기 완료</h2><p>본게임 연결 시 ${stage+1}단계로 돌아갑니다.<br>성공 보상은 이 판에 한 번만 지급돼요.</p><button class="primary" data-action="demo-again">같은 단계 연습하기</button>`);}
      else {onExit(final);api.destroy();}
    }
  });
  if(preview){$('select').value=String(stage);listen($('select'),'change',e=>{if(game.state==='playing'||game.state==='paused'||counting){e.target.value=String(stage);return;}newRound(e.target.value);});}
  listen(document,'visibilitychange',()=>{if(document.hidden){sound.stopIntro();pause();}});
  function resize(){
    $('.gauge-texture').style.width=`${$('.progress-well').clientWidth}px`;
    const viewport=$('.board-viewport'),scale=Math.max(.1,Math.min(viewport.clientWidth/720,viewport.clientHeight/810));
    $('.playfield').style.width=`${720*scale}px`;$('.playfield').style.height=`${810*scale}px`;
    const dpr=Math.min(devicePixelRatio||1,2);for(const layer of [canvas,burrowLayer,frontLayer]){layer.width=Math.round(720*dpr);layer.height=Math.round(810*dpr);layer.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}
    fxLayer.width=Math.round((720+FX_MARGIN*2)*dpr);fxLayer.height=Math.round((810+FX_MARGIN*2)*dpr);
    Object.assign(fxLayer.style,{width:`${(720+FX_MARGIN*2)*scale}px`,height:`${(810+FX_MARGIN*2)*scale}px`,left:`${-FX_MARGIN*scale}px`,top:`${-FX_MARGIN*scale}px`});
    fx.setTransform(dpr,0,0,dpr,FX_MARGIN*dpr,FX_MARGIN*dpr);paintBurrows();
  }
  resize();listen(window,'resize',resize);
  const observer=new ResizeObserver(resize);observer.observe($('.board-viewport'));
  function frame(now){if(destroyed)return;let dt=Math.min(Math.max(now-clock,0),80);clock=now;
    if(counting){countdown-=dt/1000;showCountdown(countdown>.7?String(Math.ceil(countdown)):'시작!');if(countdown<=0){counting=false;$('.countdown').hidden=true;game.start();sound.startMusic();canvas.focus({preventScroll:true});}}
    game.tick(dt);
    if(game.state!=='paused')for(const s of strikes){s.life+=dt;if(!s.impacted&&s.life>=HAMMER_IMPACT){s.impacted=true;if(s.target!==null)game.hit(s.hole,s.target);}}
    if(pendingFinish){pendingFinish.left-=dt;if(pendingFinish.left<=0){const e=pendingFinish.event;pendingFinish=null;sound.play(e.success?'minigame-success':'minigame-fail',.7);if(e.success){message('성공! 보상을 저장합니다.');settleReward();}else{message('시간 종료');showResult();}}}
    const frozen=hitstop>0;hitstop=Math.max(0,hitstop-dt);
    updateHud();render(game.state==='paused'||frozen?0:dt);raf=requestAnimationFrame(frame);
  }
  const api={get engine(){return game;},pause,destroy(){if(destroyed)return;destroyed=true;settlement++;game.stop();cancelAnimationFrame(raf);observer.disconnect();abort.abort();sound.destroy();root.innerHTML='';}};
  newRound();sound.playIntro();assetPromise.then(()=>{if(!destroyed){paintBurrows();render(0);}}).catch(()=>{});raf=requestAnimationFrame(frame);
  return api;
}
