export const PARTICLE_CAP=24;
export function stonePlan({hp,cell,d}){
 const hit=3-hp,count=hit===3?20:hit===2?12:10,[dx,dy]={R:[1,0],D:[0,1],L:[-1,0],U:[0,-1]}[d];
 return {hit,count,bigCount:3,push:cell*[0,.045,.075,.10][hit],dx,dy,flash:65,vibration:[0,8,14,28][hit],dust:hit===3?3:2,particles:Array.from({length:count},(_,i)=>{const angle=i*2.3999632297,range=cell*(.5+.5*((i*7)%11)/10);return {dx:Math.cos(angle)*range,dy:Math.sin(angle)*range,arc:cell*(.22+.16*(i%3)/2),turn:(i%2?1:-1)*(130+i*23),duration:hit===3?410:hit===2?360:300,big:i<3,size:cell*(i<3?.55:.23+(i%3)*.04),asset:i%4};})};
}
export function shardFrame(p,t){return {x:p.dx*t,y:p.dy*t-4*p.arc*t*(1-t),rotation:p.turn*t,opacity:1-Math.pow(t,3)};}
