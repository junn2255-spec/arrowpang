import{sound}from'./audio.js';
import{preferences}from'./feedback.js';
const ROOT='assets/rainbow-arrow/';
export class RainbowEffects{
 constructor(){this.nodes=new Set();this.timers=new Set();this.audio=new Set();document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clear();});document.addEventListener('click',()=>{if(!sound.sfx)this.stopAudio();});}
 later(fn,ms){const t=setTimeout(()=>{this.timers.delete(t);fn();},ms);this.timers.add(t);}
 play(name,volume){if(!sound.ready||!sound.sfx||sound.hidden||document.hidden||!sound.AudioType)return;const a=new sound.AudioType(ROOT+'audio/sfx/'+name+'.mp3');a.volume=volume;this.audio.add(a);a.addEventListener('ended',()=>this.audio.delete(a),{once:true});a.play()?.catch(()=>this.audio.delete(a));this.later(()=>{a.pause();this.audio.delete(a);},2400);}
 stopAudio(){for(const a of this.audio)a.pause();this.audio.clear();}
 node(cls,x,y,size){const el=document.createElement('div');el.className=cls;Object.assign(el.style,{left:x+'px',top:y+'px',width:size+'px',height:size+'px'});document.body.append(el);this.nodes.add(el);return el;}
 remove(el){el.getAnimations().forEach(a=>a.cancel());el.remove();this.nodes.delete(el);}
 sprite(x,y,size,row,d='R'){
 const el=this.node('rainbow-atlas',x-size/2,y-size/2,size);el.style.rotate=({R:0,D:90,L:180,U:270}[d])+'deg';
 for(let i=0;i<3;i++)this.later(()=>el.style.backgroundPosition=`${i*50}% ${row*100}%`,i*90);
 const ms=preferences.reduced?160:480;el.animate(preferences.reduced?[{opacity:.8},{opacity:0}]:[{opacity:0,scale:'.55'},{opacity:1,scale:'1.15',offset:.25},{opacity:0,scale:'1.4'}],{duration:ms,fill:'forwards'});this.later(()=>this.remove(el),ms);
 }
 point(board,q){const r=board.getBoundingClientRect(),cell=board.clientWidth/Number(board.dataset.n);return{x:r.left+board.clientLeft+(q.x+.5)*cell,y:r.top+board.clientTop+(q.y+.5)*cell,cell};}
 escape(board,q,d){const p=this.point(board,q);this.play('rainbow-escape',.30);this.sprite(p.x,p.y,p.cell*3,0,d);}
 burst(board,e){const p=this.point(board,e);this.play('rainbow-impact',.27);this.sprite(p.x,p.y,p.cell*3.4,1);this.later(()=>this.play('crystal-shatter',.12),70);this.later(()=>this.play('rainbow-shimmer',.20),260);
 for(const [i,q]of e.removedBlocks.entries())this.later(()=>{const to=this.point(board,q);this.play('rainbow-pop',.36);this.sprite(to.x,to.y,to.cell*2.8,1);
  const target=board.querySelector(`[data-id="${q.id}"]`);target?.animate(preferences.reduced?[{opacity:1},{opacity:0}]:[{filter:'brightness(1)'},{filter:'brightness(3)',scale:'1.2',offset:.3},{opacity:0,scale:'.05',rotate:'35deg'}],{duration:200,fill:'forwards'});
  if(!preferences.reduced){const dx=to.x-p.x,dy=to.y-p.y,beam=this.node('rainbow-beam',p.x,p.y,Math.hypot(dx,dy));beam.style.height='7px';beam.style.rotate=Math.atan2(dy,dx)+'rad';beam.animate([{opacity:0,scale:'0 1'},{opacity:1,scale:'1 1',offset:.3},{opacity:0,scale:'1 .1'}],{duration:400,fill:'forwards'});this.later(()=>this.remove(beam),400);
   for(let j=0;j<14;j++){const particle=this.node('rainbow-particle',to.x,to.y,7+j%3*2);particle.style.background=`hsl(${j*26} 100% 65%)`;const angle=j*2.4,dist=to.cell*(.5+j%4*.3);particle.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:`translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px) rotate(180deg) scale(.1)`}],{duration:500+j%4*70,fill:'forwards'});this.later(()=>this.remove(particle),750);}
  }
 },i*65);
 if(!preferences.reduced)preferences.vibrate([18,35,24]);
 }
 reward(board,e){const p=this.point(board,e),el=this.node('rainbow-reward',Math.max(8,Math.min(innerWidth-150,p.x-75)),p.y-30,150);el.textContent='+15 코인';el.setAttribute('role','status');el.animate(preferences.reduced?[{opacity:1},{opacity:0}]:[{opacity:0,transform:'translateY(5px) scale(.6)'},{opacity:1,transform:'translateY(-20px) scale(1.15)',offset:.2},{opacity:1,transform:'translateY(-34px) scale(1)',offset:.7},{opacity:0,transform:'translateY(-60px) scale(.9)'}],{duration:1200,fill:'forwards'});this.later(()=>this.remove(el),1200);}
 clear(){for(const t of this.timers)clearTimeout(t);this.timers.clear();for(const el of [...this.nodes])this.remove(el);this.stopAudio();}
}
