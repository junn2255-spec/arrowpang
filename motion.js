export const motionPlan=result=>(result.events??[]).map(e=>({...e,duration:e.duration??(e.type==='hit'?(e.broken?6000/14:250):230)}));
