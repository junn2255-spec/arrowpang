import {HOME_MAX} from './home-ownership.js';
export const VILLA_NAMES=['해변의 공터','기초 공사','골조 세우기','기본 별장 완성','외관 업그레이드','나무 데크 확장','2층 공사','2층 별장 완성','정원과 테라스','풀빌라 완성'];
export const VILLA_COSTS=[200,300,400,450,500,600,700,850,1000];
export const VILLA_INTERIOR_COSTS=[300,450,600,750,900];
export const VILLA_INTERIOR_NAMES=['바다가 보이는 거실','주방과 식탁','포근한 침실','책장과 조명','완성된 바닷가 쉼터'];
export const VILLA_DECOR=[
 {key:'shells',name:'조개와 불가사리',art:'shells-starfish',level:2,legacy:'pinwheels'},
 {key:'flowers',name:'해변 꽃 화분',art:'hibiscus',level:3,legacy:'appleTree'},
 {key:'sign',name:'해변 안내판',art:'beach-sign',level:4,legacy:'lamps'},
 {key:'surfboards',name:'서핑보드',art:'surfboards',level:5},
 {key:'ring',name:'튜브와 비치볼',art:'ring-ball',level:6},
 {key:'chairs',name:'파라솔과 의자',art:'parasol-chairs',level:8},
 {key:'castle',name:'모래성',art:'sandcastle',level:9}
];
export function villaState(v){
 const s=v.seasideVilla??{version:1,level:1,placed:{},introduced:false};
 if(s.version!==1||!Number.isInteger(s.level)||s.level<1||s.level>10||!s.placed||typeof s.placed!=='object')throw Error('별장 저장 기록을 확인해 주세요.');
 const interior=s.interior??0;if(!Number.isInteger(interior)||interior<0||interior>5)throw Error('별장 실내 기록을 확인해 주세요.');
 return {version:1,level:s.level,interior,placed:{...s.placed},introduced:!!s.introduced};
}
export const villaUnlocked=v=>v.home>=HOME_MAX;
export const decorAvailable=(v,d)=>villaState(v).level>=d.level||!!(d.legacy&&v.bonus?.decor?.[d.legacy]);
export class VillaStore{
 constructor(progress){this.progress=progress;}
 read(){const v=this.progress.read();return {...villaState(v),coins:v.coins,unlocked:villaUnlocked(v),source:v};}
 upgradeInterior(expected){return this.progress.transact(v=>{const s=villaState(v);if(!villaUnlocked(v)||s.level<10)throw Error('별장 외관을 완성하면 실내를 꾸밀 수 있어요.');if(s.interior!==expected)throw Error('실내 단계가 변경됐어요.');const cost=VILLA_INTERIOR_COSTS[expected];if(cost===undefined)throw Error('실내가 모두 완성됐어요.');if(v.coins<cost)throw Error('코인이 부족해요.');v.coins-=cost;s.interior++;v.seasideVilla=s;return {level:s.interior,cost,name:VILLA_INTERIOR_NAMES[s.interior-1]};});}
 enter(){return this.progress.transact(v=>{if(!villaUnlocked(v))throw Error('숲속집 외관을 완성하면 열려요.');v.seasideVilla=villaState(v);return villaState(v);});}
 introduce(){return this.progress.transact(v=>{if(!villaUnlocked(v))throw Error('별장이 아직 열리지 않았어요.');v.seasideVilla={...villaState(v),introduced:true};});}
 upgrade(expected){return this.progress.transact(v=>{if(!villaUnlocked(v))throw Error('별장이 아직 열리지 않았어요.');const s=villaState(v);if(s.level!==expected)throw Error('건설 단계가 바뀌었어요. 다시 확인해 주세요.');const cost=VILLA_COSTS[s.level-1];if(cost===undefined)throw Error('별장이 모두 완성됐어요.');if(v.coins<cost)throw Error('코인이 부족해요.');v.coins-=cost;s.level++;v.seasideVilla=s;return {level:s.level,cost,coins:v.coins,name:VILLA_NAMES[s.level-1]};});}
 place(key){return this.progress.transact(v=>{const d=VILLA_DECOR.find(x=>x.key===key),s=villaState(v);if(!villaUnlocked(v)||!d||!decorAvailable(v,d))throw Error('아직 받을 수 없는 장식이에요.');if(s.placed[key])return false;s.placed[key]=true;v.seasideVilla=s;return true;});}
}
