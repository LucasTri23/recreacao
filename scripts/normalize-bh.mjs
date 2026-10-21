import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {planBh} from './bh-plan.mjs';
const require = createRequire(import.meta.url), auth = require('firebase-tools/lib/auth');
const account = auth.getGlobalDefaultAccount();
if (!account) throw Error('Autentique no Firebase CLI.');
const token = await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const headers = {Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'};
const root = 'projects/recreacao-17154/databases/(default)/documents';
const base = `https://firestore.googleapis.com/v1/${root}`;
async function list(collection) {
  let page = '', all = [];
  do {
    const response = await fetch(`${base}/${collection}?pageSize=200${page ? '&pageToken='+encodeURIComponent(page) : ''}`,{headers});
    if (!response.ok) throw Error(`Leitura ${collection}: HTTP ${response.status}`);
    const data = await response.json(); all.push(...(data.documents || [])); page = data.nextPageToken || '';
  } while (page);
  return all;
}
const documents = await list('players');
const {plans,conflicts} = await planBh(documents);
console.log(JSON.stringify({cadastrosParaPadronizar:plans.length,conflitosPreservados:conflicts.length,modo:process.argv.includes('--apply') ? 'aplicar' : 'simulação'}));
if (process.argv.includes('--apply')) {
const entries = await list('gameEntries');
const text = value => ({stringValue:value});
function update(name,fields,condition,stamp = true) {
  return {update:{name,fields},currentDocument:condition,...(stamp ? {updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]} : {})};
}
let changed = 0, skipped = 0, linkedEntries = 0;
for (const plan of plans) {
  const {source,target,sourceId,targetId,congregation} = plan;
  const original = source.fields, eventId = 'bh-normalization-'+randomUUID();
  const linked = entries.filter(doc => doc.fields.playerId?.stringValue === sourceId);
  if (linked.length > 490) { skipped++; continue; }
  const writes = [
    update(`${root}/players/${targetId}`,{...original,congregation:text(congregation),city:text('Belo Horizonte'),lastEvent:text(eventId)},target ? {updateTime:target.updateTime} : {exists:false}),
    update(source.name,{...original,teams:{arrayValue:{values:[]}},mergedInto:text(targetId),lastEvent:text(eventId)},{updateTime:source.updateTime}),
    {update:{name:`${root}/events/${eventId}`,fields:{kind:text('edit'),actor:text('maintenance:bh-normalization'),actorName:text(`Administração (${account.user.email})`),sourceId:text(sourceId),playerId:text(targetId),name:original.name,previousName:original.name,previousCongregation:original.congregation,congregation:text(congregation),teams:original.teams,detail:text('Padronização da cidade: BH → BELO HORIZONTE. Vínculos e situação preservados.')}},currentDocument:{exists:false},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]},
    ...linked.map(doc => update(doc.name,{...doc.fields,playerId:text(targetId)},{updateTime:doc.updateTime},false))
  ];
  const response = await fetch(base+':commit',{method:'POST',headers,body:JSON.stringify({writes})});
  if (!response.ok) { if ([400,409,412].includes(response.status)) { skipped++; continue; } throw Error('Gravação: HTTP '+response.status); }
  changed++; linkedEntries += linked.length;
}
console.log(JSON.stringify({cadastrosAtualizados:changed,referenciasDeEscalacoesPreservadas:linkedEntries,naoAlterados:skipped+conflicts.length}));
}
