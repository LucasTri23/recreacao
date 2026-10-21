import {normalizeRepeatedCity,splitCongregation} from '../public/cities.js';
import {playerId} from '../public/domain.js';
export async function planRepeatedCities(documents) {
  const byId = new Map(documents.map(doc => [doc.name.split('/').at(-1),doc]));
  const plans = [], conflicts = [];
  for (const source of documents) {
    const original = source.fields.congregation?.stringValue;
    if (!original || source.fields.mergedInto?.stringValue) continue;
    const congregation = normalizeRepeatedCity(original).toLocaleUpperCase('pt-BR');
    if (congregation === original.toLocaleUpperCase('pt-BR')) continue;
    const sourceId = source.name.split('/').at(-1), targetId = await playerId(source.fields.name.stringValue,congregation), target = byId.get(targetId);
    if (target && target.fields.mergedInto?.stringValue !== sourceId) { conflicts.push({id:source.name,reason:'existing'}); continue; }
    plans.push({source,target,sourceId,targetId,congregation,city:splitCongregation(congregation).city});
  }
  return {plans,conflicts};
}
