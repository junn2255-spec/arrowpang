export const TUTORIAL_KEY='valley-fishing-guided-tutorial-v1';
export const GUIDE_MESSAGES=[
 '안녕하세요!\n저수지 낚시터에 오신걸 \n환영해요.\n\n저와 함께 물고기 한마리를 \n잡아볼께요',
 '먼저 수면을 좌우로 밀어\n낚싯대 위치를 조정해 보세요.',
 '이제 던지기 버튼을 꾹 눌렀다  \n떼시면 찌가 던져집니다.',
 '찌가 움직입니다.\n기다리다 찌가 물속에 잠기면\n챔질을 하세요.',
 '버튼을 꾹 누르고 있어야 해요\n실패구간을 2번이상 넘으면 실패합니다.\n잠시 떼었다 다시 누르세요',
 '물고기 한마리를 잡이셨네요\n이제 본격적으로 낚시를 \n해보세요.'
];
export const CAST_EXPLANATION=GUIDE_MESSAGES[2];
export const TENSION_EXPLANATION=GUIDE_MESSAGES[4];
export const GAUGE_LESSON_SECONDS=10;
export class GuidedTutorial {
 constructor({eligible=true,saved={},save=()=>{}}={}) {
  this.save=save;this.progress={aim:false,theft:false,castRead:false,tensionRead:false,gaugeExplained:false,done:false,...saved};
  this.active=eligible&&!this.progress.done;this.phase=this.progress.aim?'bait':'intro';this.introRemaining=6;this.waitExplanationRemaining=4;this.retry=false;this.previewRemaining=0;this.lessonRemaining=0;this.castGaugeVisible=false;
 }
 persist(){this.save({...this.progress});}
 get paused(){return false;}
 get canCast(){return !this.active||['cast','retry','recast','castExplain','castResume'].includes(this.phase);}
 get showCastGauge(){return this.active&&this.castGaugeVisible;}
 get showFightPreview(){return this.active&&['gaugeLesson','waitBite','fight','catch'].includes(this.phase);}
 get autoExplaining(){return this.active&&['waitExplanation','gaugeLesson'].includes(this.phase);}
 next(){if(!this.active||this.phase!=='intro')return false;this.introRemaining=0;this.phase='aim';return true;}
 aim(delta){if(this.active&&this.phase==='aim'&&Math.abs(delta)>.02){this.progress.aim=true;this.phase='bait';this.persist();}}
 bait(id){if(!this.active)return true;if(id!=='worm'||!['bait','retryBait','theftBait'].includes(this.phase))return false;this.prepareCast(this.retry?'retry':'cast');return true;}
 prepareCast(target='cast'){if(!this.active)return;this.previewTarget=target;this.previewRemaining=2;this.phase='castPreview';this.castGaugeVisible=true;this.persist();}
 update(dt,{ready=true,baitAttached=true}={}) {
  if(!this.active||!Number.isFinite(dt)||dt<=0)return;
  if(this.phase==='intro'){this.introRemaining=Math.max(0,this.introRemaining-dt);if(this.introRemaining<=1e-8)this.phase='aim';return;}
  if(this.phase==='waitExplanation'){this.waitExplanationRemaining=Math.max(0,this.waitExplanationRemaining-dt);if(this.waitExplanationRemaining<=1e-8){this.phase=this.progress.gaugeExplained?'waitBite':'gaugeLesson';this.lessonRemaining=GAUGE_LESSON_SECONDS;}return;}
  if(this.phase==='gaugeLesson') {this.lessonRemaining=Math.max(0,this.lessonRemaining-dt);if(this.lessonRemaining<=1e-8){this.progress.gaugeExplained=true;this.phase='waitBite';this.lessonRemaining=0;this.persist();}return;}
  if(this.phase!=='castPreview')return;
  if(!ready||!baitAttached){this.previewRemaining=0;this.phase='bait';this.castGaugeVisible=false;return;}
  this.previewRemaining=Math.max(0,this.previewRemaining-dt);
  if(this.previewRemaining<=1e-8){this.previewRemaining=0;this.phase=this.previewTarget||'cast';this.progress.castRead=true;this.persist();}
 }
 preparing(){}
 // First-catch teaching now goes directly through a genuine nibble/full bite.
 // Historical theft milestone stays readable, but never forces bait loss again.
 outcome(){return this.active?'bite':null;}
 event(e) {
  if(!this.active)return;
  if(e.type==='castFailed'){this.retry=true;this.phase='failed';this.failureKind='cast';}
  if(e.type==='commit'){this.castGaugeVisible=false;this.phase='success';}
  if(e.type==='waiting'&&this.phase==='success') {this.phase='waitExplanation';this.waitExplanationRemaining=4;}
  if(e.type==='escape'){this.retry=true;this.phase='failed';this.failureKind='fish';this.failureReason=e.reason;}
  if(e.type==='retrieved')this.phase='retryBait';
  if(e.type==='hook'){this.phase='fight';this.progress.tensionRead=true;}
  if(e.type==='catch')this.phase='catch';
  if(e.type==='catchVisualComplete'){this.progress.done=true;this.active=false;this.phase='done';this.castGaugeVisible=false;}
  if(this.phase!=='castPreview')this.previewRemaining=0;
  if(this.phase!=='gaugeLesson')this.lessonRemaining=0;
  this.persist();
 }
 message(gamePhase) {
  if(!this.active)return null;
  const messages={
   intro:GUIDE_MESSAGES[0],
   aim:GUIDE_MESSAGES[1],
   bait:'이제 미끼를 장착해야 해요. 미끼 버튼을 눌러 미끼를 장착하세요.',
   retryBait:'찌를 회수했어요. 미끼 버튼을 눌러 크릴새우 미끼를 다시 장착하세요.',
   castPreview:CAST_EXPLANATION,
   cast:CAST_EXPLANATION,
   retry:CAST_EXPLANATION,
   recast:CAST_EXPLANATION,
   failed:this.failureKind==='cast'?'던지기를 실패했어요. 회수 버튼으로 찌를 회수한 뒤 미끼를 다시 장착해 주세요.':this.failureReason==='tension-limit'?'실패구간에 2번 진입해 물고기를 놓쳤어요. 회수한 뒤 새 미끼를 장착하세요.':'물고기를 놓쳤어요. 회수한 뒤 새 미끼를 장착하고 다시 던지세요.',
   success:GUIDE_MESSAGES[3],
   waitExplanation:GUIDE_MESSAGES[3],
   waitBite:GUIDE_MESSAGES[3],
   gaugeLesson:GUIDE_MESSAGES[3],
   fight:GUIDE_MESSAGES[4],
   catch:GUIDE_MESSAGES[5]
  };
  return messages[this.phase]||(gamePhase==='nibble'?'예신이에요. 찌가 살짝 움직이지만 아직 챔질하지 마세요. 완전히 잠길 때까지 기다리세요.':gamePhase==='bite'?'본신이에요. 찌가 완전히 잠겼어요! 지금 챔질한 뒤 꾹 눌러 줄을 감으세요.':'찌를 주시하세요. 예신 뒤 찌가 완전히 물속에 잠기면 챔질하세요.');
 }
}
