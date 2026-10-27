import {isActivePlayer} from './domain.js';

export const FORMATIONS = {
  '4-4-2': {label:'Campo · 4–4–2 (11)',lines:[4,4,2]},
  '4-3-3': {label:'Campo · 4–3–3 (11)',lines:[4,3,3]},
  '3-5-2': {label:'Campo · 3–5–2 (11)',lines:[3,5,2]},
  '2-3-1': {label:'Society · 2–3–1 (7)',lines:[2,3,1]},
  '2-2-1': {label:'Society · 2–2–1 (6)',lines:[2,2,1]},
  '2-2': {label:'Futsal · 2–2 (5)',lines:[2,2]}
};
export function formationSlots(formation = '4-4-2') {
  if (!Object.hasOwn(FORMATIONS,formation)) throw Error('Escolha uma formação válida.');
  const lines = FORMATIONS[formation].lines;
  const slots = [{playerId:'',x:50,y:89}];
  lines.forEach((count,row) => {
    const y = Math.round(68-row * (50/Math.max(1,lines.length-1)));
    for (let i=0;i<count;i++) slots.push({playerId:'',x:count === 1 ? 50 : Math.round(12+i*76/(count-1)),y});
  });
  return slots;
}
export function tacticalRoster(players,teamId) {
  return players.filter(p => isActivePlayer(p) && p.teams.includes(teamId)).sort((a,b) => a.name.localeCompare(b.name,'pt-BR'));
}
export function cleanLineup(lineup,roster) {
  const formation = Object.hasOwn(FORMATIONS,lineup?.formation) ? lineup.formation : '4-4-2';
  const slots = formationSlots(formation), seen = new Set(), eligible = new Set(roster.map(p => p.id));
  return {formation,slots:slots.map((fallback,index) => {
    const source = lineup?.slots?.[index];
    const playerId = eligible.has(source?.playerId) && !seen.has(source.playerId) ? source.playerId : '';
    if (playerId) seen.add(playerId);
    return {playerId,x:Number.isFinite(source?.x) ? Math.min(92,Math.max(8,source.x)) : fallback.x,y:Number.isFinite(source?.y) ? Math.min(92,Math.max(8,source.y)) : fallback.y};
  })};
}
export function placePlayer(lineup,playerId,index) {
  if (!lineup.slots[index]) throw Error('Escolha uma posição no campo.');
  const next = structuredClone(lineup), previous = next.slots.findIndex(s => s.playerId === playerId);
  const displaced = next.slots[index].playerId;
  if (previous >= 0) next.slots[previous].playerId = displaced;
  next.slots[index].playerId = playerId;
  return next;
}
