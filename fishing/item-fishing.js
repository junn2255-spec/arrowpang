import {SpeciesFishingGame,SpeciesCastController} from './species-fight.js';
import {ITEM_DEFINITIONS} from './daily-items.js';
export class ItemFishingGame extends SpeciesFishingGame{
 constructor({dailyItems,...options}={}){super(options);this.dailyItems=dailyItems;}
 cast({dailyAttemptId,excludeDailyItems=false,availableItems,...options}={}){
  const ok=super.cast(options);if(!ok)return false;
  const ticket=this.dailyItems?.begin({attemptId:dailyAttemptId,excluded:excludeDailyItems,available:availableItems});
  if(ticket){const old=this.state.fish;this.state.fish={...ITEM_DEFINITIONS[ticket.id],catchId:old.catchId,dailyTicket:ticket,liftDuration:.8,strength:.05,stamina:1,speed:1};this.state.fightProfile={lower:0,upper:100,resistance:0};this._tutorialOutcome='bite';this._waitDuration=2.5;}
  return true;
 }
 _emit(type,detail={}){const item=detail.fish?.kind==='item'?detail.fish:this.state?.fish?.kind==='item'?this.state.fish:null;if(type==='catch'&&item)detail={...detail,dailyClaimed:this.dailyItems?.claim(item.dailyTicket)===true};if(type==='escape'&&item)this.dailyItems?.miss(item.dailyTicket);super._emit(type,detail);}
 reset(){if(this.state?.fish?.kind==='item'&&this.state.phase!=='caught')this.dailyItems?.miss(this.state.fish.dailyTicket);return super.reset();}
 edgeReached(event){return this.state.fish?.kind==='item'?false:super.edgeReached(event);}
 _fight(dt){if(this.state.fish?.kind!=='item')return super._fight(dt);const s=this.state;s.fightElapsed+=dt;s.tension=35;s.surge=false;s.pull=false;s.edgePullRemaining=0;s.resistanceFactor=0;s.tensionWarning=false;s.progress=Math.min(100,s.progress+(s.holding?60*dt:0));if(s.progress>=100){this._transition('caught',s.fish.name+(s.fish.id==='boot'?'를':'을')+' 낚아 올렸어요.');s.holding=false;this._emit('catch',{fish:{...s.fish},catchId:s.fish.catchId});}}
}
export class ItemCastController extends SpeciesCastController{
 _fightMotionAt(time){const v=this._fishVisual;if(v?.fish?.kind!=='item')return super._fightMotionAt(time);return{phase:'item-straight',side:0,holding:false,atEdge:false,x:v.origin.x,y:v.origin.y,holdProgress:0};}
 _stepFishResistance(dt){if(this._fishVisual?.fish?.kind!=='item')return super._stepFishResistance(dt);const v=this._fishVisual;v.resistance=0;v.resistanceSide=0;v.resistancePulse=0;v.resistanceAge=1.1;}
 _stepFishingVisual(dt){if(this._fishVisual?.fish?.kind!=='item')return super._stepFishingVisual(dt);const v=this._fishVisual;if(v.phase==='catch'){
   const p=Math.min(1,v.catchAge/(v.fish.liftDuration||.8)),end=v.catchEnd,start=v.catchStart;
   this._float={x:start.x+(end.x-start.x)*p,y:start.y+(end.y-start.y)*p,z:start.z+(end.z-start.z)*p};this._constrainFloat();v.mouth={...this._float};v.angle=0;v.heading=1;v.airborne=p>0;v.jumpHeight=0;
   if(v.catchAge>=v.fish.liftDuration+this.catchHoldDuration-1e-9){v.phase='caught';this._rigVisible=false;this._emit('catchVisualComplete',{catchId:v.catchId});}return true;
  }const result=super._stepFishingVisual(dt);if(['hook','fight'].includes(v.phase)){// Keep x on the actual cast ray, with no lateral fish motion.
   const x=v.origin.x,dy=this._float.y-this._tip.y,dz=this._float.z-this._tip.z,reach=this.lineLength,dx=x-this._tip.x;
   const yz=Math.hypot(dy,dz),maxYZ=Math.sqrt(Math.max(0,reach*reach-dx*dx));this._float={x,y:this._tip.y+dy*Math.min(1,maxYZ/Math.max(yz,1e-9)),z:this._tip.z+dz*Math.min(1,maxYZ/Math.max(yz,1e-9))};v.mouth={...this._float};v.waterAnchor={...this._float,z:0};
  }return result;}
}
