import {move} from './engine.js';
export const zoneDirections=['U','R','D','L'];
// One full-size floor illustration only; actual entry updates it. Never an entrance restriction.
export function zoneEntries(blocks,rocks,n,zones,zone){
 const occupant=blocks.find(b=>b.x===zone.x&&b.y===zone.y);if(occupant)return [{R:'U',D:'R',L:'D',U:'L'}[occupant.d]];
 const dirs=new Set();for(const b of blocks){const r=move(blocks,b.id,n,rocks,zones);for(const e of r.events)if(e.type==='move'&&!e.exit&&e.x===zone.x&&e.y===zone.y)dirs.add(e.d);}
 return [[...dirs][0]??'U'];
}
// A single upright clockwise symbol, independent of entry direction.
export function zoneMarkup(dirs){return '<img src="assets/rotation-stone/rotation-limestone-256.webp" alt="" data-rotation="clockwise-90">';}
