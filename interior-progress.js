export const INTERIOR_REWARDS=[
 {stage:16,key:'entry',name:'집 안 출입'},
 {stage:19,key:'sofa',name:'포근한 소파'},
 {stage:22,key:'sink',name:'싱크대'},
 {stage:25,key:'table',name:'식탁·의자와 양털 러그'},
 {stage:28,key:'fireplace',name:'벽난로'},
 {stage:31,key:'ramen',name:'라면 끓이기'},
 {stage:34,key:'grill',name:'고기·새우 요리'},
 {stage:37,key:'lights',name:'줄 조명과 밤 분위기'},
 {stage:40,key:'bird',name:'새장과 노란 새'}
];
export function clearedThrough(v){let n=0;while(n<40&&v.cleared?.['arrowtok-stage-'+String(n+1).padStart(2,'0')])n++;return n;}
export const INTERIOR_COSTS=[650,700,750,800,900,1000,1050,1100,1250];
export const FUTURE_DECOR_SLOTS=['garden','fence','doghouse'];
export function interiorState(v){const cleared=clearedThrough(v),built=Math.max(0,Math.min(9,Number(v.interiorBuild?.level)||0)),unlocked=Object.fromEntries(INTERIOR_REWARDS.map((r,i)=>[r.key,i<built]));return{cleared,built,unlocked,earned:INTERIOR_REWARDS.slice(0,built),next:built<9?{...INTERIOR_REWARDS[built],cost:INTERIOR_COSTS[built]}:null};}
export function interiorPreview(v){const s=interiorState(v);return s.next?'다음: '+s.next.name+' · '+s.next.cost+'코인':'집 안 완성! 요리와 휴식을 즐겨요';}
