import {CastController,CAST_AIM_LATERAL_SPREAD,projectWorld} from './pole-physics.js';
// A 10.5 cm total depth interval around the existing normal ~5.84 m landing.
// The inherited release validates the actual charge (65–100) before this runs.
export function castLandingDepth(charge){return 5.84+(Math.max(65,Math.min(100,charge))-80)*.003;}
export class SubtleDistanceCastController extends CastController {
 _previewTarget(){super._previewTarget();this._target={x:-1.9+this._aim*CAST_AIM_LATERAL_SPREAD,y:castLandingDepth(this._charge),z:0};}
 _beginArc(){const actual=this._releaseCharge;this._previewTarget();this._landingGoal={...this._target};this._releaseCharge=80;try{super._beginArc();}finally{this._releaseCharge=actual;}}
 _emit(type,extra={}){
  if(type==='splash'&&this._landingGoal){
   // One authoritative reachable endpoint for the float, rope, ripple and target.
   this._impact=this._safeWaterTarget({...this._landingGoal,x:this._impact.x},this._tip);
   this._float={...this._impact};this._target={...this._impact};
   this._splash=projectWorld(this._impact);extra={...extra,position:{...this._splash}};
  }
  super._emit(type,extra);
 }
}
