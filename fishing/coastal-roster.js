export const COASTAL_SEQUENCE=Object.freeze(['striped-beakfish','crucian','striped-beakfish','sea-bass','crucian','striped-beakfish']);
export function nextCoastalSpecies(caught=[]){const totals={};for(const id of caught)totals[id]=(totals[id]||0)+1;const seen={};for(const id of COASTAL_SEQUENCE){seen[id]=(seen[id]||0)+1;if(seen[id]>(totals[id]||0))return id;}return null;}
