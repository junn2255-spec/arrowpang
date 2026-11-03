export const INTERIOR_REWARDS=[
 {stage:16,key:'entry',name:'빈 집 · 실내 입장'},
 {stage:19,key:'fireplace',name:'따뜻한 벽난로'},
 {stage:22,key:'sofa',name:'포근한 소파'},
 {stage:25,key:'table',name:'원탁과 러그'},
 {stage:28,key:'rocking',name:'흔들의자'},
 {stage:31,key:'bed',name:'복층 침대와 책장'},
 {stage:34,key:'lights',name:'조명·시계·액자·테이블 소품'},
 {stage:37,key:'treasures',name:'숲속 유리구슬·황금 용·크리스털 보물상자'}
];
export function clearedThrough(v){let n=0;while(n<40&&v.cleared?.['arrowtok-stage-'+String(n+1).padStart(2,'0')])n++;return n;}
export const INTERIOR_COSTS=[150,200,250,300,350,350,400,450];
export const FUTURE_DECOR_SLOTS=['garden','fence','doghouse'];
export function interiorState(v){const cleared=clearedThrough(v),built=Math.max(0,Math.min(8,Number(v.interiorBuild?.level)||0)),unlocked=Object.fromEntries(INTERIOR_REWARDS.map((r,i)=>[r.key,i<built]));return{cleared,built,unlocked,earned:INTERIOR_REWARDS.slice(0,built),next:built<8?{...INTERIOR_REWARDS[built],cost:INTERIOR_COSTS[built]}:null};}
export function interiorPreview(v){const s=interiorState(v);return s.next?'다음: '+s.next.name+' · '+s.next.cost+'코인':'숲속집 실내 완성!';}
