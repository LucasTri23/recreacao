import {playerId} from '../public/domain.js';
export const expandBh = value => String(value || '').replace(/\bBH\s*$/i,'BELO HORIZONTE');
export async function planBh(documents) {
  const byId = new Map(documents.map(d => [d.name.split('/').at(-1),d]));
  const plans = [], conflicts = [];
  for (const source of documents) {
    const f = source.fields;
    if (f.mergedInto?.stringValue || !/\bBH\s*$/i.test(f.congregation?.stringValue || '')) continue;
    const congregation = expandBh(f.congregation.stringValue);
    if (congregation.length > 120) { conflicts.push({id:source.name,reason:'length'}); continue; }
    const sourceId = source.name.split('/').at(-1), targetId = await playerId(f.name.stringValue,congregation);
    const target = byId.get(targetId);
    if (target && target.fields.mergedInto?.stringValue !== sourceId) { conflicts.push({id:source.name,reason:'existing'}); continue; }
    plans.push({source,target,sourceId,targetId,congregation});
  }
  return {plans,conflicts};
}
