import {REWARD} from './engine.js';
export class RewardGate {
  constructor({transactionId,credit}) {this.transactionId=transactionId;this.credit=credit;this.pending=null;this.result=null;}
  claim({success,stage,score}) {
    if(!success)return Promise.resolve({awarded:false,coins:0});
    if(this.result)return Promise.resolve(this.result);
    if(this.pending)return this.pending;
    this.pending=Promise.resolve().then(()=>this.credit({transactionId:this.transactionId,coins:REWARD,stage,score,source:'whack-a-mole'}))
      .then(result=>{if(!result || result.ok!==true)throw new Error('보상 저장을 확인하지 못했습니다.');this.result={...result,awarded:true,coins:REWARD};return this.result;})
      .finally(()=>{this.pending=null;});
    return this.pending;
  }
}
// Standalone preview only. The host game's wallet must implement the same
// transactionId check atomically on its authoritative coin store.
export function demoWallet(storage) {
  const key='arrowpang-mole-preview-wallet-v1';
  function read(){try{return JSON.parse(storage.getItem(key))||{balance:0,transactions:[]};}catch{return {balance:0,transactions:[]};}}
  return {
    balance:()=>read().balance,
    credit:async({transactionId,coins})=>{
      const wallet=read();
      if(!wallet.transactions.includes(transactionId)){wallet.balance+=coins;wallet.transactions.push(transactionId);storage.setItem(key,JSON.stringify(wallet));}
      return {ok:true,balance:wallet.balance};
    }
  };
}
