import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identity,membership,playerId} from '../public/domain.js';
test('nome e congregação ignoram acentos, caixa e espaços', async () => {
  assert.equal(identity('  João   Silva ', ' Belém '), identity('joao silva','belem'));
  assert.equal(await playerId('João Silva','Belém'), await playerId('joao silva','belem'));
  assert.notEqual(await playerId('João Silva','Belém'), await playerId('João Silva','Centro'));
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
