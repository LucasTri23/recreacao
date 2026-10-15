import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identity,membership,playerId,playerSuggestions,duplicatePairs,mergedTeams} from '../public/domain.js';
test('nome e congregação ignoram acentos, caixa e espaços', async () => {
  assert.equal(identity('  João   Silva ', ' Belém '), identity('joao silva','belem'));
  assert.equal(await playerId('João Silva','Belém'), await playerId('joao silva','belem'));
  assert.notEqual(await playerId('João Silva','Belém'), await playerId('João Silva','Centro'));
});

test('busca sugere nomes parciais, acentos e pequenos erros, mostrando cadastros ativos', () => {
  const players = [{id:'a',name:'João da Silva',congregation:'Centro',teams:['VERDE']},{id:'b',name:'Maria Souza',congregation:'Centro',teams:['BRANCO']},{id:'c',name:'Joao Silva',congregation:'Centro',teams:[],mergedInto:'a'}];
  for (const query of ['joa','JOÃO DA SILVA','Joao da SIlva','Joao da Sliva','Joao Silva']) assert.equal(playerSuggestions(players,query)[0].player.id,'a');
  assert.deepEqual(playerSuggestions(players,'xx'),[]);
  assert.deepEqual(playerSuggestions(players,'Pedro Oliveira'),[]);
});

test('revisão inclui nomes iguais em congregações diferentes e ignora arquivos', () => {
  const players = [{id:'a',name:'João Silva',congregation:'Centro',teams:['VERDE']},{id:'b',name:'Joao da Silva',congregation:'Norte',teams:['BRANCO']},{id:'c',name:'Joao Silva',congregation:'Centro',teams:[],mergedInto:'a'}];
  const pairs = duplicatePairs(players);
  assert.equal(pairs.length,1); assert.equal(pairs[0].source.id,'a'); assert.equal(pairs[0].target.id,'b');
  assert.deepEqual(mergedTeams(players[0],players[1]),['BRANCO','VERDE']);
  assert.throws(() => mergedTeams({teams:['VERDE','BLUES']},{teams:['BRANCO']}),/mais de dois/);
});
test('permite segundo time e rejeita terceiro e duplicata', () => {
  assert.deepEqual(membership({teams:['BRANCO']},'VERDE'),['BRANCO','VERDE']);
  assert.throws(() => membership({teams:['BRANCO','VERDE']},'BLUES'),/dois times/);
  assert.throws(() => membership({teams:['BRANCO']},'BRANCO'),/já está/);
});
test('transferência substitui apenas o time de origem', () => {
  assert.deepEqual(membership({teams:['BRANCO','VERDE']},'BRANCO','BLUES'),['BLUES','VERDE']);
  assert.throws(() => membership({teams:['BRANCO','VERDE']},'BRANCO','VERDE'),/destino/);
  assert.throws(() => membership({teams:['BRANCO']},'PRETO','VERDE'),/origem/);
});
