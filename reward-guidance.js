const Y='assets/home10/',I='assets/interior/';
const icons={walls:[Y+'04-house-2-walls-fixed.webp'],dog:[Y+'10-puppy-4x3.webp','puppy'],roof:[Y+'05-house-3-roof-fixed.webp'],flowers:[Y+'11a-flowers-left.webp'],greenRoof:[Y+'06-house-6-green-roof.webp'],expanded:[Y+'07-house-7-expanded.webp'],benchFence:[Y+'11c-bench.webp'],pond:[Y+'12-pond.webp'],fish:[Y+'13-goldfish-swim-3x2.webp','fish'],entry:[I+'01-room-empty.webp'],sofa:[I+'02-sofa.webp'],sink:[I+'03-sink-corner.webp'],table:[I+'04-table-stools.webp'],fireplace:[I+'05-fireplace-unlit.webp'],ramen:[I+'06-ramen-stove.webp'],grill:[I+'07-steak-plate.webp'],lights:[I+'09-cross-lights.webp'],bird:[I+'canary-4x2.webp','bird']};
export function renderRewardGuidance(node,next,coins){
 const key=JSON.stringify([next?.key,next?.name,next?.cost,coins>=next?.cost]);if(node.dataset.guidanceKey===key)return;node.dataset.guidanceKey=key;node.classList.add('reward-guidance-content');
 if(!next){node.classList.remove('can-build');node.innerHTML='<span class="guidance-complete">집 꾸미기 완성!</span><span class="guidance-action">미션과 꾸미기를 계속 즐겨요</span>';return;}
 const [src,sprite]=icons[next.key]||icons.walls,ready=coins>=next.cost;
 const icon=sprite?`<span class="guidance-sprite ${sprite}" style="background-image:url('${src}')"></span>`:`<img src="${src}" alt="">`;
 const action=ready?(next.key==='dog'?'코인으로 데려오세요':'코인으로 건설하세요'):'코인을 모으세요.';
 node.innerHTML=`<span class="guidance-row"><span class="guidance-icon" aria-hidden="true">${icon}<span class="guidance-sparkles">✦</span></span><span class="guidance-copy"><span class="guidance-reward-name">${next.name}</span><span class="guidance-action"><b>${next.cost.toLocaleString('ko-KR')}</b><span>${action}</span></span></span></span>`;
 node.classList.toggle('can-build',ready);
}
