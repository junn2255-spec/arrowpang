// Fantasy visitors supplement the existing coastal species; bait tiers are zero based.
export const RARE_SPECIES=Object.freeze([
 {id:'bangulmong',name:'방울몽',tier:0,sizes:[10,17,25],strength:.8,color:'#9be9fa',sale:35,endurance:1.05,pulse:4},
 {id:'lumiel',name:'루미엘',tier:1,sizes:[18,30,44],strength:1.2,color:'#b7e4ff',sale:80,endurance:1.65,pulse:10},
 {id:'crispern',name:'크리스펀',tier:2,sizes:[23,40,58],strength:1.5,color:'#aa7cec',sale:125,endurance:2.1,pulse:14},
 {id:'florea',name:'플로레아',tier:2,sizes:[20,34,49],strength:1.35,color:'#ffa4c6',sale:125,endurance:1.9,pulse:13},
 {id:'astraon',name:'아스트라온',tier:3,sizes:[40,68,95],strength:1.9,color:'#8ce7ff',sale:200,endurance:2.9,pulse:21},
 {id:'noctilus',name:'녹티루스',tier:3,sizes:[36,60,88],strength:2,color:'#39cbd0',sale:200,endurance:3.1,pulse:23},
].map(f=>Object.freeze({...f,sizes:Object.freeze(f.sizes),speed:1,weightFactor:.000012,rarity:f.tier===3?'legendary':'rare',rarityLabel:f.tier===3?'전설 희귀어':'판타지 희귀어',fantasy:true,icon:'✦'})));
export const RARE_IDS=Object.freeze(RARE_SPECIES.map(f=>f.id));
export const RARE_BY_ID=Object.freeze(Object.fromEntries(RARE_SPECIES.map(f=>[f.id,f])));
export const rareArt=(id,file='sheet.webp')=>'assets/rare-fish-v211/'+id+'/'+file;
export function chooseRareFish(tier,rng=Math.random,force=false){
 if(!force&&rng()>=.25)return null;
 const current=RARE_SPECIES.filter(f=>f.tier===tier),earlier=RARE_SPECIES.filter(f=>f.tier<tier);
 const pool=earlier.length&&rng()<.25?earlier:current;
 return pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))]?.id??null;
}
export const RARE_DIFFICULTY=Object.freeze(Object.fromEntries(RARE_SPECIES.map(f=>[f.id,Object.freeze({
 tensionGain:[.8,1.25,1.6,1.95][f.tier],endurance:f.endurance,rodForce:f.strength,pulse:f.pulse,
 surgeEvery:[7,5,4,3.3][f.tier],surgeDuration:[.45,.65,.85,1][f.tier],firstSurge:3,
 edgeDuration:[.8,1.3,1.8,2.5][f.tier]
})])));
