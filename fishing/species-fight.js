import {FishingGame} from './game-model.js';
import {FISH_HOLD_DURATION} from './pole-physics.js';
import {SubtleDistanceCastController} from './cast-distance.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const COASTAL_DIFFICULTY=Object.freeze({
 'striped-beakfish':Object.freeze({tensionGain:1.22,endurance:1.56,rodForce:1.15,pulse:8,surgeEvery:5.5,surgeDuration:.65,firstSurge:3,edgeDuration:1.2}),
 crucian:Object.freeze({tensionGain:1.48,endurance:1.885,rodForce:1.35,pulse:12,surgeEvery:4.5,surgeDuration:.85,firstSurge:2.5,edgeDuration:1.6}),
 'sea-bass':Object.freeze({tensionGain:1.78,endurance:2.275,rodForce:1.6,pulse:16,surgeEvery:3.6,surgeDuration:1,firstSurge:2,edgeDuration:2.1})
});
export const SPECIES_LIMITS=Object.freeze({'striped-beakfish':80,'sea-bass':56,crucian:68,sogari:75,carp:70,catfish:65,eel:50});
export const SIZE_FIGHT=Object.freeze({small:{resistance:.8,zone:5},medium:{resistance:1,zone:0},large:{resistance:1.2,zone:-5}});
export const RECOVERY_SECONDS=2,MAX_FIGHT_FAILURES=2;
export function fightProfile(fish){const size=SIZE_FIGHT[fish?.sizeId]||SIZE_FIGHT.medium;return {lower:0,upper:(SPECIES_LIMITS[fish?.id]??85)+size.zone,resistance:size.resistance};}
export function isFightSafe(tension,profile){return tension>profile.lower&&tension<=profile.upper;}
export function fatigueAt(time){return Math.max(.55,1-Math.max(0,time)/90);}
export const STAMINA_DRAIN=Object.freeze({crucian:1.19,sogari:1.0864,carp:1.081,catfish:1.0192,eel:1.012});
export function edgePullDuration(id){return COASTAL_DIFFICULTY[id]?.edgeDuration||({crucian:1,sogari:1.5,carp:2,catfish:2.5,eel:3})[id]||1;}
export function edgeEnvelope(age,duration){return duration<=0||age<0||age>=duration?0:1;}
export const ORIGINAL_SIZE_WEIGHTS=Object.freeze({day:Object.freeze([60,30,10]),night:Object.freeze([55,30,15]),rain:Object.freeze([50,30,20])});
export function originalSizeWeights(environment={}){return ORIGINAL_SIZE_WEIGHTS[environment.weather==='rain'||['light','medium','heavy'].includes(environment.rainLevel)?'rain':environment.isNight?'night':'day'];}
export class SpeciesFishingGame extends FishingGame {
 _sizeWeightsFor(environment){return originalSizeWeights(environment);}
 cast({baitAttached=false,...options}={}){if(baitAttached!==true)return false;const ok=super.cast(options);if(ok){this.state.fightProfile=fightProfile(this.state.fish);this.state.fish.fightPower=COASTAL_DIFFICULTY[this.state.fish.id]?.rodForce||1;}return ok;}
 hook(){const ok=super.hook();if(ok){const s=this.state;s.fightProfile=fightProfile(s.fish);s.dangerTime=0;s.tensionCrossings=0;s.failureZoneActive=false;s.resistanceFactor=0;s.recoveryRemaining=RECOVERY_SECONDS;s.edgePullRemaining=0;s.edgeEntries=0;this._edgePullEnd=0;this._edgePullStart=0;this._lastEdgeEntry=0;const coastal=COASTAL_DIFFICULTY[s.fish.id];if(coastal)this._nextSurge=coastal.firstSurge+this._random()*.4;}return ok;}
 edgeReached({catchId,entryId,side}={}){
  const s=this.state;if(s.phase!=='fighting'||catchId!==s.fish?.catchId||!Number.isInteger(entryId)||entryId<=this._lastEdgeEntry)return false;
  this._lastEdgeEntry=entryId;s.edgeEntries++;s.edgeSide=side;
  this._edgePullStart=s.fightElapsed;this._edgePullEnd=s.fightElapsed+edgePullDuration(s.fish.id);
  s.edgePullRemaining=edgePullDuration(s.fish.id);s.edgePullStrength=1;return true;
 }
 _registerFailure(){
  const s=this.state;s.tensionCrossings++;s.dangerTime=0;s.recoveryRemaining=RECOVERY_SECONDS;
  // Terminal state is already committed when observers receive failure 2/2.
  const terminal=s.tensionCrossings>=MAX_FIGHT_FAILURES;
  if(terminal)this._escape('tension-limit','실패구간에 2번 진입해 물고기를 놓쳤어요. 회수 후 새 미끼를 달아 주세요.');
  this._emit('tensionFailure',{failures:s.tensionCrossings,max:MAX_FIGHT_FAILURES,terminal});return terminal;
 }
 _fight(dt){
  const s=this.state;s.fightElapsed+=dt;const t=s.fightElapsed,p=s.fightProfile||fightProfile(s.fish),size=p.resistance,coastal=COASTAL_DIFFICULTY[s.fish.id];
  let pull=0;
  if(coastal){
   if(t>=this._nextSurge){this._surgeEnd=t+coastal.surgeDuration;this._nextSurge=t+coastal.surgeEvery+this._random()*.5;this._emit('surge',{fish:{...s.fish}});}
   s.surge=t<this._surgeEnd;pull=s.surge?coastal.pulse:0;
  }else if(['crucian','sogari'].includes(s.fish.id)){
   // Preserve the published crucian surge timings/RNG and existing swim pattern.
   if(t>=this._nextSurge){this._surgeEnd=t+.9+this._random()*.3;this._nextSurge=t+5+this._random()*1.2;this._emit('surge',{fish:{...s.fish}});}
   s.surge=t<this._surgeEnd;pull=s.surge?17*1.1:0;
  }else{s.surge=false;}
  const duration=edgePullDuration(s.fish.id),edge=this._edgePullEnd>t?edgeEnvelope(t-this._edgePullStart,duration):0;
  s.edgePullRemaining=Math.max(0,this._edgePullEnd-t);
  if(coastal){pull=Math.max(pull,coastal.pulse*edge);s.surge=s.surge||s.edgePullRemaining>0;}else if(s.edgePullRemaining>0||!['crucian','sogari'].includes(s.fish.id)){s.surge=s.edgePullRemaining>0;pull=({crucian:4,sogari:5,carp:6,catfish:7,eel:8}[s.fish.id]||0)*edge;}
  s.edgePullStrength=edge;
  s.pull=s.surge;const easing=(.45+.55*clamp(t))*fatigueAt(t);
  const {rod,line}=s.equipment;
  s.resistanceFactor=size*(coastal?.tensionGain||1)*easing*(.6+pull/20);
  const rise=18*1.1*size*(coastal?.tensionGain||1)*easing*(1-rod.control)/line.strength;
  const rate=(s.holding?rise:-25*line.recovery)+pull*size*easing/line.strength;
  s.tension=clamp(s.tension+rate*dt,0,100);
  const safe=isFightSafe(s.tension,p);s.tensionWarning=!safe;
  if(safe){s.failureZoneActive=false;s.dangerTime=0;s.recoveryRemaining=RECOVERY_SECONDS;}
  else if(!s.failureZoneActive){
   s.failureZoneActive=true;
   if(this._registerFailure())return;
  }
  // Count zone entries, never frames spent inside one unsafe episode.
  const efficiency=safe?1:0;
  const pullRate=pull*size*easing/line.strength;
  const releaseRate=Math.max(1,25*line.recovery-pullRate);
  const holdShare=releaseRate/(releaseRate+rise+pullRate);
  const targetSeconds=clamp((6.15+(size-.8)*1.7-(rod.power-1)*2)*Math.pow(1.19/(STAMINA_DRAIN[s.fish.id]||1.19),.15),6.2,7.6)*(coastal?.endurance||1);
  s.progress=clamp(s.progress+(s.holding?100/targetSeconds/holdShare*efficiency:-1.1)*dt,0,100);
  if(s.fightElapsed<6)s.progress=Math.min(s.progress,99.999);
  if(s.progress>=100){this._transition('caught',`${s.fish.name} 잡았어요!`);s.holding=false;s.surge=false;s.pull=false;this._emit('catch',{fish:{...s.fish},id:s.fish.id,catchId:s.fish.catchId,length:s.fish.length,weight:s.fish.weight});}
  else s.message=safe?'누르고 놓으며 성공구간을 유지하세요.':'실패구간에 진입했어요. 안전구간으로 돌아온 뒤 다시 진입하면 실패합니다.';
 }
}
export class SpeciesCastController extends SubtleDistanceCastController {
 _fishSnapshot(){const visual=super._fishSnapshot();return visual?{...visual,fightHoldDuration:edgePullDuration(this._fishVisual?.fish?.id)}:visual;}
 _fightMotionAt(time){
  const v=this._fishVisual;
  if(v?.edgeHold){
   const age=time-v.edgeHold.started,duration=edgePullDuration(v.fish?.id);
   if(age<duration-1e-9)return {...v.edgeHold.motion,holding:true,atEdge:true,holdProgress:clamp(age/duration)};
   // Resume the unchanged crucian traverse at its beginning, without teleporting.
   v.edgeMotionShift=v.edgeHold.travelAt-time;v.edgeHold=null;
  }
  const motion=super._fightMotionAt(time+(v?.edgeMotionShift||0));
  return {...motion,atEdge:motion.holding};
 }
 _stepFishResistance(dt){
  const v=this._fishVisual,s=this._fishingState;if(!v||s?.phase!=='fighting')return super._stepFishResistance(dt);
  const motion=v.fightMotion,edgeX=motion?.side<0?motion?.left:motion?.right;
  if(v.edgeArmed===undefined)v.edgeArmed=true;
  if(!motion?.atEdge&&v.edgeInsideX!==undefined&&Math.abs(this._float.x-v.edgeInsideX)>.12)v.edgeArmed=true;
  if(motion?.atEdge&&v.edgeArmed&&Math.abs(this._float.x-edgeX)<.04){
   v.edgeArmed=false;v.edgeInsideX=edgeX;v.edgeSerial=(v.edgeSerial||0)+1;
   const baseTime=s.fightElapsed+(v.edgeMotionShift||0);
   v.edgeHold={started:s.fightElapsed,motion:{...motion},travelAt:baseTime+(1-motion.holdProgress)*FISH_HOLD_DURATION};
   v.resistance=1;
   this._emit('fishEdge',{catchId:v.catchId,entryId:v.edgeSerial,side:motion.side,position:{x:this._float.x,y:this._float.y}});
   this._fishRipple('resistance',this._float,.8);
  }
  const pulling=!!v.edgeHold&&s.fightElapsed-v.edgeHold.started<edgePullDuration(s.fish?.id)-1e-9;
  const goal=pulling?1:0;
  v.resistance=pulling?1:v.resistance+(goal-v.resistance)*(1-Math.exp(-10*dt));v.resistanceSide=motion?.side||1;
  v.resistancePulse=0;v.resistanceAge=1.1;
 }
 // Keep both fixed-line endpoints reachable even while the lift button is held.
 _fishingRodPose(yaw,pitch){const pose=super._fishingRodPose(yaw,pitch),s=this._fishingState;if(s?.phase==='fighting'){pose.pitch=Math.min(pose.pitch,.62);if(s.fish?.id==='crucian')pose.pitch-=.04*(fightProfile(s.fish).resistance-1);else pose.pitch-=.045*(s.resistanceFactor||0);}return pose;}
 _fishRipple(kind,world,strength,extra){const s=this._fishingState;if(s?.phase==='fighting')strength*=fightProfile(s.fish).resistance;super._fishRipple(kind,world,strength,extra);}
}
