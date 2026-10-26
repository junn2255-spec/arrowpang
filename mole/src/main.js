import {mountMoleGame} from './game.js';
import {shouldOpenMoleGame} from './engine.js';
import {demoWallet} from './reward.js';
const wallet=demoWallet(localStorage);
const requestedStage=Number(new URLSearchParams(location.search).get('stage'));
const stage=shouldOpenMoleGame(requestedStage)?requestedStage:5;
mountMoleGame(document.querySelector('#game'),{stage,runId:'preview-session',preview:true,balance:wallet.balance(),credit:wallet.credit});
