import {createRequire} from 'node:module';
const require = createRequire(import.meta.url), auth = require('firebase-tools/lib/auth');
const account = auth.getGlobalDefaultAccount();
if (!account) throw Error('Autentique no Firebase CLI.');
const token = await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const headers = {Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'};
const root = 'projects/recreacao-17154/databases/(default)/documents', base = `https://firestore.googleapis.com/v1/${root}`;
async function list(collection,fields) {
  const documents = []; let page = '';
  do {
    const query = new URLSearchParams({pageSize:'200'}); fields.forEach(field => query.append('mask.fieldPaths',field)); if (page) query.set('pageToken',page);
    const response = await fetch(`${base}/${collection}?${query}`,{headers});
    if (!response.ok) throw Error(`Leitura recusada: ${collection}, HTTP ${response.status}`);
    const data = await response.json(); documents.push(...(data.documents || [])); page = data.nextPageToken || '';
  } while (page);
  return documents;
}
const players = await list('players',['goalkeeper']);
const goalkeepers = new Set(players.filter(p => p.fields?.goalkeeper?.booleanValue === true).map(p => p.name.split('/').at(-1)));
const squads = await list('gameSquads',['draftId','weekId','teamId']);
const published = new Set(squads.map(s => [s.fields?.weekId?.stringValue,s.fields?.teamId?.stringValue,s.fields?.draftId?.stringValue].join('|')));
const entries = await list('gameEntries',['playerId','draftId','weekId','teamId','goalkeeper']);
const writes = entries.filter(e => {
  const f = e.fields || {};
  return !('goalkeeper' in f) && goalkeepers.has(f.playerId?.stringValue) && published.has([f.weekId?.stringValue,f.teamId?.stringValue,f.draftId?.stringValue].join('|'));
}).map(e => ({update:{name:e.name,fields:{goalkeeper:{booleanValue:true}}},updateMask:{fieldPaths:['goalkeeper']},currentDocument:{updateTime:e.updateTime}}));
if (process.argv.includes('--apply')) for (let offset=0;offset<writes.length;offset+=100) {
  const response = await fetch(base+':commit',{method:'POST',headers,body:JSON.stringify({writes:writes.slice(offset,offset+100)})});
  if (!response.ok) throw Error('Atualização recusada: HTTP '+response.status);
}
console.log(JSON.stringify({modo:process.argv.includes('--apply') ? 'aplicado' : 'simulação',goleirosEmListasPublicadas:writes.length,camposAlterados:['goalkeeper']}));
