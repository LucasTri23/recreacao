import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth');
const account = auth.getGlobalDefaultAccount();
if (!account) throw Error('Entre no Firebase CLI antes de sincronizar.');
const token = await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const headers = {Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'};
const root = 'projects/recreacao-17154/databases/(default)/documents';
const endpoint = `https://firestore.googleapis.com/v1/${root}`;
let page = '', count = 0;
do {
  const response = await fetch(`${endpoint}/events?pageSize=200${page ? '&pageToken='+encodeURIComponent(page) : ''}`,{headers});
  if (!response.ok) throw Error('Falha ao ler histórico: HTTP '+response.status);
  const result = await response.json();
  const writes = (result.documents || []).filter(doc => doc.fields.at).map(doc => {
    const f = doc.fields;
    const text = value => ({stringValue:value?.stringValue || ''});
    return {update:{name:`${root}/publicEvents/${doc.name.split('/').at(-1)}`,fields:{
      kind:{stringValue:f.kind?.stringValue || 'legacy'},name:text(f.name),at:f.at,
      from:text(f.from),to:text(f.to),teams:f.teams || {arrayValue:{values:[]}}
    }}};
  });
  if (writes.length) {
    const saved = await fetch(endpoint+':commit',{method:'POST',headers,body:JSON.stringify({writes})});
    if (!saved.ok) throw Error('Falha ao publicar resumo: HTTP '+saved.status);
    count += writes.length;
  }
  page = result.nextPageToken || '';
} while (page);
console.log(`${count} movimentações sincronizadas na consulta pública. Histórico original preservado.`);
