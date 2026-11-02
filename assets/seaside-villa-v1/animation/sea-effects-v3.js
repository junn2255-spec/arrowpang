export function paintSeaMotion(ctx,bg,water,sun,t){
 const rand=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
 const sprite=(im,n,fw,fh,x,y,w,h,a)=>{ctx.globalAlpha=a;ctx.drawImage(im,n%4*fw,Math.floor(n/4)*fh,fw,fh,x,y,w,h)};
 ctx.save();ctx.beginPath();ctx.moveTo(0,214);ctx.lineTo(512,214);ctx.lineTo(512,295);ctx.lineTo(0,363);ctx.closePath();ctx.clip();
 // The horizon stays still; near-water reflections sway a few pixels.
 for(let y=214;y<365;y+=2){const depth=Math.min(1,(y-214)/105),shift=(Math.sin(y*.105-t*1.05)*1.9+Math.sin(y*.043+t*.72)*1.2)*depth,dy=Math.sin(y*.084-t*.91)*.8*depth;ctx.drawImage(bg,0,(y+dy)*2,1024,5,-3+shift,y,518,2.5);}
 for(let i=0;i<12;i++){const seed=i*5.71,depth=rand(seed+2),x=-115+rand(seed)*430+Math.sin(t*.35+i)*8,y=224+depth*100+Math.sin(t*.64+i)*2.8,w=230+depth*200,h=44+depth*48,f=t*2.5+i*1.37,n=Math.floor(f)%8,m=f%1,a=.3+depth*.17;sprite(water,n,512,192,x,y,w,h,a*(1-m));sprite(water,(n+1)%8,512,192,x,y,w,h,a*m);}
 let visible=0;ctx.globalCompositeOperation='screen';
 for(let i=0;i<42;i++){const period=2.4+rand(i+90)*3.1,clock=t+rand(i+101)*period,cycle=Math.floor(clock/period),u=clock/period-cycle;if(u>.78)continue;const p=u/.78,seed=i*29.3+cycle*13.7,x=12+rand(seed+201)*484,y=224+rand(seed+202)*103,depth=(y-224)/103,size=10+depth*23+rand(seed+203)*9,a=Math.sin(p*Math.PI)*(.55+depth*.4),f=p*7,n=Math.min(7,Math.floor(f)),m=f-n;visible++;sprite(sun,n,128,128,x-size/2,y-size/2,size,size,a*(1-m));sprite(sun,Math.min(n+1,7),128,128,x-size/2,y-size/2,size,size,a*m);}
 ctx.restore();return visible;
}
