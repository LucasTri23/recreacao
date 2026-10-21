import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth');
const {Client} = require('firebase-tools/lib/apiv2');
auth.setActiveAccount({},auth.getGlobalDefaultAccount());
const path = suffix => '/databases/(default)/documents/'+suffix;
const event = {kind:'add',name:'JOGADOR TESTE',at:1000,from:'',to:'VERDE',teams:[]};
const mocks = [
  {function:'get',args:[{exactValue:path('users/director')}],result:{value:{data:{role:'director',team:'VERDE'}}}},
  {function:'getAfter',args:[{exactValue:path('events/e')}],result:{value:{data:{...event,actor:'director',detail:'Texto privado'}}}}
];
const cases = [], labels = [];
function add(label,suffix,method,expectation,data,authenticated = false) {
  labels.push(label); cases.push({expectation,request:{path:path(suffix),method,...(authenticated ? {auth:{uid:'director'}} : {}),...(method === 'get' ? {} : {resource:{data}})},...(method === 'get' ? {resource:{data:data || {}}} : {}),functionMocks:mocks});
}
add('visitante consulta times','settings/teams','get','ALLOW',{items:{}});
add('visitante consulta resumo','publicEvents/e','get','ALLOW',event);
add('visitante não lê histórico privado','events/e','get','DENY',event);
add('visitante não lê jogadores','players/id','get','DENY',{name:'PRIVADO'});
add('visitante não lê contas','users/director','get','DENY',{role:'director'});
add('visitante não escreve resumo','publicEvents/e','create','DENY',event);
add('diretor publica resumo fiel','publicEvents/e','create','ALLOW',event,true);
add('resumo não inclui dados privados','publicEvents/e','create','DENY',{...event,actorName:'Privado'},true);
add('resumo não pode forjar time','publicEvents/e','create','DENY',{...event,to:'BRANCO'},true);
const content = await readFile('firestore.rules','utf8');
const client = new Client({urlPrefix:'https://firebaserules.googleapis.com',apiVersion:'v1'});
const {body} = await client.post('/projects/recreacao-17154:test',{source:{files:[{name:'firestore.rules',content}]},testSuite:{testCases:cases}},{skipLog:{body:true,resBody:true}});
for (let i=0;i<(body.testResults || []).length;i++) console.log(`${body.testResults[i].state}: ${labels[i]}`);
if (body.issues?.length) console.log(JSON.stringify(body.issues));
if (body.testResults?.length !== cases.length || body.testResults.some(r => r.state !== 'SUCCESS')) process.exitCode = 1;
