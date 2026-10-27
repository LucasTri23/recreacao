import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FORMATIONS,formationSlots,tacticalRoster,cleanLineup,placePlayer} from '../public/tactics.js';

test('formações incluem goleiro e mantêm posições dentro do campo',() => {
  for (const [id,preset] of Object.entries(FORMATIONS)) {
    const slots = formationSlots(id);
    assert.equal(slots.length,1+preset.lines.reduce((a,b) => a+b,0));
    assert.equal(slots[0].y,89);
    assert.ok(slots.every(s => s.x >= 8 && s.x <= 92 && s.y >= 8 && s.y <= 92));
  }
  assert.throws(() => formationSlots('invalid'),/formação/);
});
test('banco e montagem excluem inativos, excluídos, unificados e jogadores de outro time',() => {
  const players = [
    {id:'a',name:'ANA',teams:['VERDE']},
    {id:'b',name:'BRUNO',teams:['VERDE'],status:'inactive'},
    {id:'c',name:'CAIO',teams:['VERDE'],status:'deleted'},
    {id:'d',name:'DAVI',teams:['BRANCO']},
    {id:'e',name:'EDU',teams:['VERDE'],mergedInto:'a'}
  ];
  const roster = tacticalRoster(players,'VERDE');
  assert.deepEqual(roster.map(p => p.id),['a']);
  const slots = formationSlots('2-2');
  ['a','a','b','c','d'].forEach((id,i) => slots[i].playerId = id);
  assert.deepEqual(cleanLineup({formation:'2-2',slots},roster).slots.map(s => s.playerId),['a','','','','']);
});
test('mover e trocar jogadores não duplica o mesmo jogador',() => {
  const lineup = {formation:'2-2',slots:formationSlots('2-2')};
  lineup.slots[0].playerId = 'a'; lineup.slots[1].playerId = 'b';
  const swapped = placePlayer(lineup,'a',1);
  assert.deepEqual(swapped.slots.slice(0,2).map(s => s.playerId),['b','a']);
  const moved = placePlayer(swapped,'a',4);
  assert.equal(moved.slots[1].playerId,''); assert.equal(moved.slots[4].playerId,'a');
  assert.equal(lineup.slots[0].playerId,'a');
});
