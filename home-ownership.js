export const YARD_ORDER=['walls','dog','roof','flowers','greenRoof','expanded','benchFence','pond','fish'];
const LEGACY_ORDER=['walls','roof','flowers','dog','greenRoof','expanded','benchFence','pond','fish'];
export const YARD_COSTS=[300,200,750,1000,1050,1250,1450,1650,1850];
export const YARD_GOALS=['벽 수리','강아지','지붕과 새 옷','꽃밭','초록 지붕','2층 확장','벤치와 울타리','연못','물고기'];
// Existing home numbers count purchases; preserve that count and every earned feature.
export function ensureHomeOwnership(v){
 if(v.homeOwnership?.version===1)return v.homeOwnership;
 const count=Math.max(0,Math.min(9,(Number(v.home)||1)-1));
 v.homeOwnership={version:1,owned:LEGACY_ORDER.slice(0,count)};
 return v.homeOwnership;
}
export function hasHomeFeature(v,key){return ensureHomeOwnership(v).owned.includes(key);}
export function nextYard(v){const owned=ensureHomeOwnership(v).owned,i=YARD_ORDER.findIndex(k=>!owned.includes(k));return i<0?null:{key:YARD_ORDER[i],name:YARD_GOALS[i],cost:YARD_COSTS[i]};}
export function ownedHouseFrame(v){return hasHomeFeature(v,'expanded')?4:hasHomeFeature(v,'greenRoof')?3:hasHomeFeature(v,'roof')?2:hasHomeFeature(v,'walls')?1:0;}
