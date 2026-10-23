import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth');
const {Client} = require('firebase-tools/lib/apiv2');
auth.setActiveAccount({},auth.getGlobalDefaultAccount());
const path = suffix => '/databases/(default)/documents/'+suffix;
const event = {kind:'add',name:'JOGADOR TESTE',at:1000,from:'',to:'VERDE',teams:[]};
const mocks = [
  {function:'get',args:[{exactValue:path('users/admin')}],result:{value:{data:{role:'admin'}}}},
  {function:'getAfter',args:[{exactValue:path('players/p')}],result:{value:{data:{name:'JOGADOR TESTE',teams:['VERDE']}}}},
  {function:'get',args:[{exactValue:path('users/director')}],result:{value:{data:{role:'director',team:'VERDE'}}}},
  {function:'getAfter',args:[{exactValue:path('events/e')}],result:{value:{data:{...event,actor:'director',detail:'Texto privado'}}}}
];
const cases = [], labels = [];
function add(label,suffix,method,expectation,data,authenticated = false) {
  labels.push(label); cases.push({expectation,request:{path:path(suffix),method,...(authenticated ? {auth:{uid:authenticated === 'admin' ? 'admin' : 'director'}} : {}),...(method === 'get' ? {} : {resource:{data}})},...(method === 'get' ? {resource:{data:data || {}}} : {}),functionMocks:mocks});
}
add('visitante consulta times','settings/teams','get','ALLOW',{items:{}});
add('visitante vê nomes e vínculos públicos','publicTeamPlayers/p','get','ALLOW',{name:'JOGADOR TESTE',teams:['VERDE'],active:true});
add('visitante não altera elenco','publicTeamPlayers/p','update','DENY',{name:'FORJADO',teams:[],active:true});
add('diretor publica nome e time corretos','publicTeamPlayers/p','create','ALLOW',{name:'JOGADOR TESTE',teams:['VERDE'],active:true},true);
add('projeção não aceita congregação','publicTeamPlayers/p','create','DENY',{name:'JOGADOR TESTE',teams:['VERDE'],active:true,congregation:'PRIVADO'},true);
add('projeção não aceita vínculo inventado','publicTeamPlayers/p','create','DENY',{name:'JOGADOR TESTE',teams:['BRANCO'],active:true},true);
add('visitante consulta resumo','publicEvents/e','get','ALLOW',event);
add('visitante não lê histórico privado','events/e','get','DENY',event);
add('visitante não lê jogadores','players/id','get','DENY',{name:'PRIVADO'});
add('visitante não lê contas','users/director','get','DENY',{role:'director'});
add('visitante não escreve resumo','publicEvents/e','create','DENY',event);
add('diretor publica resumo fiel','publicEvents/e','create','ALLOW',event,true);
add('resumo não inclui dados privados','publicEvents/e','create','DENY',{...event,actorName:'Privado'},true);
add('resumo não pode forjar time','publicEvents/e','create','DENY',{...event,to:'BRANCO'},true);
for (const kind of ['add','transfer','edit','status','merge','duplicateReview','team','window','gameWeek','gameSquad','legacy']) {
  const allowed = ['add','transfer'].includes(kind) ? 'ALLOW' : 'DENY';
  add('visitante: '+kind,'publicEvents/e','get',allowed,{...event,kind});
  add('diretor publico: '+kind,'publicEvents/e','get',allowed,{...event,kind},true);
  add('diretor privado: '+kind,'events/e','get',allowed,{...event,kind},true);
  add('administrador: '+kind,'events/e','get','ALLOW',{...event,kind},'admin');
}
const content = await readFile('firestore.rules','utf8');
const client = new Client({urlPrefix:'https://firebaserules.googleapis.com',apiVersion:'v1'});
const {body} = await client.post('/projects/recreacao-17154:test',{source:{files:[{name:'firestore.rules',content}]},testSuite:{testCases:cases}},{skipLog:{body:true,resBody:true}});
for (let i=0;i<(body.testResults || []).length;i++) console.log(`${body.testResults[i].state}: ${labels[i]}`);
if (body.issues?.length) console.log(JSON.stringify(body.issues));
if (body.testResults?.length !== cases.length || body.testResults.some(r => r.state !== 'SUCCESS')) process.exitCode = 1;
