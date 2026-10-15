import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rosterData,rosterCsv,rosterHtml} from '../public/roster.js';

const teams = {a:{name:'AZUL',status:'active'},b:{name:'BRANCO',status:'active'},c:{name:'CINZA',status:'inactive'},d:{name:'DOURADO',status:'deleted'}};
const players = [
  {id:'1',name:'Zeca',congregation:'Centro',teams:['a','b']},
  {id:'2',name:'Ana',congregation:'Norte',teams:['a']},
  {id:'3',name:'Inativo',congregation:'Centro',teams:['a'],status:'inactive'},
  {id:'4',name:'Excluído',congregation:'Centro',teams:['b'],status:'deleted'},
  {id:'5',name:'Arquivo',congregation:'Centro',teams:['a'],mergedInto:'1'},
  {id:'6',name:'Carlos',congregation:'Centro',teams:['c']}
];
test('relação inclui ativos por time, ordena nomes e preserva a indicação do segundo time', () => {
  const all = rosterData(players,teams);
  assert.deepEqual(all.map(t => t.name),['AZUL','BRANCO']);
  assert.deepEqual(all[0].players.map(p => p.name),['Ana','Zeca']);
  assert.deepEqual(all[1].players[0].teams,['AZUL','BRANCO']);
  assert.equal(rosterData(players,teams,'a').length,1);
  assert.equal(rosterData(players,teams,'c')[0].players[0].name,'Carlos');
  assert.deepEqual(rosterData(players,teams,'missing'),[]);
});
test('CSV preserva acentos, escapa células e neutraliza fórmulas', () => {
  const rows = [{name:'=FORMULA()',status:'active',players:[{name:'  +CMD()',congregation:'Belém; "Centro"',teams:['AZUL']}]}];
  const csv = rosterCsv(rows,new Date('2026-10-15T18:00:00Z'));
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"\'=FORMULA()"')); assert.ok(csv.includes('"\'  +CMD()"'));
  assert.ok(csv.includes('"Belém; ""Centro"""')); assert.ok(csv.includes('15/10/2026, 15:00:00'));
});
test('HTML offline escapa dados e inclui impressão, conferência e indicação de lista vazia', () => {
  const html = rosterHtml([{name:'<script>alert(1)</script>',status:'active',players:[{name:'<img onerror=alert(1)>',congregation:'Norte & Sul',teams:['AZUL']}]},{name:'Vazio',status:'active',players:[]}],new Date('2026-10-15T18:00:00Z'));
  assert.ok(!html.includes('<script>alert')); assert.ok(!html.includes('<img onerror'));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('Norte &amp; Sul'));
  assert.ok(html.includes('window.print()')); assert.ok(html.includes('☐')); assert.ok(html.includes('Sem jogadores ativos'));
  assert.ok(!html.includes('https://')); assert.ok(html.includes('15/10/2026, 15:00:00'));
});
