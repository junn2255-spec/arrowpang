export const ART={
  introReward:['introReward',90,110,2000,490],
  pause:['approvedControls',150,130,475,380],restart:['approvedControls',625,130,485,380],play:['ui',555,47,147,140],
  next:['ui',70,212,147,135],coin:['ui',312,214,135,134],clock:['ui',560,214,140,134],
  counter:['ui',25,380,230,95],reward:['ui',267,387,229,85],banner:['ui',500,380,255,93],
  logo:['approvedHeader',50,48,1155,607],timeCircle:['approvedHeader',50,660,570,527],scoreCircle:['approvedHeader',627,660,580,527],gaugeFrame:['approvedControls',40,593,1175,180],gaugeFill:['approvedControls',92,855,1072,125],gaugeJewel:['approvedControls',540,1024,175,175],instructions:['popups',445,94,265,228],
  success:['popups',50,450,280,245],retry:['popups',435,450,280,245]
};
export const art=(name,classes='')=>`<span class="art ${classes}" data-art="${name}" aria-hidden="true"></span>`;
export function createArtTextures(images){
  return Object.fromEntries(Object.entries(ART).map(([name,[key,x,y,w,h]])=>{
    const c=document.createElement('canvas');c.width=w;c.height=h;
    c.getContext('2d').drawImage(images[key],x,y,w,h,0,0,w,h);
    return [name,c.toDataURL()];
  }));
}
export function applyArt(root,textures){for(const el of root.querySelectorAll('[data-art]')){const url=textures[el.dataset.art];if(url)el.style.backgroundImage=`url("${url}")`;}}
