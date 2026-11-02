export const HOME_MAX=10;
export const YARD_ORDER=['foundation','walls','roof','secondFloor','mainHouse','balcony','terrace','pond','starryNight'];
const LEGACY_ORDER=['walls','roof','flowers','dog','greenRoof','expanded','benchFence','pond','fish'];
export const YARD_COSTS=[150,200,300,350,400,500,600,700,800];
export const YARD_GOALS=['기초 공사','1층 돌벽','판타지 단층집','2층 골조','2층 숲속집 완성','대형 발코니','지붕 있는 테라스','연못과 폭포','별빛 숲속집'];
export function ensureHomeOwnership(v){
 if(v.homeOwnership?.version===3)return v.homeOwnership;
 const prior=v.homeOwnership,previous=prior?.legacyOwned??prior?.owned??LEGACY_ORDER.slice(0,Math.max(0,(Number(v.home)||1)-1));
 // Preserve completed houses from both legacy progressions, including the short-lived eight-upgrade preview.
 const count=prior?.version===2&&v.home>=9?9:Math.max(0,Math.min(9,(Number(v.home)||1)-1));v.home=count+1;
 v.homeOwnership={version:3,owned:YARD_ORDER.slice(0,count),legacyOwned:[...previous]};return v.homeOwnership;
}
export function hasHomeFeature(v,key){
 const s=ensureHomeOwnership(v);if(key==='dog')return true;
 if(key==='expanded'||key==='greenRoof')return v.home>=6;
 if(key==='flowers')return v.home>=8;if(key==='fish')return v.home>=9;
 return s.owned.includes(key);
}
export function nextYard(v){const owned=ensureHomeOwnership(v).owned,i=YARD_ORDER.findIndex(k=>!owned.includes(k));return i<0?null:{key:YARD_ORDER[i],name:YARD_GOALS[i],cost:YARD_COSTS[i]};}
export function ownedHouseFrame(v){ensureHomeOwnership(v);return v.home-1;}
