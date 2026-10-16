import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identity,membership,playerId,playerSuggestions,duplicatePairs,mergedTeams,reviewKey,playerDetails} from '../public/domain.js';
test('nome e congregação ignoram acentos, caixa e espaços', async () => {
  assert.deepEqual(playerDetails({name:'  joão   da Silva ',congregation:' Centro '}),{name:'JOÃO DA SILVA',congregation:'Centro'});
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

test('revisão concluída vale para o par nas duas ordens e reabre após mudança de identidade', () => {
  const a = {id:'a',name:'João Silva',congregation:'Centro',teams:['VERDE']}, b = {id:'b',name:'Joao da Silva',congregation:'Norte',teams:['BRANCO']};
  const review = {sourceId:'a',targetId:'b',sourceName:a.name,targetName:b.name,sourceCongregation:a.congregation,targetCongregation:b.congregation,different:true};
  assert.equal(reviewKey('a','b'),reviewKey('b','a'));
  assert.equal(duplicatePairs([b,a],[review])[0].reviewed,true);
  assert.equal(duplicatePairs([a,{...b,congregation:'Sul'}],[review])[0].reviewed,false);
  assert.equal(duplicatePairs([a,b],[{...review,different:false}])[0].reviewed,false);
});
