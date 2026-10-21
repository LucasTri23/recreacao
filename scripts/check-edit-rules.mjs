import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {playerId} from '../public/domain.js';
import {DEFAULT_TEAMS} from '../public/teams.js';
const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth');
const {Client} = require('firebase-tools/lib/apiv2');
auth.setActiveAccount({},auth.getGlobalDefaultAccount());
const oldId = await playerId('17. Jogador Teste','Santa Clara – Vespasiano');
const newId = await playerId('Jogador Teste','Santa Clara – Vespasiano');
const before = {name:'17. Jogador Teste',congregation:'Santa Clara – Vespasiano',teams:['VETOR NORTE'],updatedAt:1,lastEvent:'previous'};
const after = {...before,name:'Jogador Teste',updatedAt:1000,lastEvent:'edit-event'};
const archived = {...before,teams:[],mergedInto:newId,updatedAt:1000,lastEvent:'edit-event'};
const event = {actor:'admin-test',at:1000,kind:'edit',playerId:newId,sourceId:oldId,name:after.name,congregation:after.congregation,previousName:before.name,previousCongregation:before.congregation,detail:'Edição de teste'};
const path = suffix => '/databases/(default)/documents/'+suffix;
const mock = (fn,suffix,value) => ({function:fn,args:[{exactValue:path(suffix)}],result:{value}});
const mocks = [
  mock('get','users/admin-test',{data:{role:'admin'}}),
  mock('get','players/'+oldId,{data:before}),
  mock('getAfter','players/'+oldId,{data:archived}),
  mock('getAfter','players/'+newId,{data:after}),
  mock('getAfter','events/edit-event',{data:event}),
  mock('exists','players/'+newId,false),
  mock('exists','settings/teams',false)
];
const cases = [['players/'+oldId,'update',archived,before],['players/'+newId,'create',after,null],['events/edit-event','create',event,null]].map(([suffix,method,data,old]) => ({expectation:'ALLOW',request:{auth:{uid:'admin-test'},path:path(suffix),method,resource:{data}},...(old ? {resource:{data:old}} : {}),functionMocks:mocks,expressionReportLevel:'FULL'}));
const labels = ['admin: arquiva identidade antiga','admin: cria identidade corrigida','admin: grava histórico'];
function addCases(label,expectation,transform) {
  for (let i=0;i<3;i++) {
    const testCase = structuredClone(cases[i]); testCase.expectation = expectation;
    transform(testCase,i); cases.push(testCase); labels.push(`${label}: ${labels[i]}`);
  }
}
addCases('diretor bloqueado','DENY',testCase => {
  testCase.functionMocks.find(m => m.function === 'get' && m.args[0].exactValue === path('users/admin-test')).result.value.data = {role:'director',team:'VETOR NORTE'};
});
addCases('edição não pode trocar times','DENY',(testCase,index) => {
  const changed = {...after,teams:['BLUES']};
  testCase.functionMocks.find(m => m.function === 'getAfter' && m.args[0].exactValue === path('players/'+newId)).result.value.data = changed;
  if (index === 1) testCase.request.resource.data = changed;
});
addCases('catálogo já cadastrado','ALLOW',testCase => {
  testCase.functionMocks.find(m => m.function === 'exists' && m.args[0].exactValue === path('settings/teams')).result.value = true;
  testCase.functionMocks.push(mock('get','settings/teams',{data:{items:DEFAULT_TEAMS}}));
});
addCases('não sobrescreve outro cadastro','DENY',testCase => {
  testCase.functionMocks.find(m => m.function === 'exists' && m.args[0].exactValue === path('players/'+newId)).result.value = true;
  testCase.functionMocks.push(mock('get','players/'+newId,{data:{...after}}));
});
addCases('edição guarda os times do momento','ALLOW',(testCase,index) => {
  const changed = {...event,teams:before.teams};
  testCase.functionMocks.find(m => m.function === 'getAfter' && m.args[0].exactValue === path('events/edit-event')).result.value.data = changed;
  if (index === 2) testCase.request.resource.data = changed;
});
addCases('histórico não pode forjar times','DENY',(testCase,index) => {
  const changed = {...event,teams:['BLUES']};
  testCase.functionMocks.find(m => m.function === 'getAfter' && m.args[0].exactValue === path('events/edit-event')).result.value.data = changed;
  if (index === 2) testCase.request.resource.data = changed;
});
// Reproduce the reported admin signup using fictitious account information.
const signupId = await playerId('UZIEL LUCAS','GLÓRIA - BH');
const signupPlayer = {name:'UZIEL LUCAS',congregation:'GLÓRIA - BH',city:'Belo Horizonte',teams:['PRETO'],updatedAt:1000,lastEvent:'signup-event'};
const signupEvent = {actor:'admin-test',actorName:'Outro Admin',at:1000,kind:'add',playerId:signupId,name:signupPlayer.name,from:'',to:'PRETO',detail:'Inscrição em PRETO'};
for (const [label,profile,expectation] of [
  ['admin sem time pode cadastrar',{role:'admin',displayName:'Outro Admin'},'ALLOW'],
  ['admin de outro time pode cadastrar',{role:'admin',team:'VERDE',displayName:'Outro Admin'},'ALLOW'],
  ['diretor de outro time não pode cadastrar',{role:'director',team:'VERDE',displayName:'Outro Admin'},'DENY'],
  ['diretor do próprio time pode cadastrar',{role:'director',team:'PRETO',displayName:'Outro Admin'},'ALLOW']
]) {
  const signupMocks = [mock('get','users/admin-test',{data:profile}),mock('exists','settings/teams',false),mock('getAfter','players/'+signupId,{data:signupPlayer}),mock('getAfter','events/signup-event',{data:signupEvent})];
  cases.push({expectation,request:{auth:{uid:'admin-test'},path:path('players/'+signupId),method:'create',resource:{data:signupPlayer}},functionMocks:signupMocks,expressionReportLevel:'FULL'}); labels.push(label);
  // For a forbidden director, the player rule is what rejects the transaction.
  if (expectation === 'ALLOW') { cases.push({expectation,request:{auth:{uid:'admin-test'},path:path('events/signup-event'),method:'create',resource:{data:signupEvent}},functionMocks:signupMocks,expressionReportLevel:'FULL'}); labels.push(label+': histórico com responsável'); }
}
for (const [name,congregation] of [['JOÃO GONÇALVES','SÃO JOSÉ - BH'],['ÀÁÂÃÄÅ ÈÉÊË ÌÍÎÏ ÒÓÔÕÖ ÙÚÛÜ Ç Ñ ÝŸ','CENTRO - BH']]) {
  const accentedId = await playerId(name,congregation), p = {...signupPlayer,name,congregation};
  const e = {...signupEvent,name,playerId:accentedId};
  const fixtureMocks = [mock('get','users/admin-test',{data:{role:'admin',displayName:'Outro Admin'}}),mock('exists','settings/teams',false),mock('getAfter','events/signup-event',{data:e})];
  cases.push({expectation:'ALLOW',request:{auth:{uid:'admin-test'},path:path('players/'+accentedId),method:'create',resource:{data:p}},functionMocks:fixtureMocks,expressionReportLevel:'FULL'}); labels.push('acentos maiúsculos: '+name);
  cases.push({expectation:'DENY',request:{auth:{uid:'admin-test'},path:path('players/'+'0'.repeat(64)),method:'create',resource:{data:p}},functionMocks:fixtureMocks,expressionReportLevel:'FULL'}); labels.push('identidade divergente continua bloqueada: '+name);
}
for (const [label,oldFlag,newFlag,expectation] of [
  ['goleiro pode entrar no terceiro time',true,true,'ALLOW'],
  ['linha não pode entrar no terceiro time',false,false,'DENY'],
  ['inscrição não pode promover linha a goleiro',false,true,'DENY']
]) {
  const beforePlayer = {...signupPlayer,goalkeeper:oldFlag,teams:['PRETO','BRANCO'],updatedAt:1,lastEvent:'previous'};
  const nextPlayer = {...beforePlayer,goalkeeper:newFlag,teams:['PRETO','BRANCO','VERDE'],updatedAt:1000,lastEvent:'signup-event'};
  const e = {...signupEvent,to:'VERDE',detail:'Inscrição em VERDE'};
  cases.push({expectation,request:{auth:{uid:'admin-test'},path:path('players/'+signupId),method:'update',resource:{data:nextPlayer}},resource:{data:beforePlayer},functionMocks:[mock('get','users/admin-test',{data:{role:'admin'}}),mock('exists','settings/teams',false),mock('getAfter','events/signup-event',{data:e})],expressionReportLevel:'FULL'}); labels.push(label);
}
addCases('admin pode marcar goleiro ao editar','ALLOW',(testCase,index) => {
  const changed = {...after,goalkeeper:true};
  testCase.functionMocks.find(m => m.function === 'getAfter' && m.args[0].exactValue === path('players/'+newId)).result.value.data = changed;
  if (index === 1) testCase.request.resource.data = changed;
});
for (const [label,changes,expectation] of [
  ['cidade válida aceita',{city:'Belo Horizonte'},'ALLOW'],
  ['cidade fora da lista recusada',{city:'Cidade inventada'},'DENY'],
  ['cidade divergente recusada',{city:'Betim'},'DENY'],
  ['novo cadastro sem cidade recusado',{city:undefined},'DENY']
]) {
  const p = {...signupPlayer,...changes}; if (p.city === undefined) delete p.city;
  cases.push({expectation,request:{auth:{uid:'admin-test'},path:path('players/'+signupId),method:'create',resource:{data:p}},functionMocks:[mock('get','users/admin-test',{data:{role:'admin'}}),mock('exists','settings/teams',false),mock('getAfter','events/signup-event',{data:signupEvent})],expressionReportLevel:'FULL'}); labels.push(label);
}
addCases('edição antiga passa a gravar cidade','ALLOW',(testCase,index) => {
  const changed = {...after,city:'Vespasiano'};
  testCase.functionMocks.find(m => m.function === 'getAfter' && m.args[0].exactValue === path('players/'+newId)).result.value.data = changed;
  if (index === 1) testCase.request.resource.data = changed;
});
for (const hops of [1,3]) addCases('retorna à própria identidade antiga com '+hops+' vínculo(s)','ALLOW',testCase => {
  testCase.functionMocks.find(m => m.function === 'exists' && m.args[0].exactValue === path('players/'+newId)).result.value = true;
  const ids = [newId,'c'.repeat(64),'d'.repeat(64),oldId];
  for (let hop=0;hop<hops;hop++) testCase.functionMocks.push(mock('get','players/'+ids[hop],{data:{teams:[],mergedInto:hop === hops-1 ? oldId : ids[hop+1]}}));
});
// Use a fixed scalar in fixtures to isolate rule logic from Timestamp encoding.
const content = (await readFile('firestore.rules','utf8')).replaceAll('request.time.toMillis()','1000').replaceAll('request.time','1000');
const client = new Client({urlPrefix:'https://firebaserules.googleapis.com',apiVersion:'v1'});
const {body} = await client.post('/projects/recreacao-17154:test',{source:{files:[{name:'firestore.rules',content}]},testSuite:{testCases:cases}},{skipLog:{body:true,resBody:true}});
for (let i=0;i<(body.testResults || []).length;i++) {
  const result = body.testResults[i];
  console.log(JSON.stringify({test:labels[i],status:result.state,errors:result.errorMessages,reports:result.debugMessages}));
}
if (body.issues?.length) console.log(JSON.stringify(body.issues));
if (body.testResults?.length !== cases.length || body.testResults.some(r => r.state !== 'SUCCESS')) process.exitCode = 1;
