const vectors={R:[1,0],D:[0,1],L:[-1,0],U:[0,-1]};
export const angles={R:0,D:90,L:180,U:270};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// Pure timeline, shared by the renderer and deterministic lifetime tests.
export function escapePlan({from,d,n,cell,margin=cell}){
 const [dx,dy]=vectors[d],start={x:(from.x+.5)*cell,y:(from.y+.5)*cell};
 const edge=d==='R'||d==='D'?n*cell:0;
 const axis=dx?start.x:start.y,sign=dx||dy,room=Math.max(2,margin);
 const distance=(edge-axis)*sign+room*.5;
 const flight=clamp(220+distance/cell*17,230,270);
 // First visible edge crossing: before any adaptive compact-screen scaling.
 const crossing=flight*Math.sqrt(Math.max(0,((edge-axis)*sign-(cell-6)*.5)/distance));
 const fade=70,actionEnd=flight+fade,total=flight+300;
 return {start,d,dx,dy,cell,edge,room,distance,flight,crossing,fade,actionEnd,total,endScale:Math.min(1,room*.8/cell),trailCount:5,sparkCount:14};
}
export function escapeFrame(p,t){
 const progress=clamp(t/p.flight,0,1),travel=progress*progress;
 const after=clamp((t-p.crossing)/(p.flight-p.crossing),0,1);
 return {x:p.start.x+p.dx*p.distance*travel,y:p.start.y+p.dy*p.distance*travel,scale:1+(p.endScale-1)*after,opacity:t<=p.flight?1:clamp(1-(t-p.flight)/p.fade,0,1)};
}
// Visual-only disappearance overlaps the existing flight; gameplay callbacks stay unchanged.
export function exitVisualFrame(p,t,reduced=false){
 const f=escapeFrame(p,t),start=p.flight-(reduced?0:100);
 const elapsed=Math.max(0,t-start),fade=clamp((t-p.flight)/150,0,1);
 // The existing gutter travel already counts toward the requested extra distance.
 const extra=reduced?0:Math.max(0,p.cell*.4-p.room*.5)*fade;
 return {x:f.x+p.dx*extra,y:f.y+p.dy*extra,
  scale:reduced?1:1+.2*clamp(elapsed/100,0,1),opacity:1-fade};
}
// Reuse existing star slots behind the moving block; never add a second effect.
export function wakeFrame(plan,t,i,count,reduced=false){
 const head=escapeFrame(plan,Math.min(t,plan.flight)),back=plan.cell*(.18+.92*i/Math.max(1,count-1)),side=Math.sin(i*2.4)*plan.cell*.16;
 const burst=reduced?0:clamp((t-plan.actionEnd)/90,0,1),fan=Math.sin(i*2.4)*plan.cell*.22*burst;
 const life=t>=plan.total?0:clamp(1-(t-plan.flight)/(300-(i%4)*18),0,1);
 const starEnd=plan.flight+300-(i%4)*18;
 const opacity=t<plan.crossing?0:reduced?life*(.7+.3*Math.sin(i+t/75)**2):clamp((starEnd-t)/60,0,1);
 return {x:head.x-plan.dx*(back+plan.cell*.2*burst)-plan.dy*(side+fan),y:head.y-plan.dy*(back+plan.cell*.2*burst)+plan.dx*(side+fan),opacity,scale:(.7+.3*(i%3)/2)*(.6+.4*life)*(1+.5*burst)};
}
export class EscapeEffects{
 constructor(doc=globalThis.document,schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=id=>clearTimeout(id)){this.doc=doc;this.schedule=schedule;this.unschedule=unschedule;this.timers=new Set();this.generation=0;this.layer=null;this.batches=[];this.pool=[];}
 release(batch){batch.active=false;for(const id of batch.timers){this.unschedule(id);this.timers.delete(id);}batch.timers.clear();for(const e of batch.slot.nodes){e.hidden=true;e.style.cssText="";e.style.transform="";e.style.opacity=0;e.style.left=e.style.top="";e.innerHTML="";for(const k of Object.keys(e.dataset))delete e.dataset[k];}batch.slot.busy=false;batch.slot.layer.remove();this.batches=this.batches.filter(b=>b!==batch);if(this.layer===batch.slot.layer)this.layer=null;}
 clear(){this.generation++;for(const batch of [...this.batches])this.release(batch);this.layer=null;}
 run({board,element,from,d,n,onBoundary,onComplete,last=false,bright=false,reduced=false}){
  const token=this.generation,doc=this.doc;if(this.batches.length>=2)this.release(this.batches[0]);
  let slot=this.pool.find(p=>!p.busy);if(!slot){slot={layer:doc.createElement('div'),nodes:[],busy:false};this.pool.push(slot);}slot.busy=true;let nodeIndex=0;
  for(const e of slot.nodes)e.hidden=true;
  const batch={slot,timers:new Set(),active:true};this.batches.push(batch);
  const make=cls=>{let e=slot.nodes[nodeIndex];if(!e){e=doc.createElement('div');slot.nodes.push(e);slot.layer.append(e);}nodeIndex++;e.hidden=false;e.className=cls;e.style.opacity=0;return e;};
  const rect=board.getBoundingClientRect(),cell=board.clientWidth/n;
  const left=rect.left+(board.clientLeft||0),top=rect.top+(board.clientTop||0),width=board.clientWidth;
  const guide=doc.querySelector('.guide')?.getBoundingClientRect(),status=doc.querySelector('.status-row')?.getBoundingClientRect();
  const viewW=globalThis.innerWidth??doc.documentElement?.clientWidth??(left+width+cell),viewH=globalThis.innerHeight??(top+width+cell);
  // Fit only inside the board's surrounding gutter, never across HUD/buttons.
  const margins={L:Math.max(2,Math.min(cell,left-2)),R:Math.max(2,Math.min(cell,viewW-left-width-2)),U:Math.max(2,Math.min(cell,top-(guide?.bottom??0)-2)),D:Math.max(2,Math.min(cell,(status?.top??viewH)-top-width-2))};
  const plan=escapePlan({from,d,n,cell,margin:margins[d]});
  const layer=slot.layer;layer.className='escape-effects';layer.setAttribute('aria-hidden','true');
  Object.assign(layer.style,{left:(left-margins.L)+'px',top:(top-margins.U)+'px',width:(width+margins.L+margins.R)+'px',height:(width+margins.U+margins.D)+'px'});
  doc.body.append(layer);this.layer=layer;element.style.visibility='hidden';
  const enhanced=last||bright,palette={R:['#55bfff','#f5feff'],D:['#ff9a54','#ffb5d2','#ffdf79'],L:['#b5ef66','#fff28a'],U:['#ffd768','#fffdf1']}[d],color=palette[0];layer.style.setProperty('--trail-color',color);
  const trails=Array.from({length:reduced?2:enhanced?6:plan.trailCount},()=>make('escape-trail'));
  const proxy=make('block escape-proxy');proxy.dataset.dir=d;proxy.dataset.rainbow=element.dataset.rainbow??'false';proxy.innerHTML='<span></span>';proxy.style.width=proxy.style.height=cell+'px';
  const sparks=Array.from({length:reduced?2:enhanced?18:plan.sparkCount},(_,i)=>{const e=make('escape-spark');e.style.setProperty('--particle-color',palette[i%palette.length]);return e;});
  const lines=Array.from({length:reduced?0:enhanced?5:4},()=>make('escape-line')),ring=make('escape-ring'),finish=make('escape-finish'),edgeGlow=make('escape-edge'),big=make('escape-big');
  const boundary={x:plan.dx?plan.edge:plan.start.x,y:plan.dy?plan.edge:plan.start.y};
  const paint=t=>{
   const f=exitVisualFrame(plan,t,reduced);proxy.style.transform=`translate(${f.x+margins.L}px,${f.y+margins.U}px) translate(-50%,-50%) scale(${f.scale})`;proxy.style.opacity=f.opacity;
   trails.forEach((e,i)=>{const age=(i+1)*23,at=Math.min(t,plan.flight)-age,old=escapeFrame(plan,Math.max(0,at));const life=clamp(1-(t-plan.flight)/(300-i*22),0,1),scale=(1-i*.11)*.88;e.style.width=cell*1.3+'px';e.style.height=cell*.46+'px';e.style.opacity=at<0?0:((reduced?.10:enhanced?.76:.65)-i*.055)*life;e.style.transform=`translate(${old.x+margins.L}px,${old.y+margins.U}px) translate(-50%,-50%) rotate(${angles[d]}deg) scale(${scale})`;});
   const age=(t-plan.crossing)/300,bx=boundary.x+margins.L,by=boundary.y+margins.U;
   sparks.forEach((e,i)=>{const f=wakeFrame(plan,t,i,sparks.length,reduced);e.style.width=e.style.height=(1.5*Math.min(reduced?12:22,cell*(reduced?.2:.36)))+'px';e.style.opacity=f.opacity*(reduced?.35:1);e.style.transform=`translate(${f.x+margins.L}px,${f.y+margins.U}px) translate(-50%,-50%) rotate(${i*31+Math.max(0,age)*100}deg) scale(${f.scale})`;});

   big.style.width=big.style.height=cell*.6+'px';big.style.opacity=reduced||age<0||age>.24?0:1-age/.24;big.style.transform=`translate(${bx}px,${by}px) translate(-50%,-50%) scale(${.7+Math.max(0,age)})`;

   lines.forEach((e,i)=>{const at=t-(i+1)*16,old=escapeFrame(plan,Math.max(0,at)),side=(i-(lines.length-1)/2)*cell*.08;e.style.width=cell*.28+'px';e.style.opacity=at<0||age<0||age>1?0:(1-age)*.65;e.style.transform=`translate(${old.x+margins.L-plan.dy*side}px,${old.y+margins.U+plan.dx*side}px) translate(-50%,-50%) rotate(${angles[d]}deg)`;});
   ring.style.width=ring.style.height=cell*.48+'px';ring.style.opacity=reduced||age<0||age>.6?0:(1-age/.6)*.8;ring.style.transform=`translate(${bx}px,${by}px) translate(-50%,-50%) scale(${.3+clamp(age,0,1)*1.2})`;
   const flashAge=(t-plan.actionEnd)/65;finish.style.width=finish.style.height=cell*.48+'px';finish.style.opacity=reduced||flashAge<0||flashAge>1?0:(1-flashAge)*.85;finish.style.transform=`translate(${f.x+margins.L-plan.dx*cell*.2}px,${f.y+margins.U-plan.dy*cell*.2}px) translate(-50%,-50%) scale(${.65+clamp(flashAge,0,1)*.5})`;
   edgeGlow.style.width=(plan.dx?3:cell*.65)+'px';edgeGlow.style.height=(plan.dy?3:cell*.65)+'px';edgeGlow.style.opacity=reduced||t<plan.crossing-55||t>plan.crossing+25?0:.65;edgeGlow.style.transform=`translate(${bx}px,${by}px) translate(-50%,-50%)`;

  };
  const later=(fn,ms)=>{const id=this.schedule(()=>{this.timers.delete(id);batch.timers.delete(id);if(token===this.generation&&batch.active)fn();},ms);this.timers.add(id);batch.timers.add(id);};
  paint(0);for(let t=16;t<plan.total;t+=16)later(()=>paint(t),t);
  for(const t of [plan.flight-100,plan.flight,plan.flight+150])later(()=>paint(t),t);
  later(onBoundary,plan.crossing);
  if(!last)later(()=>{paint(plan.actionEnd);onComplete();},plan.actionEnd);
  later(()=>{paint(plan.total);this.release(batch);if(last)onComplete();},plan.total);
  return plan;
 }
}
