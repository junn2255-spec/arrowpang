import {mountMoleGame} from './game.js';
import {shouldOpenMoleGame} from './engine.js';
export {shouldOpenMoleGame};
/** Call AFTER the host has saved the stage clear. credit must atomically
 * deduplicate transactionId on the host's authoritative wallet, then return
 * {ok:true,balance:number}. Supply a stable runId across retries and reloads.
 */
export function afterStageClear(stage,{runId,credit,haptic,musicEnabled=true,sfxEnabled=true,reduceEffects=false,onComplete=()=>{}}={}){
  if(!shouldOpenMoleGame(stage))return Promise.resolve({skipped:true,stage});
  if(!runId||typeof credit!=='function')return Promise.reject(Error('본게임 runId와 credit 함수를 연결해주세요.'));
  return new Promise((resolve,reject)=>{
    const host=document.createElement('div');host.className='mole-overlay-host';Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'100000',display:'grid',placeItems:'center',background:'#172d23',overflow:'auto'});document.body.append(host);
    const shadow=host.attachShadow({mode:'open'}),css=document.createElement('link'),container=document.createElement('div');css.rel='stylesheet';css.href=new URL('./style.css',import.meta.url);Object.assign(container.style,{width:'100%',height:'100%',minWidth:'0',minHeight:'0',display:'grid',placeItems:'center'});shadow.append(css,container);
    try{mountMoleGame(container,{stage,runId,credit,haptic,musicEnabled,sfxEnabled,reduceEffects,onExit:result=>{host.remove();try{onComplete(result);}finally{resolve(result);}}});}
    catch(e){host.remove();reject(e);}
  });
}
