import{LEGACY_STAGES,STAGE_ORDER}from'./stage-identity.js';
export function migrateSave(v){
 if(v.stageIds===1)return v;
 const match=key=>LEGACY_STAGES.find(s=>s.key===key||s.id===key);
 for(const [key,done]of Object.entries(v.cleared??{})){const s=match(key);if(s&&done)v.cleared[s.id]=true;}
 for(const paid of Object.values(v.paid??{})){const s=match(paid.stage);if(s)paid.stage=s.id;}
 const p=v.progress,s=p&&match(p.stageKey);
 if(s){p.stageKey=s.id;p.index=STAGE_ORDER.indexOf(s.id);p.level??=structuredClone(s.level);p.level.id=s.id;}
 v.stageIds=1;return v;
}
