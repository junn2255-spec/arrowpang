// Only presentation follows the existing cast/fishing state machines.
export function leftToolsHidden(castPhase,fishPhase){
 return ['swing','flight','settling','waiting','retrieving'].includes(castPhase)&&fishPhase!=='caught';
}
export function syncLeftTools(menu,castPhase,fishPhase){
 const hidden=leftToolsHidden(castPhase,fishPhase);
 if(hidden&&menu.contains(menu.ownerDocument.activeElement))menu.ownerDocument.activeElement.blur();
 menu.hidden=hidden;
 menu.inert=hidden;
}
