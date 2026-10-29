/** Approved original branding plus v12 user-uploaded control atlas. */
export const UI_ATLAS_SIZE=Object.freeze({width:1548,height:1016});
export const UI_SPRITES=Object.freeze({logo:[30,15,645,282],weather:[696,147,404,139],sound:[1115,147,150,139],useBait:[253,645,323,164]});
export const CONTROL_ATLAS_SIZE=Object.freeze({width:1536,height:1024});
export const CONTROL_SPRITES=Object.freeze({cast:[14,90,384,384],retrieve:[398,90,384,384],hook:[768,90,384,384],lift:[1136,90,384,384],bag:[148,520,384,364],bait:[573,520,384,364],rig:[997,520,384,364]});
function sprite(document,name,modern=false){const el=document.createElement('span');el.className=`asset-face asset-${name}${modern?' control-v12':''}`;el.setAttribute('aria-hidden','true');const[x,y,w,h]=(modern?CONTROL_SPRITES:UI_SPRITES)[name],size=modern?CONTROL_ATLAS_SIZE:UI_ATLAS_SIZE;el.style.backgroundImage=`url('assets/${modern?'fishing-controls-v12.webp':'fishing-ui-atlas.webp'}')`;el.style.backgroundSize=`${size.width/w*100}% ${size.height/h*100}%`;el.style.backgroundPosition=`${x/(size.width-w)*100}% ${y/(size.height-h)*100}%`;return el;}
export function mountUIArt(document){const game=document.querySelector('#game');if(!game||game.classList.contains('atlas-ready'))return;
 for(const[sel,name]of[['.wood-sign','logo'],['.weather','weather'],['#sound','sound']])document.querySelector(sel)?.prepend(sprite(document,name));
 for(const[sel,name]of[['#bag','bag'],['#bait','bait'],['#equipment','rig'],['#cast','cast'],['#cast','retrieve'],['#cast','hook'],['#cast','lift']])document.querySelector(sel)?.prepend(sprite(document,name,true));
 game.classList.add('atlas-ready','controls-v12');
}
