import {RARE_SPECIES} from './fishing/rare-species.js';
// All balances are mutated inside Progress.transact, shared by puzzle and fishing.
export const FISH_COIN_ART='assets/economy-v204/fishing-coin.webp';
export const GEAR_PRICES={rod:[300,1000,2500],line:[250,800,2000],bait:[200,700,1800]};
export const ATTENDANCE=[50,70,100,70,100,100,200];
export function rewardDay(now=Date.now()){return new Date(now+3*3600000).toISOString().slice(0,10);}// KST 06:00 reset
const dayNumber=day=>Date.parse(day+'T00:00:00Z')/86400000;
export function economyState(v){
 if(!v.economy){
  // Existing purchases and balances survive; give earlier clears their new first-clear entitlement.
  let catchup=0;for(const stage of Object.keys(v.cleared??{})){const n=Number(stage.match(/(\d+)$/)?.[1]);if(n>=1&&n<=40)catchup+=160+(n%5===0?500:0);}
  v.coins+=catchup;v.economy={version:1,attendance:{total:0,streak:0,last:null},days:{},fishingCoins:0,fish:{},records:{},catchIds:{},sold:{},rockPaid:{}};
 }
 const e=v.economy;if(e.version!==1||!Number.isSafeInteger(e.fishingCoins)||e.fishingCoins<0)throw Error('낚시 코인 기록을 확인해 주세요.');return e;
}
export function dailyState(v,now=Date.now()){
 const e=economyState(v),day=rewardDay(now);e.days[day]??={puzzle:0,combo:0,mole:0,fish:0,claimed:{},moleFirst:false,fishSix:false,max:{}};return e.days[day];
}
export function addFishingCoins(v,amount){const e=economyState(v);if(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(e.fishingCoins+amount))throw Error('낚시 코인 범위를 확인해 주세요.');e.fishingCoins+=amount;return e.fishingCoins;}
export function claimAttendance(v,now=Date.now()){
 const e=economyState(v),a=e.attendance,day=rewardDay(now);if(a.last&&dayNumber(day)<=dayNumber(a.last))return {awarded:false};
 a.streak=a.last&&dayNumber(day)-dayNumber(a.last)===1?a.streak+1:1;a.total++;a.last=day;
 const slot=(a.total-1)%7,streakSlot=(a.streak-1)%7+1;let coins=ATTENDANCE[slot],fishing=slot===2?50:slot===6?150:0;
 if(streakSlot===3)coins+=50;if(streakSlot===7){coins+=100;fishing+=50;}v.coins+=coins;addFishingCoins(v,fishing);return {awarded:true,coins,fishing,slot};
}
export function missionStatus(v,now=Date.now()){
 const d=dailyState(v,now),open=!!v.cleared?.['arrowtok-stage-05'];return [
  {id:'puzzle',name:'퍼즐 1회 클리어',done:d.puzzle>=1,coins:40},
  {id:'combo',name:'같은 색 화살표 3연속 탈출',done:d.combo>=1,coins:30},
  {id:'play',name:open?'두더지 클리어 또는 물고기 3마리':'퍼즐 2회 클리어',done:open?(d.mole>=1||d.fish>=3):d.puzzle>=2,coins:40},
  {id:'all',name:'오늘의 미션 모두 완료',done:['puzzle','combo','play'].every(k=>d.claimed[k]),coins:50},
  {id:'fishing',name:'오늘 물고기 6마리 잡기',done:d.fish>=6,coins:0,fishing:50}
 ];
}
export function claimMission(v,id,now=Date.now()){
 const d=dailyState(v,now),m=missionStatus(v,now).find(m=>m.id===id);if(!m||!m.done||d.claimed[id])return false;d.claimed[id]=true;v.coins+=m.coins;addFishingCoins(v,m.fishing??0);return m;
}
export function rockRewardPlan(level){
 const n=Number(String(level.id??'').match(/(\d+)$/)?.[1]);if(n<11||n>40)return [];
 const count=n<=25?1:n<=35?2:3,amount=n<=20?10:n<=30?15:20;
 return (level.rocks??[]).slice(0,count).map(r=>({id:r.id,amount}));
}
export function settleRockCoins(v,stage,level,game){
 const e=economyState(v);if(e.rockPaid[stage])return 0;const missing=rockRewardPlan(level).filter(r=>!(game.rocks??[]).some(q=>q.id===r.id&&q.hp>0));
 const amount=missing.reduce((sum,r)=>sum+r.amount,0);e.rockPaid[stage]=true;addFishingCoins(v,amount);return amount;
}
export const FISH_SALES={...Object.fromEntries(RARE_SPECIES.map(f=>[f.id,f.sale])),goby:10,greenling:10,rockfish:20,crucian:35,'striped-beakfish':45,'sea-bass':60,'red-seabream':80,grouper:80};
const LENGTHS={...Object.fromEntries(RARE_SPECIES.map(f=>[f.id,f.sizes[1]])),goby:14,greenling:22,rockfish:23,crucian:35,'striped-beakfish':35,'sea-bass':60,'red-seabream':45,grouper:55};
export function fishSaleValue(f){const base=FISH_SALES[f.id];if(!base)return 0;const ratio=f.length/LENGTHS[f.id],mult=ratio>=1.6?2:ratio>=1.2?1.6:ratio>=.85?1.3:1;return Math.floor(base*mult);}
export function recordFish(v,f,now=Date.now()){
 const e=economyState(v),id=f.economyId;if(!id||typeof id!=='string'||id.length>100||!FISH_SALES[f.id]||!Number.isFinite(f.length)||f.length<=0||f.length>1000)throw Error('물고기 기록을 확인해 주세요.');if(e.catchIds[id])return {duplicate:true};
 e.catchIds[id]=true;const fish={economyId:id,id:f.id,length:f.length,weight:Number(f.weight)||0,name:String(f.name??'').slice(0,30),at:now};e.fish[id]=fish;
 const d=dailyState(v,now),record=e.records[f.id]??{count:0,max:0};let bonus=0;if(!record.count)bonus+=50;if(f.length>record.max&&record.count&&!d.max[f.id]){bonus+=20;d.max[f.id]=true;}record.count++;record.max=Math.max(record.max,f.length);e.records[f.id]=record;d.fish++;
 if(d.fish>=6&&!d.fishSix){d.fishSix=true;bonus+=100;}addFishingCoins(v,bonus);return {fish,bonus};
}
export function sellFish(v,ids){
 const e=economyState(v);let amount=0,count=0;for(const id of new Set(ids)){const f=e.fish[id];if(!f)continue;amount+=fishSaleValue(f);count++;delete e.fish[id];e.sold[id]=true;}addFishingCoins(v,amount);return {amount,count,balance:e.fishingCoins};
}
