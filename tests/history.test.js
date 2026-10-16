import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterHistory,eventTeamIds,eventTime,eventAuthor} from '../public/history.js';
test('histórico preserva nome registrado e identifica contas antigas sem inventar responsáveis',() => {
  const users = [{id:'a',displayName:'Nome atual'}];
  assert.equal(eventAuthor({actor:'a',actorName:'Nome na alteração'},users),'Nome na alteração');
  assert.equal(eventAuthor({actor:'a'},users),'Nome atual');
  assert.match(eventAuthor({actor:'ausente'},users),/não identificado/);
  assert.match(eventAuthor({}),/não registrado/);
});
const teams = {VERDE:{name:'ESMERALDA'},BLUES:{name:'AZUL'}};
const players = [{id:'old',mergedInto:'new',teams:[]},{id:'new',name:'João Corrigido',teams:['BLUES']}];
const logs = [
  {id:'a',kind:'add',playerId:'old',name:'Joao Silva',to:'VERDE',detail:'Inscrição em VERDE',at:Date.parse('2026-10-15T02:59:59Z')},
  {id:'b',kind:'transfer',name:'João Silva',from:'VERDE',to:'BLUES',detail:'VERDE → BLUES',at:Date.parse('2026-10-15T03:00:00Z')},
  {id:'c',kind:'edit',name:'João Corrigido',previousName:'Joao Silva',playerId:'new',teams:['VERDE'],at:{toMillis:() => Date.parse('2026-10-16T02:59:59Z')}},
  {id:'d',kind:'team',name:'João Futebol',teamId:'VERDE',at:Date.parse('2026-10-16T03:00:00Z')}
];
test('combina jogador sem acento, time por id estável, ação e período inclusivo em Brasília', () => {
  const result = filterHistory(logs,{player:'joao',team:'VERDE',action:'edit',from:'2026-10-15',to:'2026-10-15'},players,teams);
  assert.deepEqual(result.map(e => e.id),['c']);
  assert.deepEqual(filterHistory(logs,{from:'2026-10-15',to:'2026-10-15'}).map(e => e.id),['c','b']);
  assert.deepEqual(filterHistory(logs,{player:'João Corrigido',action:'add'},players).map(e => e.id),['a']);
  assert.deepEqual(filterHistory(logs,{player:'João',action:'team'},players),[]);
  assert.throws(() => filterHistory(logs,{from:'2026-10-16',to:'2026-10-15'}),/data inicial/);
});
test('usa times históricos quando presentes e vínculo atual somente para registros antigos sem times', () => {
  assert.deepEqual(eventTeamIds(logs[2],players),['VERDE']);
  assert.deepEqual(eventTeamIds({kind:'status',playerId:'old'},players),['BLUES']);
  assert.deepEqual(eventTeamIds({kind:'merge',sourceTeams:['VERDE'],targetTeams:['BLUES'],teams:['BLUES','VERDE']}),['BLUES','VERDE']);
  assert.deepEqual(eventTeamIds({kind:'window'}),[]);
});
test('datas ausentes são excluídas com período; aceita timestamps serializados e registros antigos', () => {
  assert.equal(eventTime({at:{seconds:100}}),100000);
  assert.equal(eventTime({at:new Date(100000)}),100000);
  assert.deepEqual(filterHistory([{name:'Sem data'}],{from:'2026-10-15'}),[]);
  assert.equal(filterHistory([{name:'Antigo',detail:'Inscrição em ESMERALDA',at:1}],{action:'legacy',team:'VERDE'},[],teams).length,1);
  assert.deepEqual(filterHistory(logs,{player:'ninguem'}),[]);
  assert.deepEqual(filterHistory(logs,{}).map(e => e.id),['d','c','b','a']);
});
