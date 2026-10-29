import {mini} from './mini-game.js';
import {FishingEconomy,BAIT_PRICES,salePrice} from './economy.js';
import {DailyItems,ITEM_DEFINITIONS} from './daily-items.js';
import {ItemFishingGame,ItemCastController} from './item-fishing.js';
import {syncLeftTools} from './left-tools-visibility.js';
import {SpeciesSequenceTest,SPECIES_SEQUENCE_KEY,sequenceEnabled} from './species-sequence.js';
import {fightProfile} from './species-fight.js';
import {GuidedTutorial,TUTORIAL_KEY} from './guided-tutorial.js';
import {EQUIPMENT,BAITS} from './game-model.js';
import {FishingEnvironment} from './environment.js';
import {createReservoirRenderer} from './reservoir-renderer.js';
import {mountIcons} from './icons.js';
import {mountUIArt} from './ui-art.js';
import {createSound} from './sound.js';
import {createUnderwaterScene} from './underwater-scene.js';
const $=s=>document.querySelector(s),canvas=$('#canvas'),ctx=canvas.getContext('2d');
// Inspection links keep time/weather fixed and all save changes in this page only.
const requestedPreview=new URLSearchParams(window.location.search).get('preview');
const speciesSequenceMode=false;
const previewMode='day';
const previewSaves=new Map();
const storage=mini.storage;
const SAVE='valley-fishing-catches-v1',SETTINGS='valley-fishing-pole-settings-v3';
const ENVIRONMENT_SAVE='valley-fishing-environment-v37';
let savedEnvironment=null;try{savedEnvironment=JSON.parse(storage.getItem(ENVIRONMENT_SAVE)||'null')}catch{}
const environment=new FishingEnvironment({savedState:savedEnvironment});
if(previewMode){environment.setTime(previewMode==='night'?22:12,0,0);environment.setWeather(previewMode==='rain'?'heavy':'clear',{immediate:true})}
let environmentSavedAt=0;
function saveEnvironment(){try{storage.setItem(ENVIRONMENT_SAVE,JSON.stringify(environment.saveState()))}catch{}}
let lastEnvironmentLabel='';
function paintEnvironment(){
 const e=environment.snapshot(),key=[e.day,e.hour,e.minute,e.weather,e.rainLevel,e.isNight,e.dawnProgress>0&&e.dawnProgress<1].join(':');if(key===lastEnvironmentLabel)return;lastEnvironmentLabel=key;
 const date=new Date(Date.UTC(2026,9,12+e.day));
 const label=`${date.getUTCMonth()+1}월 ${date.getUTCDate()}일 (${['일','월','화','수','목','금','토'][date.getUTCDay()]})`;
 $('.weather b').textContent=label;
 const weather=e.weather==='rain'?({light:'약한 비',medium:'비',heavy:'강한 비'})[e.rainLevel]:e.dawnProgress>0&&e.dawnProgress<1?'새벽':e.isNight?'밤':'맑음';
 $('#clock').textContent=`${e.hour<12?'오전':'오후'} ${e.hour%12||12}:${String(e.minute).padStart(2,'0')} ${weather}`;
 $('.weather .sun').textContent=e.weather==='rain'?'☂':e.dawnProgress>0&&e.dawnProgress<1?'☀':e.isNight?'☾':'☀';
 $('.weather').setAttribute('aria-label',`게임 속 ${$('#clock').textContent}`);
} 
window.addEventListener('pagehide',saveEnvironment);

// V18 tutorial state is independent of legacy fish records and first-crucian rules.
const CONTEXT_HINTS_DONE='valley-fishing-context-hints-complete-v18',OPENING_NOTICE_SEEN='valley-fishing-opening-notice-seen-v18';
let contextHintsComplete=false,openingNoticeSeen=false;
try{contextHintsComplete=storage.getItem(CONTEXT_HINTS_DONE)==='caught'}catch{}
// Retain the historical read for compatibility, but V18 pages no longer display.
try{openingNoticeSeen=storage.getItem(OPENING_NOTICE_SEEN)==='seen'}catch{}
const START_INVITATION_SEEN='valleyFishing.startInvitationSeen.v19';
let startInvitationSeen=false,startInvitationVisible=false;
const hintPresentation={text:'',pages:[],elapsed:0},invitationPresentation={text:'',pages:[],elapsed:0};
const TEXT_PAGE_SECONDS=5,TEXT_LINE_UNITS=7;
try{startInvitationSeen=storage.getItem(START_INVITATION_SEEN)==='1'}catch{}
function acknowledgeStartInvitation(){if(startInvitationSeen)return;startInvitationSeen=true;try{storage.setItem(START_INVITATION_SEEN,'1')}catch{}paintStartInvitation()}
function completeContextHints(){if(contextHintsComplete)return;contextHintsComplete=true;try{storage.setItem(CONTEXT_HINTS_DONE,'caught')}catch{}}
const FIRST_CRUCIAN='valley-fishing-first-crucian-v8';
let firstCrucianCaught=false;
try{firstCrucianCaught=storage.getItem(FIRST_CRUCIAN)==='caught'}catch{}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let soundToggleRequest=0;
const liftInputs=new Map(),hookGestures=new Set(),pressedKeys=new Set();
let castingItem=false;
let time=0,last=0,windowActive=true,modalOpen=false,liftHeld=false,liftValue=0,castPointer=null,aimPointer=null,aimStart=0,aimBase=0,gearTab='rod',toastUntil=0,customHint='',customUntil=0,lastFishingCast=0,commitCount=0,catchCount=0,pendingCatch=null,lossNotice=null,assetReady=false;
const BAIT_ATTACHED='valley-fishing-bait-attached-v13';
let baitAttached=true;try{baitAttached=storage.getItem(BAIT_ATTACHED)==='true'}catch{}
function saveBaitAttached(){try{storage.setItem(BAIT_ATTACHED,String(baitAttached))}catch{toast('미끼 상태를 저장하지 못했어요. 이 화면에서는 유지됩니다.')}}
const ZERO_TENSION_WARNING='게이지가 0으로 내려가지 않도록 하세요.';
const LOSS_PAGES=['실패구간에 2번 진입해 물고기를 놓쳤어요.','물고기를 놓쳤습니다. 다시 미끼를 장착하고 던지세요.'];
const TENSION_WARNING='텐션이 너무 셉니다.\n손을 떼세요.';
const BAIT_STOLEN_MESSAGE='미끼만 먹고 갔습니다. 회수한 뒤 크릴새우를 다시 끼워 주세요.';
const reducedMotion=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const SOUND_PREFERENCE='valley-fishing-sound-v10';
let soundOn=mini.soundEnabled;try{soundOn=storage.getItem(SOUND_PREFERENCE)!=='muted'}catch{}
const sound=createSound({enabled:soundOn,requireGesture:true});
sound.setEnvironment(environment.snapshot());
function paintSound(){const on=sound.enabled;$('#sound').setAttribute('aria-pressed',String(on));$('#sound').setAttribute('aria-label',on?'소리 끄기':'소리 켜기');$('#sound small').textContent=on?'ON':'OFF'}
function unlockFeedback(e){if(e.target?.closest?.('#sound'))return;void sound.unlock(e)}
window.addEventListener('pointerdown',unlockFeedback,true);window.addEventListener('keydown',unlockFeedback,true);window.addEventListener('click',unlockFeedback,true);
paintSound();
const economy=new FishingEconomy(storage);
let fishbook=[];
try{const s=JSON.parse(storage.getItem(SAVE)||'[]');if(Array.isArray(s))fishbook=s.filter(f=>f&&typeof f.name==='string'&&Number.isFinite(f.length)&&Number.isFinite(f.weight)).slice(-100)}catch{}
let fishIdentityReady=true;
try{let changed=false;for(const fish of fishbook){if(!fish.economyId){fish.economyId=crypto.randomUUID();changed=true;}}if(changed){const encoded=JSON.stringify(fishbook);storage.setItem(SAVE,encoded);if(storage.getItem(SAVE)!==encoded)throw Error('어획 식별 저장 실패');}}catch{fishIdentityReady=false;}
const coinDisplay=node('div','','coin-display');coinDisplay.id='coinDisplay';coinDisplay.setAttribute('role','status');$('.weather b').hidden=true;$('#clock').after(coinDisplay);
function coinIcon(){const img=node('img');img.src='assets/ui/coin_star_icon.png';img.width=20;img.height=20;img.alt='';return img;}
const coinValue=node('span');coinDisplay.append(coinIcon(),coinValue);
let coinDelta='',coinDeltaUntil=0;
function paintCoins(){const s=economy.snapshot();coinValue.textContent=s?s.coins+' 코인'+(performance.now()<coinDeltaUntil?' '+coinDelta:''):'저장 확인 필요';}
function economicResult(result){if(!result.ok){toast(result.reason==='funds'?'코인이 부족해요.':result.reason==='empty'?'미끼가 없어요.':result.reason==='sold'?'이미 판매한 물고기예요.':'저장 기록을 확인하지 못했어요. 새로고침 후 확인해 주세요.');return false;}if(result.delta){coinDelta=(result.delta>0?'+':'')+result.delta;coinDeltaUntil=performance.now()+1800;}paintCoins();return true;}
let sequenceSaved=null;try{if(speciesSequenceMode)sequenceSaved=JSON.parse(storage.getItem(SPECIES_SEQUENCE_KEY)||'null')}catch{}
const speciesSequence=speciesSequenceMode?new SpeciesSequenceTest({saved:sequenceSaved,save:value=>{try{storage.setItem(SPECIES_SEQUENCE_KEY,JSON.stringify(value))}catch{toast('어종 비교 진행을 저장하지 못했어요. 현재 화면에서는 계속할 수 있어요.')}}}):null;
let tutorialSaved={};try{tutorialSaved=JSON.parse(storage.getItem(TUTORIAL_KEY)||'{}')}catch{}
const initialScene=environment.snapshot();
const tutorial=new GuidedTutorial({eligible:false&&!speciesSequenceMode&&!initialScene.isNight&&initialScene.weather!=='rain'&&!contextHintsComplete&&fishbook.length===0,saved:tutorialSaved,save:value=>{try{storage.setItem(TUTORIAL_KEY,JSON.stringify(value))}catch{}}});
if(tutorial.active&&storage.getItem(BAIT_ATTACHED)===null){baitAttached=false;saveBaitAttached();}
function tutorialEvent(e){const was=tutorial.active;tutorial.event(e);if(was&&!tutorial.active)acknowledgeStartInvitation();}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');toastUntil=time+2.7}
function say(message,seconds=3){customHint=message;customUntil=time+seconds}
function saveFirstCrucian(){try{storage.setItem(FIRST_CRUCIAN,'caught')}catch{toast('첫 붕어 완료 상태를 저장하지 못했어요. 새로고침하면 다시 만날 수 있어요.')}}
const dailyItems=new DailyItems({storage}),dailyAttemptPrefix=crypto.randomUUID();
const game=new ItemFishingGame({dailyItems,onEvent:e=>{speciesSequence?.event(e);tutorialEvent(e);handleFishingVisualEvent(e);if(e.type==='tensionFailure')say(`힘겨루기 실패 ${e.failures}/2. ${e.terminal?'물고기를 놓쳤어요. 회수한 뒤 다시 던져 주세요.':'안전구간으로 돌아오세요. 다시 실패구간에 진입하면 물고기를 놓쳐요.'}`,6);if(e.type==='bite'){sound.cue('bite');say('찌가 잠겼어요! 릴감기를 눌러 챔질해 주세요.',3);if(game.state.fish?.kind!=='item')sound.vibration('bite')}if(e.type==='catch'&&e.fish?.kind==='item'){pendingCatch={fish:{...e.fish},catchId:e.catchId};say(e.dailyClaimed?e.fish.name+(e.fish.id==='boot'?'를':'을')+' 낚아 올렸어요.':'일일 획득 기록을 확인하지 못했어요.',6);stopLift();return;}if(e.type==='catch'){completeContextHints();const caughtFish={...e.fish,economyId:crypto.randomUUID()};mini.caught(caughtFish);fishbook.push(caughtFish);fishbook=fishbook.slice(-100);catchCount++;const firstCrucianCatch=!firstCrucianCaught&&e.fish.id==='crucian';if(firstCrucianCatch)firstCrucianCaught=true;try{storage.setItem(SAVE,JSON.stringify(fishbook));if(firstCrucianCatch)saveFirstCrucian()}catch{toast('저장 공간이 부족해 이번 기록은 현재 화면에만 보관돼요.')}pendingCatch={fish:caughtFish,catchId:e.catchId??e.fish.catchId};say(`${caughtFish.name} · ${caughtFish.length.toFixed(1)} cm! 잠시 감상해 주세요.`,7);stopLift()}if(e.type==='escape'){pendingCatch=null;sound.stopReward?.();if(e.reason!=='missed-bite'){const changed=baitAttached;baitAttached=false;if(changed)saveBaitAttached()}if(e.reason==='bait-stolen'){lossNotice=null;say(BAIT_STOLEN_MESSAGE,8)}else if(e.reason==='missed-bite'){say('입질을 놓쳤어요. 회수한 뒤 다시 던져 주세요.',5)}else{lossNotice={start:time,reason:e.reason,failures:game.state.tensionCrossings};say(e.reason==='zero-tension'?ZERO_TENSION_WARNING:LOSS_PAGES[0],3.5)}stopLift()}}});
const cast=new ItemCastController({onEvent:e=>{tutorialEvent(e);handleWorldVisualEvent(e);if(e.type==='preparing'){sound.cue('back')}if(e.type==='castFailed'){say('눈금에 맞춰서 던지세요',8)}if(e.type==='commit'){commitCount++;sound.cue('swish');if(!castingItem)sound.vibration('cast')}if(e.type==='flight'){sound.cue('spring');sound.cue('flight')}if(e.type==='splash'){sound.cue('splash');if(!castingItem)sound.vibration('impact')}if(e.type==='waiting'){const id=e.castId??commitCount;if(lastFishingCast!==id){lastFishingCast=id;game.cast({dailyAttemptId:dailyAttemptPrefix+':'+id,excludeDailyItems:true,availableItems:Object.keys(ITEM_DEFINITIONS).filter(id=>images[id+'Item']?.complete),baitAttached,environment:environment.snapshot(),tutorialOutcome:tutorial.outcome(),...(speciesSequence?.castOptions()||{}),speciesId:mini.nextSpecies})}sound.cue('ripple')}if(e.type==='retrieveStart'){sound.stopResistance?.();sound.stopFightFeedback();sound.cue('lift')}if(e.type==='liftOut'){sound.cue('droplets');if(!castingItem)sound.vibration('retrieve')}if(e.type==='retrieved'){castingItem=false;game.reset();baitAttached=false;saveBaitAttached();lossNotice=null;say('왼쪽 아래 크릴새우 끼우기를 눌러 주세요.',3)}if(e.type==='cancelled'){say(e.reason==='early-release'?'조금 더 길게 눌러 준비한 뒤 놓아 주세요.':'투척 준비를 취소했어요.',2)}}});
try{const saved=JSON.parse(storage.getItem(SETTINGS)||'null');if(saved){for(const k of ['rod','line','float'])if(Number.isInteger(saved[k]))game.equip(k,saved[k]);if(Number.isInteger(saved.bait))game.selectBait(saved.bait)}}catch{}
if(tutorial.active&&tutorial.progress.aim&&baitAttached&&game.state.bait.id==='worm')tutorial.prepareCast(tutorial.progress.theft?'recast':'cast');
const images={};let renderer=createReservoirRenderer(images);
function loadAsset(name,path){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{images[name]=img;resolve(img)};img.onerror=()=>reject(new Error(path));img.src=path})}
Promise.all([loadAsset('uiAtlas','assets/seaside-compatible-v2/fishing-ui-atlas-sea.webp'),loadAsset('controlsAtlas','assets/fishing-controls-v12.webp')]).then(()=>mountUIArt(document)).catch(()=>{});
for(const item of Object.values(ITEM_DEFINITIONS))loadAsset(item.id+'Item',item.image).catch(()=>{});
loadAsset('fishAtlas','assets/fish-atlas.webp').catch(()=>{});
const breamAssets=loadAsset('crucianAtlas','assets/seaside-compatible-v2/black-sea-bream-atlas.webp');
loadAsset('splashAtlas','assets/water-splash-atlas.webp').catch(()=>{});
const speciesAssets=Promise.all([breamAssets,...['striped-beakfish','sea-bass'].map(id=>loadAsset(`${id}Fish`,`assets/coastal-fish-v1/${id}.webp`))]);
Promise.all([speciesAssets,loadAsset('scene','assets/seaside-background-v1/seaside-background-1080x1920.webp'),loadAsset('seaBirds','assets/seaside-background-v1/seagull-flight-atlas.webp'),loadAsset('nightScene','assets/weather-v37/night-soft-reflection-v55.webp'),loadAsset('rainScene','assets/weather-v37/rain.webp'),loadAsset('reeds','assets/reservoir-reeds.webp'),loadAsset('shoreGrass','assets/shore-grass-clumps-v12.webp'),loadAsset('waterTexture','assets/reservoir-water-highlights-v12.webp'),loadAsset('shoreRocks','assets/shore-rock-clusters-v12.webp')]).then(()=>{renderer=createReservoirRenderer(images);assetReady=true;$('#loading').hidden=true;mini.ready();paintStartInvitation()}).catch(()=>{$('#loading p').textContent='낚시터 이미지를 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.'});
mountIcons();
function settingsSave(){try{storage.setItem(SETTINGS,JSON.stringify({...game.state.equipmentIndices,bait:game.state.baitIndex}))}catch{toast('채비 선택은 이 화면에서만 유지돼요.')}}
function idle(){return cast.state.phase==='ready'}
function syncLift(){liftHeld=liftInputs.size>0;game.setReeling(liftHeld&&game.state.phase==='fighting');$('#cast').classList.toggle('held',liftHeld&&game.state.phase==='fighting')}
function stopLift(){liftInputs.clear();hookGestures.clear();pressedKeys.clear();syncLift()}
function releaseLift(source){liftInputs.delete(source);hookGestures.delete(source);syncLift()}
function beginLift(source,control){if(modalOpen||!windowActive||document.hidden||cast.state.phase!=='waiting')return;if(control==='hook'&&(game.state.phase!=='fighting'||hookGestures.size))return;liftInputs.set(source,control);syncLift()}
function primaryRole(){const phase=cast.state.phase,g=game.state.phase;if(phase==='failed'||phase==='retrieving'||phase==='waiting'&&['caught','escaped'].includes(g))return 'retrieve';if(phase==='waiting'&&g==='fighting')return 'lift';if(['swing','flight','settling','waiting'].includes(phase))return 'hook';return 'cast'}
function paintHookRole(){paintWormButton();const role=primaryRole(),button=$('#cast');button.dataset.role=role;$('#castText').textContent=({cast:'던지기',retrieve:'회수',hook:'릴감기',lift:'릴감기'})[role];button.classList.toggle('lift-mode',role==='lift');button.classList.toggle('retrieve',role==='retrieve');button.setAttribute('aria-pressed',String(role==='lift'&&liftHeld));button.classList.toggle('held',role==='lift'&&liftHeld);button.setAttribute('aria-label',role==='lift'?'릴감기 · 누르고 놓으며 텐션을 조절하세요':role==='hook'?'릴감기 · 눌러서 챔질하세요':role==='retrieve'?'회수':'던지기 · 길게 누른 뒤 성공포인트 구간에 놓으세요')}
function activateHook(source){if(performance.now()<guideDismissUntil||modalOpen||!windowActive||document.hidden||cast.state.phase!=='waiting')return;if(game.state.phase==='bite'){const attempt=dailyAttemptPrefix+':'+lastFishingCast;hookGestures.add(source);game.hook();game.setReeling(false);say('걸렸어요! 들어올리기를 누르고 놓아 조절해요.',4);paintHookRole()}else if(game.state.phase==='fighting')beginLift(source,'hook')}

function abortPreparation(reason='cancelled'){castPointer=null;cast.cancel(reason);stopLift()}
const reelAura=document.createElement('div');reelAura.id='reel-aura';reelAura.setAttribute('aria-hidden','true');$('#cast').before(reelAura);
const wormButton=document.createElement('button');wormButton.id='worm-equip';wormButton.type='button';wormButton.setAttribute('aria-label','크릴새우 끼우기');$('#game').append(wormButton);
wormButton.addEventListener('click',()=>{if(mini.introOpen||mini.finishing||modalOpen||!idle()||baitAttached)return;const index=BAITS.findIndex(b=>b.id==='worm');if(!economy.state||economy.error||!(economy.state.baits.worm>0)){say('크릴새우 보유 상태를 확인해 주세요.',3);return;}if(!tutorial.bait('worm')||!game.selectBait(index))return;baitAttached=true;lossNotice=null;saveBaitAttached();settingsSave();sound.cue('krillEquip');playKrillEquipEffect();showWormEquipped();paintWormButton();});
wormButton.innerHTML='<span class="krill-sparkles" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i></span>';let krillEffectTimer=null;function playKrillEquipEffect(){clearTimeout(krillEffectTimer);wormButton.classList.remove('equipped-burst');void wormButton.offsetWidth;wormButton.classList.add('equipped-burst');krillEffectTimer=setTimeout(()=>wormButton.classList.remove('equipped-burst'),950);}
let wormNoticeTimer=null;
function showWormEquipped(){let n=$('#worm-equipped-notice');if(!n){n=document.createElement('div');n.id='worm-equipped-notice';n.setAttribute('role','status');n.setAttribute('aria-live','polite');$('#game').append(n);}clearTimeout(wormNoticeTimer);n.textContent='크릴새우 장착완료';n.hidden=false;n.classList.remove('show');void n.offsetWidth;n.classList.add('show');wormNoticeTimer=setTimeout(()=>{n.hidden=true;n.classList.remove('show');},1800);}
function paintWormButton(){const b=$('#worm-equip');if(!b)return;b.disabled=mini.finishing||!idle()||baitAttached;b.setAttribute('aria-pressed',String(baitAttached));b.setAttribute('aria-label',baitAttached?'크릴새우 장착 완료':'크릴새우 끼우기');}
function beginCast(e){if(mini.introOpen||mini.finishing)return;if(!economy.state||economy.error||!(economy.state.baits[game.state.bait.id]>0)){say('보유 미끼와 저장 상태를 확인해 주세요.',4);return;}if(!baitAttached){say('왼쪽 아래 크릴새우 끼우기를 눌러 주세요.',4);return;}if(!tutorial.canCast)return;if(performance.now()<guideDismissUntil||modalOpen||!idle()||castPointer!==null)return;if(!baitAttached){say('미끼를 다시 장착한 뒤 던져 주세요.',4);return}castingItem=!!dailyItems.peek({excluded:tutorial.active||speciesSequenceMode,available:Object.keys(ITEM_DEFINITIONS).filter(id=>images[id+'Item']?.complete)});game.reset();pendingCatch=null;lossNotice=null;customUntil=0;sound.stopReward?.();castPointer=e?.pointerId??'keyboard';cast.begin({aim:cast.state.aim});tutorial.preparing();paintStartInvitation();if(e){e.preventDefault();try{$('#cast').setPointerCapture(e.pointerId)}catch{}}}
function releaseCast(id){if(castPointer===null||id!==undefined&&id!==castPointer)return;castPointer=null;cast.release()}
function retrieve(){if(performance.now()<guideDismissUntil||modalOpen||pendingCatch&&game.state.phase==='caught'||!['waiting','failed'].includes(cast.state.phase))return;stopLift();cast.retrieve();game.reset();say('대를 들어 고정 길이 채비를 회수하고 있어요.',2)}
function onCastDown(e){if(e.button!==undefined&&e.button!==0||e.detail>1||modalOpen||!windowActive||document.hidden)return;e.preventDefault();const source=`pointer:${e.pointerId}`;if(hookGestures.size||liftInputs.size||castPointer!==null)return;const role=primaryRole();if(role==='retrieve'){retrieve();return}if(role==='hook'||role==='lift'){activateHook(source);try{$('#cast').setPointerCapture(e.pointerId)}catch{}return}beginCast(e)}
$('#cast').addEventListener('pointerdown',onCastDown);
$('#cast').addEventListener('pointerup',e=>{releaseCast(e.pointerId);releaseLift(`pointer:${e.pointerId}`)});
$('#cast').addEventListener('pointercancel',e=>{if(castPointer===e.pointerId)abortPreparation('pointercancel');releaseLift(`pointer:${e.pointerId}`)});
$('#cast').addEventListener('lostpointercapture',e=>{if(castPointer===e.pointerId)abortPreparation('lostcapture');releaseLift(`pointer:${e.pointerId}`)});
$('#cast').addEventListener('click',e=>{if(e.detail!==0||modalOpen||!windowActive||document.hidden)return;const role=primaryRole();if(role==='retrieve')retrieve();else if(role==='hook'&&game.state.phase==='bite'){activateHook('activation');hookGestures.delete('activation')}});
window.addEventListener('pointerup',e=>{releaseCast(e.pointerId);releaseLift(`pointer:${e.pointerId}`);if(aimPointer===e.pointerId)aimPointer=null});
window.addEventListener('pointercancel',e=>{if(castPointer===e.pointerId)abortPreparation('pointercancel');releaseLift(`pointer:${e.pointerId}`);if(aimPointer===e.pointerId)aimPointer=null});
canvas.addEventListener('pointerdown',e=>{if(performance.now()<guideDismissUntil||modalOpen||!idle()||castPointer!==null)return;aimPointer=e.pointerId;aimStart=e.clientX;aimBase=cast.state.aim;try{canvas.setPointerCapture(e.pointerId)}catch{}});
canvas.addEventListener('pointermove',e=>{if(aimPointer!==e.pointerId||modalOpen||!idle())return;const width=canvas.getBoundingClientRect().width||540;const before=cast.state.aim;cast.setAim(clamp(aimBase+(e.clientX-aimStart)/width*2.4,-1,1));tutorial.aim(cast.state.aim-before)});
canvas.addEventListener('pointerup',()=>{aimPointer=null});canvas.addEventListener('pointercancel',()=>{aimPointer=null});
window.addEventListener('blur',()=>{windowActive=false;abortPreparation('blur');aimPointer=null;sound.pause();updateEffectUI()});
window.addEventListener('focus',()=>{windowActive=true;last=0;if(!document.hidden){if(underwaterOpen)sound.resumeUnderwater();else if(!modalOpen)sound.resume();}updateEffectUI()});
document.addEventListener('visibilitychange',()=>{abortPreparation('visibility');aimPointer=null;last=0;if(document.hidden)sound.pause();else if(windowActive){if(underwaterOpen)sound.resumeUnderwater();else if(!modalOpen)sound.resume();}updateEffectUI()});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(modalOpen)closeModal();else abortPreparation('escape');return}if(performance.now()<guideDismissUntil||modalOpen||!windowActive||document.hidden)return;const active=e.target?.closest?.('button,input,select,textarea,a');if(active&&active.id!=='cast')return;const activation=['Space','Enter','KeyH','ArrowUp'].includes(e.code);if(activation){e.preventDefault();if(e.repeat||pressedKeys.has(e.code))return;pressedKeys.add(e.code);const role=primaryRole();if(role==='cast'){if(e.code==='Space'||e.code==='Enter')beginCast()}else if(role==='retrieve')retrieve();else activateHook(`key:${e.code}`)}if((e.code==='ArrowLeft'||e.code==='ArrowRight')&&idle()){e.preventDefault();const before=cast.state.aim;cast.setAim(clamp(cast.state.aim+(e.code==='ArrowLeft'?-.08:.08),-1,1));tutorial.aim(cast.state.aim-before)}});
window.addEventListener('keyup',e=>{if(['Space','Enter','ArrowUp','KeyH'].includes(e.code)){if(e.code==='Space'||e.code==='Enter')releaseCast('keyboard');pressedKeys.delete(e.code);releaseLift(`key:${e.code}`)}});
$('#sound').onclick=async e=>{const request=++soundToggleRequest;const on=!sound.enabled;const setting=sound.set(on);paintSound();try{storage.setItem(SOUND_PREFERENCE,on?'on':'muted')}catch{}const unlocking=on?sound.unlock(e):Promise.resolve(true);const okay=await setting;const unlocked=await unlocking;if(request!==soundToggleRequest||sound.enabled!==on)return;if(okay===false||unlocked===false&&e.isTrusted)toast('소리를 재생하지 못했어요. 다시 눌러 주세요.')};
function node(tag,value='',className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e}
let focusBefore;
const underwater=createUnderwaterScene({reducedMotion});
let underwaterOpen=false,underwaterAssets=null,underwaterLoadToken=0;
function loadUnderwaterImage(path){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('수중 이미지 로딩 실패'));img.src=path})}
function showUnderwater(){
 if(underwaterOpen)return;
 const body=node('div','','underwater-body');body.dataset.menu='underwater';
 const intro=node('p','관상용 수중 보기 · 낚시 일시정지','underwater-caption');intro.id='inventoryIntro';
 const view=node('canvas');view.id='underwaterCanvas';view.width=640;view.height=640;view.setAttribute('aria-label','수중 관찰창: 물고기들이 왼쪽에서 오른쪽으로 헤엄칩니다.');
 const status=node('p','수중 풍경을 불러오는 중…','underwater-status');status.setAttribute('role','status');body.append(view,status,intro);
 openModal('수중 보기',body);underwaterOpen=true;underwater.open();sound.setUnderwater(true);const token=++underwaterLoadToken;
 $('#modal').classList.add('underwater-modal');$('#game').classList.add('underwater-view-open');$('#underwater').setAttribute('aria-expanded','true');
 if(!underwaterAssets)underwaterAssets=underwater.loadAssets(loadUnderwaterImage).catch(error=>{underwaterAssets=null;throw error});
 underwaterAssets.then(()=>{if(!underwaterOpen||token!==underwaterLoadToken||!body.isConnected)return;status.hidden=true;underwater.render(view.getContext('2d'),640,640)}).catch(()=>{if(underwaterOpen&&token===underwaterLoadToken&&body.isConnected)status.textContent='수중 이미지를 불러오지 못했어요. 닫고 다시 열어 주세요.'});
}
function stopUnderwater(){sound.setUnderwater(false);underwaterOpen=false;underwaterLoadToken++;$('#modal').classList.remove('underwater-modal');$('#game').classList.remove('underwater-view-open');$('#underwater').setAttribute('aria-expanded','false')}

const GUIDE_KEY='valley-fishing-guide-seen-v16';
const FISHING_GUIDE=[
 ['미끼를 장착해요','왼쪽 미끼 버튼을 누르고 사용할 미끼를 장착하세요. 채비를 회수한 뒤에는 매번 미끼를 다시 장착해야 던질 수 있어요.'],
 ['던질 방향을 골라요','수면을 손가락으로 좌우로 밀어 방향을 조절하세요. 원하는 방향을 고른 뒤 아래 던지기 버튼을 사용해요.'],
 ['65–100%에서 놓아요','던지기를 길게 누르면 파워가 올라가요. 게이지 65–100% 눈금 안에서 손을 떼세요. 밖에서 놓으면 실패해요. 회수한 뒤 미끼를 다시 장착하고 도전하세요.'],
 ['예신을 기다려요','착수 후 입질까지 최소 10초 기다려요. 찌가 살짝 톡톡 내려가는 예신에는 기다리세요. 예신만 끝날 수도 있고, 이어서 본신이 올 수도 있어요.'],
 ['본신에 챔질해요','찌가 쏙 잠기고 챔질 버튼이 빛나면 바로 누르세요. 기본 챔질 시간은 2.5초예요. 예신에는 챔질하지 않아요. 입질을 놓치면 회수하고 미끼를 다시 장착하세요.'],
 ['손을 떼고 들어올려요','챔질에 성공하면 같은 버튼이 들어올리기로 바뀌어요. 먼저 손을 뗀 뒤 다시 누르세요. 누르면 끌어올리고, 놓으면 텐션이 완화돼요.'],
 ['텐션을 조절해요','텐션을 보며 누르고 놓으세요. 어종·크기에 따른 성공구간을 유지하세요. 구간을 벗어나면 2초 안에 돌아오세요. 두 번 회복하지 못하면 놓쳐요.'],
 ['낚은 뒤 다시 준비해요','끝까지 끌어올리면 포획에 성공해요. 약 4초 동안 낚은 모습을 감상할 수 있어요. 회수 버튼으로 채비를 거두고, 미끼를 다시 장착해 다음 낚시를 준비하세요.'],
 ['미끼만 사라져도 다시 도전해요','가끔 미끼만 먹고 갈 수 있어요. 안내가 나오면 회수부터 하세요. 회수가 끝난 뒤 미끼 메뉴에서 다시 장착해야 던질 수 있어요. 물고기를 놓쳤을 때도 같은 순서로 준비해요.']
];
const GUIDE_VISUALS=['미끼 메뉴의 장착 버튼','수면을 좌우로 밀어 조준','파워 65–100% 눈금과 던지기 버튼','수면의 찌와 작은 예신','잠긴 찌와 챔질 버튼','챔질 뒤 들어올리기 버튼','어종·크기별 텐션 성공구간','포획한 물고기를 감상하는 화면','미끼 도난 안내와 회수 버튼'];
let guideOpen=false,guideStep=0,guideAdvanceAt=0,guideDismissUntil=0;
function markGuideSeen(){try{storage.setItem(GUIDE_KEY,'seen')}catch{}}
function paintFishingGuide(){
 const body=node('div','','fishing-guide-body');body.dataset.menu='guide';
 const progress=node('p',`${guideStep+1} / ${FISHING_GUIDE.length} · 낚시 일시정지`,'guide-progress');progress.id='inventoryIntro';
 const heading=node('h3',FISHING_GUIDE[guideStep][0]);
 const copy=node('p',FISHING_GUIDE[guideStep][1],'guide-copy');copy.setAttribute('aria-live','polite');
 const scroll=node('div','','guide-scroll');scroll.setAttribute('tabindex','0');scroll.setAttribute('aria-label','낚시 순서 설명');
 const figure=node('figure','','guide-figure'),picture=document.createElement('img');picture.src=`assets/guide-v17/step-${String(guideStep+1).padStart(2,'0')}.webp`;picture.alt=GUIDE_VISUALS[guideStep];picture.width=480;picture.height=270;picture.decoding='async';picture.draggable=false;
 const caption=node('figcaption',GUIDE_VISUALS[guideStep]);picture.onerror=()=>{picture.hidden=true;caption.textContent='그림을 불러오지 못했어요. 아래 설명을 확인하세요.'};figure.append(picture,caption);scroll.append(heading,figure,copy);
 const next=node('button',guideStep===FISHING_GUIDE.length-1?'안내 마치기':'다음','guide-next');next.id='guideNext';
 next.onclick=e=>{e.preventDefault();e.stopPropagation();if(!guideOpen||!windowActive||document.hidden||!body.isConnected||e.detail>1||performance.now()<guideAdvanceAt)return;guideAdvanceAt=performance.now()+350;if(guideStep===FISHING_GUIDE.length-1){closeModal();return}guideStep++;paintFishingGuide();$('#modalBody').querySelector('#guideNext').focus()};
 const scrollHint=node('p','위아래로 밀어 그림과 설명 보기','guide-scroll-hint');body.append(progress,scroll,scrollHint,next);$('#modalBody').replaceChildren(body);$('#modalBody').scrollTop=0;
}
function showFishingGuide(){if(modalOpen)return;acknowledgeStartInvitation();guideOpen=true;guideStep=0;guideAdvanceAt=0;openModal('낚시방법',node('div'));$('#modal').classList.add('fishing-guide-modal');paintFishingGuide();$('#modalBody').querySelector('#guideNext').focus()}
// The top method plaque was removed; first-catch mentor guidance remains automatic.
function openModal(title,body){if(underwaterOpen)stopUnderwater();if(!modalOpen)focusBefore=document.activeElement;abortPreparation('modal');aimPointer=null;modalOpen=true;sound.pause();const modal=$('#modal'),sheet=modal.querySelector('.sheet');modal.classList.add('inventory-modal');modal.dataset.menu=body.dataset.menu||'';sheet.setAttribute('aria-describedby','inventoryIntro');$('#modalTitle').textContent=title;$('#modalBody').replaceChildren(body);$('#modalBody').scrollTop=0;modal.hidden=false;$('#close').setAttribute('aria-label',`${title} 닫기`);$('#close').focus();updateEffectUI()}
function closeModal(){if(guideOpen){guideDismissUntil=performance.now()+350;markGuideSeen();guideOpen=false;$('#modal').classList.remove('fishing-guide-modal')}stopUnderwater();modalOpen=false;if(windowActive&&!document.hidden)sound.resume();$('#modal').hidden=true;last=0;(focusBefore||$('#cast')).focus();updateEffectUI()}
$('#close').onclick=closeModal;$('#modal').onclick=e=>{if(e.target===$('#modal'))closeModal()};
$('#modal').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const a=[...$('#modal').querySelectorAll(guideOpen?'button:not(:disabled),.guide-scroll':'button:not(:disabled)')];if(!a.length)return;const i=a.indexOf(document.activeElement);e.preventDefault();a[(i+(e.shiftKey?-1:1)+a.length)%a.length].focus()});
function gearReady(){if(!idle()){say('채비를 회수한 뒤 바꿀 수 있어요.',4);return false}return true}
const rodNames=['균형 릴낚싯대 4.5 m','유연한 릴낚싯대 4.5 m','카본 릴낚싯대 4.5 m'];
const rodDescriptions=['기본 탄성과 장력 조절의 균형','장력이 조금 더 부드럽게 올라가요','대를 올려 물고기를 제어하기 좋아요'];
function showEquipment(tab=gearTab){
  if(!gearReady())return;
  if(!Object.hasOwn(EQUIPMENT,tab))tab='rod';
  gearTab=tab;
  const box=node('div','','inventory-menu equipment-menu'),intro=node('p','상황에 맞는 채비를 선택하여 장착하세요.','inventory-intro'),tabs=node('div','','tabs inventory-tabs'),layout=node('div','','equipment-layout'),options=node('div','','inventory-options');
  box.dataset.menu='equipment';intro.id='inventoryIntro';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','채비 종류');options.id='equipmentOptions';options.setAttribute('role','tabpanel');options.setAttribute('aria-labelledby',`equipmentTab-${tab}`);
  const categories={rod:'릴낚싯대',line:'고정줄',float:'찌'},keys=Object.keys(categories);
  for(const[k,title]of Object.entries(categories)){
    const b=node('button',title,k===tab?'active':'');b.type='button';b.id=`equipmentTab-${k}`;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(k===tab));b.setAttribute('aria-controls','equipmentOptions');
    b.onclick=()=>{if(!modalOpen||!box.isConnected||!idle())return;showEquipment(k);$('#modalBody').querySelector(`#equipmentTab-${k}`)?.focus()};
    b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)||!modalOpen||!box.isConnected||!idle())return;e.preventDefault();const next=e.key==='Home'?keys[0]:e.key==='End'?keys.at(-1):keys[(keys.indexOf(k)+(e.key==='ArrowRight'?1:-1)+keys.length)%keys.length];showEquipment(next);$('#modalBody').querySelector(`#equipmentTab-${next}`)?.focus()};
    tabs.append(b);
  }
  EQUIPMENT[tab].forEach((item,i)=>{
    const selected=game.state.equipmentIndices[tab]===i,name=tab==='rod'?rodNames[i]:item.name,b=node('button','',`option inventory-option ${selected?'selected':''}`),art=node('span','',`inventory-thumb gear-thumb gear-${tab}`),label=node('span','','inventory-label'),action=node('b',selected?'✓ 장착 중':'장착하기','equip-state');
    b.type='button';b.id=`equipmentOption-${tab}-${i}`;b.dataset.itemId=item.id;b.setAttribute('aria-pressed',String(selected));art.setAttribute('aria-hidden','true');
    label.append(node('strong',name),node('small',tab==='rod'?rodDescriptions[i]:tab==='line'?`${item.description} · 길이 4.2 m 고정`:item.description));b.append(art,label,action);
    b.onclick=()=>{if(!modalOpen||!box.isConnected||!idle()||!game.equip(tab,i))return;settingsSave();showEquipment(tab);$('#modalBody').querySelector(`#equipmentOption-${tab}-${i}`)?.focus()};options.append(b);
  });
  const summary=node('aside','','equipment-summary'),summaryHeading=node('h3','선택한 채비 구성'),summaryArt=node('span','','equipment-summary-art gear-thumb gear-float'),details=node('dl','','equipment-summary-list');summary.setAttribute('aria-label','현재 장착한 채비');summaryArt.setAttribute('aria-hidden','true');
  for(const[k,title]of Object.entries(categories)){const selectedIndex=game.state.equipmentIndices[k],item=EQUIPMENT[k][selectedIndex];details.append(node('dt',title),node('dd',k==='rod'?rodNames[selectedIndex]:item.name))}
  summary.append(summaryHeading,summaryArt,details,node('p','릴낚싯대 4.5 m · 고정줄 4.2 m','equipment-lengths'));layout.append(options,summary);box.append(intro,tabs,layout,node('p','고정줄은 길어지거나 감기지 않습니다.','info-strip inventory-note'));openModal('채비',box);
}
function showBait(){
 if(!gearReady())return;
 const box=node('div','','inventory-menu bait-menu');box.dataset.menu='bait';
 const intro=node('p','보유 미끼를 장착하거나 10개 묶음으로 구매하세요.','inventory-intro');intro.id='inventoryIntro';box.append(intro);
 const balance=node('p','','bait-balance'),options=node('div','','inventory-options');box.append(balance,options);
 function draw(){const s=economy.snapshot();balance.replaceChildren(coinIcon(),node('span',s?'보유 '+s.coins+' 코인':'저장 기록 확인 필요'));options.replaceChildren();
 for(const bait of [...BAITS].sort((a,b)=>['worm','dough','fly','minnow'].indexOf(a.id)-['worm','dough','fly','minnow'].indexOf(b.id))){const i=BAITS.indexOf(bait),qty=s?.baits[bait.id]||0,row=node('section','','bait-economy-row'),select=node('button','','option inventory-option'),art=node('span',bait.id==='dough'?'●':'',`inventory-thumb bait-thumb bait-${bait.id}`),label=node('span','','inventory-label');select.type='button';select.dataset.itemId=bait.id;select.disabled=!s||!!economy.error||qty<1;label.append(node('strong',bait.name+' · '+qty+'개'),node('small',bait.description));select.append(art,label,node('b',game.state.baitIndex===i&&baitAttached?'✓ 장착 중':'장착하기'));
 select.onclick=()=>{if(!modalOpen||!box.isConnected||!idle()||!economy.state?.baits[bait.id]||!tutorial.bait(bait.id)||!game.selectBait(i))return;baitAttached=true;lossNotice=null;saveBaitAttached();settingsSave();closeModal();say(bait.name+'를 달았어요. 길게 눌러 던질 준비를 하세요.',3);};
 const buy=node('button',bait.name+' 10개 · '+BAIT_PRICES[bait.id]+'코인 구매','bait-buy');buy.type='button';buy.dataset.buyBait=bait.id;buy.disabled=!s||!!economy.error||s.coins<BAIT_PRICES[bait.id];buy.onclick=()=>{if(!box.isConnected||buy.disabled)return;buy.disabled=true;economicResult(economy.buy(bait.id));draw();};row.append(select,buy);options.append(row);}
 if(economy.canRescue()){const rescue=node('button','무료 크릴새우 5개 받기','bait-rescue');rescue.id='freeWorms';rescue.onclick=()=>{if(!box.isConnected||rescue.disabled)return;rescue.disabled=true;economicResult(economy.rescue());draw();};options.append(rescue);}}
 draw();box.append(node('p','시간과 날씨와 미끼에 따라 나오는 어종이 다릅니다.','info-strip inventory-note'));openModal('미끼',box);
}
function showBag(){
  const box=node('div','','inventory-menu bag-menu'),intro=node('p','낚아 올린 물고기의 기록을 모아 두었어요.','inventory-intro'),count=node('p',`보관 중 ${fishbook.length}마리`,'inventory-count');const items=Object.entries(dailyItems.snapshot().days).flatMap(([day,r])=>Object.values(r.earned).filter(x=>x.day===day));if(items.length){const found=node('section','','found-items');found.append(node('h3','낚아 올린 물건'));for(const value of items){const item=ITEM_DEFINITIONS[value.id];if(!item)continue;const row=node('div','','found-item');const image=node('img');image.src=item.image;image.alt=item.name;row.append(image,node('span',item.name+' · '+value.day));found.append(row)}box.append(found);}box.dataset.menu='bag';intro.id='inventoryIntro';box.append(intro,count);
  if(!fishbook.length){const empty=node('div','','inventory-empty'),art=node('span','','inventory-empty-art');art.setAttribute('aria-hidden','true');empty.append(art,node('strong','아직 어망이 비어 있어요'),node('p','물고기를 낚아 어망에 담아 보세요.'));box.append(empty)}
  else {const records=node('div','','inventory-records');records.setAttribute('role','list');records.setAttribute('aria-label','어획 기록');[...fishbook].reverse().forEach(f=>{
    const row=node('div','','fish-card inventory-record'),name=node('b',f.name,'inventory-label'),portrait=node('span','','inventory-thumb fish-portrait');row.setAttribute('role','listitem');name.append(node('small',f.sizeLabel?`${f.sizeLabel} · ${f.rarityLabel||'어망 기록'}`:f.rarityLabel||'어망 기록'));portrait.setAttribute('aria-hidden','true');
    if(f.art==='large-crucian-v1'||['sogari','carp','catfish','eel','striped-beakfish','sea-bass'].includes(f.id)){const img=document.createElement('img');img.src=f.art==='large-crucian-v1'?'assets/seaside-compatible-v2/black-sea-bream-static.webp':(['striped-beakfish','sea-bass'].includes(f.id)?`assets/coastal-fish-v1/${f.id}.webp`:`assets/fish-v37/${f.id}.webp`);img.alt='';img.loading='lazy';img.decoding='async';img.width=120;img.height=90;img.onerror=()=>{img.remove();portrait.classList.add('record-fallback')};portrait.append(img)}
    else {const fishIds=['pale-chub','rainbow-trout','cherry-salmon','golden-carp'];portrait.classList.add(fishIds.includes(f.id)?`record-${f.id}`:'record-fallback')}
    row.append(portrait,name,node('span',`${f.length.toFixed(1)} cm · ${f.weight.toFixed(2)} kg`,'record-measurements'));const sell=node('button',economy.state?.sold[f.economyId]!==undefined?'판매 완료':salePrice(f)+'코인에 판매','fish-sell');sell.dataset.sellFish=f.economyId||'';sell.disabled=!fishIdentityReady||!economy.state||!!economy.error||economy.state.sold[f.economyId]!==undefined;sell.onclick=()=>{if(!box.isConnected||sell.disabled)return;sell.disabled=true;if(economicResult(economy.sell(f)))sell.textContent='판매 완료';};row.append(sell);records.append(row);
  });box.append(records)}
  box.append(node('p','물고기의 이름, 길이, 무게를 기록합니다. 낚시 중 어망을 열면 잠시 멈춥니다.','info-strip inventory-note'));openModal('어망',box);
}
$('#underwater').onclick=showUnderwater;$('#bag').onclick=showBag;$('#bait').onclick=showBait;$('#equipment').onclick=()=>showEquipment();
const phaseMessages={ready:'방향을 고른 뒤 던지기를 길게 눌러 주세요.',preparing:'대를 뒤로 젖혀요. 준비가 끝날 때까지 눌러 주세요.',charging:'성공포인트 구간에서 놓아 주세요.',failed:'눈금에 맞춰서 던지세요',swing:'대를 휘둘러 채비를 앞으로 보냅니다.',flight:'고정 길이 낚싯줄을 따라 채비가 날아갑니다.',settling:'착수! 찌가 제자리를 잡을 때까지 기다려 주세요.',retrieving:'대를 들어 채비를 회수합니다.'};
// Keep the HUD below live top UI; preserve text metrics when resizing its box.
let fightHudBaseline=null;
function positionFightHud(){const hud=$('#fightHud');if(hud.hidden)return;for(const key of ['left','right','top','bottom','width','height','transform','paddingTop','paddingBottom'])hud.style[key]='';const objective=$('#mini-objective'),root=$('#game');if(objective){const bottom=objective.getBoundingClientRect().bottom-root.getBoundingClientRect().top;hud.style.setProperty('--fight-top',`${Math.ceil(bottom+6)}px`);}hud.dataset.position='below-objective';}

function paintUI(){mini.paint();paintCoins();syncLeftTools($('.left-tools'),cast.state.phase,game.state.phase);paintEnvironment();updateEffectUI();const c=cast.state,g=game.state,role=primaryRole();const charging=['preparing','charging'].includes(c.phase),waiting=c.phase==='waiting';$('#chargePanel').hidden=!(charging||tutorial.showCastGauge);$('#chargeTitle').innerHTML='<mark>성공포인트</mark>에서 놓으세요';$('#chargeNumber').textContent=`${(c.charge||0).toFixed(1)}%`;$('#chargeFill').style.width=`${c.charge||0}%`;$('#chargeNeedle').style.left=`${c.charge||0}%`;$('#cast').classList.toggle('charging',charging);$('#cast').disabled=role==='cast'?(!['ready','preparing','charging'].includes(c.phase)||!baitAttached||!tutorial.canCast):role==='retrieve'?!!pendingCatch||!['failed','waiting'].includes(c.phase):role==='hook'?!(waiting&&g.phase==='bite'):!(waiting&&g.phase==='fighting');$('#castText').textContent={cast:'던지기',retrieve:'회수',hook:'챔질',lift:'들어올리기'}[role];$('#castHelp').textContent=role==='lift'?'누르고 놓아 텐션 조절':role==='hook'?'본신에 눌러 주세요':role==='retrieve'?'채비를 가져옵니다':'성공포인트에서 놓기';paintHookRole();const profile=g.fightProfile||fightProfile(g.fish);$('#fightHud').style.setProperty('--safe-end',profile.upper+'%');$('#tensionLimit').style.left=profile.upper+'%';$('#tensionLimit').title=`성공구간 상한 ${profile.upper}%`;$('.tension-zones span').textContent=`성공 0초과–${profile.upper}%`;$('.tension-zones span+span').textContent=`실패 ${g.tensionCrossings||0}/2`;$('#tensionMeter').setAttribute('aria-valuetext',`${Math.round(g.tension)}%, 성공구간 0초과 ${profile.upper}% 이하, 실패 ${g.tensionCrossings||0}/2`);const gaugePreview=tutorial.showFightPreview&&g.phase!=='fighting'&&g.phase!=='caught';$('#fightHud').hidden=g.phase!=='fighting'&&!tutorial.showFightPreview;positionFightHud();$('#fightPreviewLabel').hidden=true;$('#fightHud').dataset.preview=String(gaugePreview);$('#tensionNumber').textContent=`${Math.round(g.tension)}%`;$('#tensionNeedle').style.left=`${gaugePreview?35:g.tension}%`;$('#tensionMeter').setAttribute('aria-valuenow',gaugePreview?35:Math.round(g.tension));$('.hp-label').firstChild.textContent=g.fish?.kind==='item'?'남은 인양 ':'물고기 체력 ';$('#hpNumber').textContent=`${Math.max(0,100-Math.floor(g.progress))}%`;$('#hpFill').style.width=`${100-g.progress}%`;$('#baitName').textContent=baitAttached?g.bait.name:'미장착';$('#bait').setAttribute('aria-label',baitAttached?`미끼 · ${g.bait.name}`:'미끼 · 다시 장착 필요');$('#bagCount').textContent=`${fishbook.length}마리`;$('#aimLabel').hidden=true;$('#aimLabel').style.opacity=idle()?'1':'0';let message=c.phase==='ready'&&!baitAttached?'미끼를 다시 장착한 뒤 던져 주세요.':phaseMessages[c.phase];if(waiting){message=g.phase==='nibble'?'예신이에요. 찌가 잠길 때까지 기다려 주세요.':g.phase==='bite'?'찌가 잠겼어요! 릴감기를 눌러 주세요.':g.phase==='fighting'?(g.tension>(g.fightProfile||fightProfile(g.fish)).upper?TENSION_WARNING:g.tension<18?'줄이 느슨해요. 릴감기를 눌러 주세요.':'누르고 놓으며 텐션을 조절하세요.'):g.phase==='caught'?(pendingCatch?'낚아 올렸어요! 잠시 감상해 주세요.':'어망에 담았어요. 회수 후 다시 던져요.'):g.phase==='escaped'?(g.escapeReason==='bait-stolen'?BAIT_STOLEN_MESSAGE:'회수한 뒤 다시 던져 주세요.'):'찌를 보며 입질을 기다려 주세요.'}const urgent=g.phase==='fighting'&&g.tension>(g.fightProfile||fightProfile(g.fish)).upper;if(lossNotice&&!baitAttached&&['escaped','ready'].includes(g.phase)&&c.phase!=='retrieving')message=(lossNotice.reason==='zero-tension'?[ZERO_TENSION_WARNING,LOSS_PAGES[1]]:LOSS_PAGES)[Math.floor(Math.max(0,time-lossNotice.start)/3.5)%LOSS_PAGES.length];paintDialogue(urgent?TENSION_WARNING:lossNotice&&!baitAttached&&c.phase!=='retrieving'?message:time<customUntil?customHint:message||phaseMessages.ready);if(time>toastUntil)$('#toast').classList.remove('show')}
// Bottom presentation only: event/state-based visibility never alters rules or inputs.
function canShowStartInvitation(){return false;}
function textUnits(text){return [...text].reduce((n,c)=>n+(/\s/.test(c)?.33:/[\x00-\x7f]/.test(c)?.55:1),0)}
function textPages(text){
 const lines=[];
 for(const paragraph of String(text).split('\n')){
  let line='';
  for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
   if(line&&textUnits(`${line} ${word}`)>TEXT_LINE_UNITS){lines.push(line);line=''}
   if(textUnits(word)>TEXT_LINE_UNITS){
    for(const character of word){if(line&&textUnits(line+character)>TEXT_LINE_UNITS){lines.push(line);line=''}line+=character}
   }else line=line?`${line} ${word}`:word;
  }
  if(line)lines.push(line);
 }
 const pages=[];for(let i=0;i<lines.length;i+=3)pages.push(lines.slice(i,i+3).join('\n'));
 return pages.length?pages:[''];
}
function paintTextPage(target,presentation,text,paragraphs){
 if(presentation.text!==text){presentation.text=text;presentation.pages=paragraphs?paragraphs.flatMap(textPages):textPages(text);presentation.elapsed=0}
 const index=Math.floor(presentation.elapsed/TEXT_PAGE_SECONDS)%presentation.pages.length;
 const page=presentation.pages[index]||'';if(target.textContent!==page){if(target.id==='hintPage'){target.replaceChildren(...page.split(/(입질|챔질|회수|텐션|미끼|들어올리)/g).map((part,i)=>{if(i%2===0)return document.createTextNode(part);const mark=document.createElement('mark');mark.textContent=part;return mark;}));}else target.textContent=page;}
 target.dataset.page=String(index+1);target.dataset.pages=String(presentation.pages.length);
}
function advanceTextPages(dt){
 if(startInvitationVisible)invitationPresentation.elapsed+=dt;
 if(!$('.dialogue').hidden)hintPresentation.elapsed+=dt;
}
function paintStartInvitation(){
 startInvitationVisible=canShowStartInvitation();
 const invitation=$('#startInvitation');invitation.hidden=!startInvitationVisible;
 $('#methodArrow').hidden=!startInvitationVisible;
 if(startInvitationVisible){
  const paragraphs=[...invitation.querySelectorAll('p')];paragraphs.forEach(p=>p.classList.add('invitation-full'));
  let page=invitation.querySelector('.invitation-page');if(!page){page=node('span','','invitation-page');page.setAttribute('aria-hidden','true');invitation.append(page)}
  const messages=paragraphs.map(p=>p.textContent);paintTextPage(page,invitationPresentation,messages.join('\n'),messages);
 }
 if(startInvitationVisible||modalOpen||!windowActive||document.hidden)$('.dialogue').hidden=true;
}
function paintDialogue(message){if(tutorial.active)message=tutorial.message(game.state.phase);paintTutorial();
 const theft=cast.state.phase==='waiting'&&game.state.phase==='escaped'&&game.state.escapeReason==='bait-stolen';
 paintStartInvitation();
 // The historical catch flag remains a save record only; every attempt gets guidance.
 const visible=!tutorial.active&&assetReady&&!modalOpen&&windowActive&&!document.hidden&&!startInvitationVisible;
 const dialogue=$('.dialogue');dialogue.hidden=!visible;
 dialogue.dataset.notice=visible?(theft?'bait-stolen':'context'):'';
 const full=tutorial.active?message:theft?BAIT_STOLEN_MESSAGE:message,hint=$('#hint');
 // Legacy semantic snapshots still rotate, while the displayed loss sequence
 // stays whole so its recovery page cannot be reset by the old 3.5 s cadence.
 const lossSequence=!tutorial.active&&lossNotice&&!baitAttached&&['escaped','ready'].includes(game.state.phase)&&cast.state.phase!=='retrieving';
 const rawVisual=lossSequence&&lossNotice.reason==='tension-limit'?`힘겨루기 실패 ${lossNotice.failures}/2.\n물고기를 놓쳤어요. 회수한 뒤 크릴새우를 다시 끼워 주세요.`:lossSequence?(lossNotice.reason==='zero-tension'?[ZERO_TENSION_WARNING,LOSS_PAGES[1]]:LOSS_PAGES).join('\n'):full;
 const visual=speciesSequence?speciesSequence.decorate(rawVisual,{phase:game.state.phase,fish:game.state.fish}):rawVisual;
 if(hint.textContent!==full)hint.textContent=full;
 if(hint.getAttribute('aria-label')!==visual)hint.setAttribute('aria-label',visual);
 let page=dialogue.querySelector('#hintPage');if(!page){page=node('span');page.id='hintPage';page.setAttribute('aria-hidden','true');dialogue.append(page)}
 // Normal-game instructions stay whole; tutorial paragraphs keep their own layout.
 if(page.textContent!==visual){page.replaceChildren(...String(visual).split(/(입질|챔질|회수|텐션|미끼|들어올리)/g).map((part,i)=>{if(i%2===0)return document.createTextNode(part);const mark=document.createElement('mark');mark.textContent=part;return mark;}));}
 page.dataset.page='1';page.dataset.pages='1';
 dialogue.dataset.length=String(visual).length>45?'long':'short';
}
// Fight visual effects integration: presentation only, never game-rule mutation.
function updateEffectUI(){paintStartInvitation();paintHookRole();const g=game.state,phase=cast.phase;const paused=modalOpen||!windowActive||document.hidden;if(paused)sound.stopFightFeedback();sound.setReel(paused||mini.finishing?null:phase==='flight'?'out':phase==='retrieving'||g.phase==='fighting'&&liftHeld?'in':null);$('#game').classList.toggle('visual-paused',paused);$('#cast').classList.toggle('reel-glowing',!paused&&g.phase==='fighting'&&liftHeld);$('#game').classList.toggle('reel-fighting',g.phase==='fighting');$('#cast').classList.toggle('bite-ready',phase==='waiting'&&g.phase==='bite');$('#fightHud').classList.toggle('fight-active',phase==='waiting'&&g.phase==='fighting');$('#fightHud').classList.toggle('hook-sparkle',!paused&&g.phase==='fighting');$('#fightHud').dataset.tension=g.tension>(g.fightProfile||fightProfile(g.fish)).upper?'high':g.tension<18?'low':'safe'}
function handleFishingVisualEvent(e){if(['ready','caught','escaped'].includes(game.state.phase))stopLift();if(game.state.phase!=='fighting'){sound.stopResistance?.();sound.stopFightFeedback();}cast.setFishingState?.(game.snapshot());updateEffectUI()}
function handleWorldVisualEvent(e){if(game.state.fish?.kind==='item'){if(e.type==='catchVisualComplete'&&pendingCatch&&e.catchId===pendingCatch.catchId){const item=pendingCatch.fish;pendingCatch=null;say(item.name+(item.id==='boot'?'를':'을')+' 낚아 올렸어요.',6);}return;}if(e.type==='fishEdge')game.edgeReached(e);if(e.type==='fishResistance')sound.cue('resistance');if(e.type==='visualHook'){sound.cue('strike');sound.vibration('hook')}if(e.type==='fishJump')sound.cue('jump');if(e.type==='fishReentry'){sound.cue('reentry');sound.vibration('reentry')}if(e.type==='catchLeap'){sound.cue('catchSplash');sound.cue('applause',e.catchId);sound.vibration('catch')}if(e.type==='catchVisualComplete'&&pendingCatch&&e.catchId===pendingCatch.catchId){const fish=pendingCatch.fish;pendingCatch=null;sound.cue('catch');say(`${fish.name} ${fish.length.toFixed(1)} cm! 어망에 담았어요.`,6);mini.landed()}}
// End fight visual effects integration.
function updateFightFeedback(){const v=cast.state.fishVisual;sound.updateFight({edgeEventsOnly:true,edgeEntry:game.state.edgeEntries,edgeRemaining:game.state.edgePullRemaining,active:game.state.fish?.kind!=='item'&&!modalOpen&&windowActive&&!document.hidden&&cast.state.phase==='waiting'&&game.state.phase==='fighting'&&['hook','fight'].includes(v?.phase),holding:v?.fightHolding,holdId:v?.fightHoldId,catchId:v?.catchId,phase:v?.fightMotionPhase,elapsed:game.state.fightElapsed,holdDuration:v?.fightHoldDuration,reducedMotion,lifting:liftHeld})}
const mentorSpeech=$('#fishingMentor .mentor-speech');
for(const type of ['pointerdown','pointerup','touchstart','touchend','dblclick'])mentorSpeech.addEventListener(type,event=>{event.stopPropagation();},{passive:true});
mentorSpeech.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(assetReady&&!modalOpen&&windowActive&&!document.hidden&&tutorial.next())paintUI();});
function paintTutorial(){
 $('#game').classList.toggle('guided-tutorial',tutorial.active);const mentor=$('#fishingMentor');mentor.hidden=!tutorial.active||!assetReady||modalOpen||!windowActive||document.hidden;const words=tutorial.message(game.state.phase)||'';if($('#mentorText').textContent!==words){const text=$('#mentorText');text.replaceChildren(...words.split(/(던지기 버튼|챔질|실패구간|물고기 체력이 0|수면을 좌우로)/g).map((part,i)=>{if(i%2===0)return document.createTextNode(part);const mark=document.createElement('mark');mark.textContent=part;return mark;}));mentor.querySelector('.mentor-speech').scrollTop=0;}
 const arrows=$('#tutorialArrows');arrows.hidden=!tutorial.active||!assetReady||modalOpen;arrows.dataset.target=tutorial.phase==='aim'?'aim':['bait','retryBait','theftBait'].includes(tutorial.phase)?'bait':['castPreview','castExplain'].includes(tutorial.phase)?'gauge':['cast','retry','recast','castResume'].includes(tutorial.phase)?'cast':'none';
 const first=arrows.firstElementChild;first.removeAttribute('style');const target=arrows.dataset.target;const element=target==='bait'?$('#bait'):target==='cast'?$('#cast'):target==='gauge'?$('.sweet-zone'):null;if(element){const b=element.getBoundingClientRect(),g=$('#game').getBoundingClientRect();first.style.left=(target==='gauge'?b.left+b.width/2-g.left-25:target==='bait'?b.right-g.left+4:b.left-g.left-55)+'px';first.style.top=(target==='gauge'?b.top-g.top-42:b.top+b.height/2-g.top-15)+'px';first.style.bottom='auto';first.style.right='auto';}
}
function frame(stamp){if(mini.closed)return;const dt=last?Math.min(.05,Math.max(0,(stamp-last)/1000)):0;last=stamp;if(!document.hidden&&windowActive){if(!modalOpen&&!mini.finishing&&!mini.introOpen){if(assetReady)tutorial.update(dt,{ready:idle(),baitAttached});advanceTextPages(dt);time+=dt;if(!previewMode&&!tutorial.active)environment.update(dt);sound.setEnvironment(environment.snapshot(),dt);if(time-environmentSavedAt>=5){saveEnvironment();environmentSavedAt=time}cast.catchHoldDuration=2;cast.setFishingState?.(game.snapshot());cast.setLoad?.({lift:liftValue,tension:game.state.phase==='fighting'?game.state.tension:0});cast.update(dt);if(cast.state.phase==='waiting'){game.setReeling(liftHeld&&game.state.phase==='fighting');if(!tutorial.autoExplaining)game.update(dt)}liftValue+=(Number(liftHeld)-liftValue)*Math.min(1,dt*9);updateFightFeedback()}renderer.render(ctx,{time,cast:cast.snapshot(),fishing:game.snapshot(),environment:environment.snapshot(),lift:liftValue,paused:modalOpen,reducedMotion});if(underwaterOpen){const view=$('#modalBody').querySelector('#underwaterCanvas');if(view){underwater.update(dt);underwater.render(view.getContext('2d'),view.width,view.height)}}paintUI()}requestAnimationFrame(frame)}requestAnimationFrame(frame);


window.NaturalistTestSession?.register({validate:value=>value?.kind==='fishing'&&value.version===1,capture(){if(!idle())return null;storage.setItem(ENVIRONMENT_SAVE,JSON.stringify(environment.saveState()));storage.setItem(SETTINGS,JSON.stringify({...game.state.equipmentIndices,bait:game.state.baitIndex}));storage.setItem(SAVE,JSON.stringify(fishbook));return {kind:'fishing',version:1};},restore(){}});

mini.setStop(()=>{stopLift();sound.pause();modalOpen=true;},()=>{modalOpen=false;last=0;sound.resume();});
