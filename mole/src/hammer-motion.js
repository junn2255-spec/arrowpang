// Two downstrokes from the approved sketch: horizontal -> diagonal -> vertical.
// Coordinates are grip ends inside 256px padded atlas cells.
export const HAMMER_PIVOTS = Object.freeze([
  {x:159,y:193},{x:173,y:184},{x:193,y:135},
  {x:190,y:186},{x:132,y:186},{x:193,y:136}
]);
export const HAMMER_DURATION=210;
export const HAMMER_IMPACT=60;
export function hammerPoseAt(age,variant=0,reduced=false){
  if(age<0||age>=HAMMER_DURATION)return null;
  const order=variant%2?[4,3,5,3,4]:[0,1,2,1,0];
  const step=age<30?0:age<60?1:age<110?2:age<155?3:4;
  return {frame:reduced?order[2]:order[step],opacity:age>165?(HAMMER_DURATION-age)/45:1};
}
