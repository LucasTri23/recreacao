import {createRequire} from 'node:module';
import {publicTeamPlayer} from '../public/public-team-roster.js';
const require = createRequire(import.meta.url), auth = require('firebase-tools/lib/auth');
const account = auth.getGlobalDefaultAccount();
if (!account) throw Error('Autentique no Firebase CLI.');
const token = await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const headers = {Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'};
const root = 'projects/recreacao-17154/databases/(default)/documents', base = `https://firestore.googleapis.com/v1/${root}`;
const mask = ['name','teams','status','mergedInto'].map(field=>'mask.fieldPaths='+field).join('&');
let page='', projected=0;
do {
  const response = await fetch(`${base}/players?pageSize=200&${mask}${page ? '&pageToken='+encodeURIComponent(page) : ''}`,{headers});
  if (!response.ok) throw Error('Falha de leitura: HTTP '+response.status);
  const data = await response.json();
  const writes = (data.documents || []).map(doc => {
    const f = doc.fields || {};
    const safe = publicTeamPlayer({name:f.name?.stringValue || '',teams:(f.teams?.arrayValue?.values || []).map(v=>v.stringValue),status:f.status?.stringValue,mergedInto:f.mergedInto?.stringValue});
    return {update:{name:`${root}/publicTeamPlayers/${doc.name.split('/').at(-1)}`,fields:{name:{stringValue:safe.name},teams:{arrayValue:{values:safe.teams.map(id=>({stringValue:id}))}},active:{booleanValue:safe.active}}}};
  });
  projected += writes.length;
  if (process.argv.includes('--apply') && writes.length) {
    const saved = await fetch(base+':commit',{method:'POST',headers,body:JSON.stringify({writes})});
    if (!saved.ok) throw Error('Falha ao sincronizar: HTTP '+saved.status);
  }
  page=data.nextPageToken || '';
} while(page);
console.log(JSON.stringify({registros:projected,modo:process.argv.includes('--apply') ? 'aplicado' : 'simulação',camposPublicos:['name','teams','active']}));
