let serial=0;
export function coinAwardArt(node,amount){
 const id='coin-award-gradient-'+(++serial),label='+'+amount+'코인';
 const glow=new Image();glow.className='coin-award-glow';glow.src='assets/coin-award-v198/gold-burst.webp';glow.alt='';glow.draggable=false;
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('class','coin-award-lettering');svg.setAttribute('viewBox','0 0 680 210');svg.setAttribute('aria-hidden','true');
 svg.innerHTML=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fffde1"/><stop offset="22%" stop-color="#fff581"/><stop offset="50%" stop-color="#ffdf00"/><stop offset="78%" stop-color="#ffb000"/><stop offset="100%" stop-color="#ff8500"/></linearGradient></defs>`;
 const size=label.length>6?100:label.length>5?115:132;
 for(const layer of [{y:159,stroke:'#421800',width:22,fill:'#572100'},{y:147,stroke:'#803700',width:15,fill:`url(#${id})`}]){const text=document.createElementNS(ns,'text');text.setAttribute('x','340');text.setAttribute('y',layer.y);text.setAttribute('text-anchor','middle');text.setAttribute('stroke',layer.stroke);text.setAttribute('stroke-width',layer.width);text.setAttribute('stroke-linejoin','round');text.setAttribute('paint-order','stroke fill');text.setAttribute('fill',layer.fill);text.style.setProperty('font-family','User Paperlogy ExtraBold, sans-serif','important');text.style.setProperty('font-weight','800','important');text.style.setProperty('font-size',size+'px','important');text.textContent=label;svg.append(text);}
 node.replaceChildren(glow,svg);node.dataset.amount=String(amount);
}
