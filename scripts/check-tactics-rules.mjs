import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {FORMATIONS,formationSlots} from '../public/tactics.js';
const require = createRequire(import.meta.url), auth = require('firebase-tools/lib/auth'), {Client} = require('firebase-tools/lib/apiv2');
auth.setActiveAccount({},auth.getGlobalDefaultAccount());
const path = suffix => '/databases/(default)/documents/'+suffix;
const cases = [], labels = [];
function add(label,role,method,expectation,changes = {}) {
  const data = {teamId:'VERDE',formation:'4-4-2',slots:formationSlots('4-4-2'),updatedAt:1000,updatedBy:'u',...changes};
  labels.push(label); cases.push({expectation,request:{path:path('tacticalLineups/VERDE'),method,...(role ? {auth:{uid:'u'}} : {}),...(method === 'get' ? {} : {resource:{data}})},...(method === 'get' ? {resource:{data}} : {}),functionMocks:[
    {function:'get',args:[{exactValue:path('users/u')}],result:{value:{data:{role}}}},
    {function:'exists',args:[{exactValue:path('settings/teams')}],result:{value:false}}
  ]});
}
for (const role of [null,'pending','director','admin']) for (const method of ['get','create','update','delete']) add(`${role || 'visitante'}: ${method}`,role,method,role === 'admin' ? 'ALLOW' : 'DENY');
for (const formation of Object.keys(FORMATIONS)) add('formação '+formation,'admin','create','ALLOW',{formation,slots:formationSlots(formation)});
for (let count=0;count<=11;count++) add('personalizada com '+count+' posições','admin','create','ALLOW',{formation:'custom',slots:Array.from({length:count},()=>({playerId:'',x:50,y:50,role:'VOL'}))});
for (const [label,changes] of [
  ['time divergente',{teamId:'BRANCO'}],['formação inválida',{formation:'invalid'}],['posições faltando',{slots:[]}],
  ['posição fora do campo',{slots:formationSlots().map((s,i) => i ? s : {...s,x:1000})}],
  ['tipo de coordenada inválido',{slots:formationSlots().map((s,i) => i ? s : {...s,y:'50'})}],
  ['responsável forjado',{updatedBy:'other'}],['campo extra',{public:true}],['data forjada',{updatedAt:0}]
  ,['função inválida',{formation:'custom',slots:[{playerId:'',x:50,y:50,role:'INVALID'}]}]
  ,['mais de onze posições',{formation:'custom',slots:Array.from({length:12},()=>({playerId:'',x:50,y:50}))}]
]) add(label,'admin','create','DENY',changes);
const content = (await readFile('firestore.rules','utf8')).replaceAll('request.time.toMillis()','1000').replaceAll('request.time','1000');
const client = new Client({urlPrefix:'https://firebaserules.googleapis.com',apiVersion:'v1'});
const {body} = await client.post('/projects/recreacao-17154:test',{source:{files:[{name:'firestore.rules',content}]},testSuite:{testCases:cases}},{skipLog:{body:true,resBody:true}});
for (let i=0;i<(body.testResults || []).length;i++) {
  console.log(`${body.testResults[i].state}: ${labels[i]}`);
  if (body.testResults[i].state !== 'SUCCESS') console.log(JSON.stringify(body.testResults[i]));
}
if (body.issues?.length) console.log(JSON.stringify(body.issues));
if (body.testResults?.length !== cases.length || body.testResults.some(r => r.state !== 'SUCCESS')) process.exitCode = 1;
