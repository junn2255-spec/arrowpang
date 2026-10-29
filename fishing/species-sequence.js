export const SPECIES_SEQUENCE_KEY='valley-fishing-species-sequence-v1';
export const SPECIES_SEQUENCE=Object.freeze(['crucian','sogari','carp','catfish','eel']);
const NAMES={crucian:'붕어',sogari:'쏘가리',carp:'잉어',catfish:'메기',eel:'장어'};
export function sequenceEnabled(search){return new URLSearchParams(search).get('species-test')==='1';}
export class SpeciesSequenceTest {
 constructor({saved,save=()=>{}}={}){
  const valid=saved?.version===1&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<=5&&Array.isArray(saved.results)&&saved.results.length===saved.index&&saved.results.every((r,i)=>r.speciesId===SPECIES_SEQUENCE[i]&&r.sizeId==='medium'&&['catch','escape'].includes(r.outcome));
  this.index=valid?saved.index:0;this.results=valid?saved.results.map(x=>({...x})):[];this.active=null;this.save=save;
 }
 get done(){return this.index>=SPECIES_SEQUENCE.length;}
 castOptions(){return this.done?{}:{speciesId:SPECIES_SEQUENCE[this.index],sizeId:'medium'};}
 snapshot(){return {version:1,index:this.index,results:this.results.map(x=>({...x}))};}
 event(e){
  const fish=e.fish;
  if(['reset','cast'].includes(e.type))this.active=null;
  if(this.done)return;
  if(e.type==='hook'&&fish?.id===SPECIES_SEQUENCE[this.index]&&fish.sizeId==='medium')this.active={speciesId:fish.id,catchId:fish.catchId};
  if(!['catch','escape'].includes(e.type)||!this.active||fish?.id!==this.active.speciesId||fish?.catchId!==this.active.catchId)return;
  this.results.push({speciesId:this.active.speciesId,sizeId:'medium',outcome:e.type});this.index++;this.active=null;this.save(this.snapshot());
 }
 decorate(text,{phase,fish}={}){if(!this.done&&this.index>0&&['caught','escaped'].includes(phase)&&this.results.at(-1).speciesId===fish?.id)return `[어종 비교 ${this.index}/5 종료 · 다음 ${NAMES[SPECIES_SEQUENCE[this.index]]} 중형]\n${text}`;return this.done?`[어종 비교 한 바퀴 종료 · 이후 일반 랜덤]\n${text}`:`[어종 비교 ${this.index+1}/5 · ${NAMES[SPECIES_SEQUENCE[this.index]]} 중형]\n${text}`;}
}
