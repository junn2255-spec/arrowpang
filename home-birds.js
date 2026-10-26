export class HomeBirds{
 constructor(){this.timers=new Set();this.nodes=new Set();this.generation=0;}
 later(fn,ms){const g=this.generation;const id=setTimeout(()=>{this.timers.delete(id);if(g===this.generation)fn();},ms);this.timers.add(id);}
 stop(){this.generation++;this.timers.forEach(clearTimeout);this.timers.clear();this.nodes.forEach(n=>n.remove());this.nodes.clear();}
 start(layer,reduced=false){this.stop();this.layer=layer;this.reduced=reduced;this.schedule();}
 schedule(){this.later(()=>{this.flock();this.schedule();},10000+Math.random()*8000);}
 flock(){const count=2+Math.floor(Math.random()*2),right=Math.random()>.5;for(let i=0;i<count;i++)this.later(()=>{
  const node=document.createElement('div');node.className='home-bird';node.setAttribute('aria-hidden','true');node.style.top=(38+Math.random()*18)+'%';node.style.setProperty('--flight-sign',right?1:-1);node.style.setProperty('--bird-size',(26+Math.random()*9)+'px');node.style.setProperty('--flight-time',this.reduced?'7000ms':'5500ms');
  const sprite=document.createElement('span');sprite.className='bird-sprite';node.append(sprite);this.layer.append(node);this.nodes.add(node);this.later(()=>{node.remove();this.nodes.delete(node);},this.reduced?7000:5500);
 },i*250);}
}
