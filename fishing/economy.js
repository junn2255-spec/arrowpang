export const ECONOMY_KEY='valley-fishing-economy-v1';
export const BAIT_PRICES=Object.freeze({worm:30,dough:50,fly:20,minnow:80});
const ids=Object.keys(BAIT_PRICES),clone=x=>JSON.parse(JSON.stringify(x)),integer=n=>Number.isSafeInteger(n)&&n>=0;
export function salePrice(f){return ({crucian:12,sogari:24,carp:18,catfish:24,eel:36}[f.id]||12)*({small:1,medium:2,large:3}[f.sizeId]||1);}
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function valid(s){return record(s)&&record(s.baits)&&record(s.consumed)&&record(s.sold)&&s?.version===1&&integer(s.coins)&&ids.every(id=>integer(s.baits?.[id]))&&s.consumed&&s.sold&&Object.values(s.consumed).every(v=>ids.includes(v))&&Object.values(s.sold).every(integer);}
export class FishingEconomy{
 constructor(storage){this.storage=storage;this.error=null;this.state=null;this.expected=null;this.refresh();}
 refresh(){try{const raw=this.storage.getItem(ECONOMY_KEY);if(raw===null){const s={version:1,coins:300,baits:{worm:15,dough:10,fly:5,minnow:0},consumed:{},sold:{}};this.storage.setItem(ECONOMY_KEY,JSON.stringify(s));const saved=this.storage.getItem(ECONOMY_KEY);if(saved!==JSON.stringify(s))throw Error('경제 기록 저장 확인 실패');this.expected=saved;this.state=s;}else{const s=JSON.parse(raw);if(!valid(s))throw Error('경제 기록 형식 오류');this.state=s;this.expected=raw;}this.error=null;return true;}catch(e){this.error=e.message;this.state=null;return false;}}
 snapshot(){return this.state?clone(this.state):null;}
 _change(fn){if(!this.state||this.error)return {ok:false,reason:'storage'};try{if(this.storage.getItem(ECONOMY_KEY)!==this.expected){this.error='다른 창에서 경제 기록이 변경되었습니다. 새로고침해 주세요.';return {ok:false,reason:'stale'};}const next=clone(this.state),result=fn(next);if(!result.ok)return result;if(!valid(next))throw Error('경제 수치 범위 오류');const encoded=JSON.stringify(next);this.storage.setItem(ECONOMY_KEY,encoded);if(this.storage.getItem(ECONOMY_KEY)!==encoded)throw Error('경제 기록 저장 확인 실패');this.expected=encoded;this.state=next;return result;}catch(e){this.error=e.message;return {ok:false,reason:'storage'};}}
 buy(id){return this._change(s=>{const price=BAIT_PRICES[id];if(!price)return {ok:false,reason:'bait'};if(s.coins<price)return {ok:false,reason:'funds'};s.coins-=price;s.baits[id]+=10;return {ok:true,delta:-price};});}
 consume(id,attempt){return this._change(s=>{if(!ids.includes(id)||typeof attempt!=='string'||!attempt)return {ok:false,reason:'attempt'};if(Object.hasOwn(s.consumed,attempt))return {ok:true,duplicate:true};if(!s.baits[id])return {ok:false,reason:'empty'};s.baits[id]--;s.consumed[attempt]=id;return {ok:true};});}
 canRescue(){return !!this.state&&!this.error&&this.state.coins<20&&ids.every(id=>this.state.baits[id]===0);}
 rescue(){return this._change(s=>{if(s.coins>=20||ids.some(id=>s.baits[id]>0))return {ok:false,reason:'ineligible'};s.baits.worm=5;return {ok:true};});}
 sell(f){return this._change(s=>{if(typeof f?.economyId!=='string'||!f.economyId||f.kind==='item')return {ok:false,reason:'fish'};if(Object.hasOwn(s.sold,f.economyId))return {ok:false,reason:'sold'};const price=salePrice(f);s.coins+=price;s.sold[f.economyId]=price;return {ok:true,delta:price};});}
}
