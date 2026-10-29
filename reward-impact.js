let layer=null,animations=[];
export function clearRewardImpact(){for(const a of animations)a.cancel();animations=[];layer?.remove();layer=null;}
export function rewardImpact(reduced=false){
 clearRewardImpact();if(reduced)return;
 const panel=document.querySelector('#reward-panel'),target=panel?.querySelector('.clear-amount strong')||panel;if(!target)return;
 layer=document.createElement('div');layer.id='reward-impact-layer';layer.setAttribute('aria-hidden','true');Object.assign(layer.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'250',overflow:'hidden'});document.body.append(layer);
 const r=target.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,w=innerWidth;
 const add=(src,size)=>{const e=document.createElement('img');e.src=src;Object.assign(e.style,{position:'absolute',width:size+'px',height:size+'px',objectFit:'contain',left:'0',top:'0',filter:'drop-shadow(0 2px 3px #8b4d0060)'});layer.append(e);return e};
 // Four separated coins follow a smooth arc, with no stacked waiting sprites.
 for(let i=0;i<4;i++){
  const size=i===3?64:56,sx=Math.min(w-size-12,r.right+70),sy=Math.max(24,r.top-210),ex=x-size/2,ey=y-size/2;
  const coin=add('assets/garden-ui-v1/03-coin-icon.webp',size);coin.style.opacity='0';
  const frames=Array.from({length:13},(_,n)=>{const t=n/12,px=sx+(ex-sx)*t,py=sy+(ey-sy)*t-65*Math.sin(Math.PI*t);return{offset:t,transform:'translate('+px+'px,'+py+'px) rotate('+(-18+90*t)+'deg) scale('+(1-.32*t)+')',opacity:t<.08?t/.08:t>.88?(1-t)/.12:1};});
  animations.push(coin.animate(frames,{duration:560,delay:i*160,fill:'none',easing:'linear'}));
 }
 const ring=document.createElement('div');Object.assign(ring.style,{position:'absolute',left:(x-42)+'px',top:(y-42)+'px',width:'84px',height:'84px',border:'5px solid #ffe77c',borderRadius:'50%',boxShadow:'0 0 28px #ffcf21,inset 0 0 20px #fff0a0'});layer.append(ring);animations.push(ring.animate([{transform:'scale(.25)',opacity:0},{offset:.15,opacity:1},{transform:'scale(2)',opacity:0}],{delay:1040,duration:480,fill:'both',easing:'ease-out'}));
 for(let i=0;i<12;i++){const size=10+(i%3)*5,star=add('assets/ui/sparkle-1.webp',size),angle=i*Math.PI*2/12,d=45+(i%3)*20;animations.push(star.animate([{transform:`translate(${x}px,${y}px) scale(.15)`,opacity:0},{offset:.12,opacity:1},{transform:`translate(${x+Math.cos(angle)*d}px,${y+Math.sin(angle)*d}px) rotate(140deg) scale(.2)`,opacity:0}],{delay:1040+i%3*20,duration:480,fill:'both',easing:'ease-out'}));}
 animations.push(panel.animate([{transform:'scale(1)',filter:'brightness(1)'},{offset:.2,transform:'scale(1.035)',filter:'brightness(1.16)'},{offset:.5,transform:'scale(.99)',filter:'brightness(1.04)'},{transform:'scale(1)',filter:'brightness(1)'}],{delay:1040,duration:400,easing:'ease-out'}));
 const current=layer;setTimeout(()=>{if(layer===current)clearRewardImpact()},1800);
}
