import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CITIES,splitCongregation,cityCongregation} from '../public/cities.js';
import {playerDetails,playerId} from '../public/domain.js';
test('lista fechada contém os 35 municípios e separa cidades antigas sem adivinhar', () => {
  assert.equal(CITIES.length,35); assert.equal(new Set(CITIES).size,35);
  assert.deepEqual(cityCongregation('Centro','Sete Lagoas'),{congregation:'CENTRO - SETE LAGOAS',city:'Sete Lagoas'});
  assert.deepEqual(splitCongregation('VERA CRUZ DE MINAS - PEDRO LEOPOLDO'),{congregation:'VERA CRUZ DE MINAS',city:'Pedro Leopoldo'});
  assert.deepEqual(splitCongregation('Santa Clara – Vespasiano'),{congregation:'Santa Clara',city:'Vespasiano'});
  assert.equal(splitCongregation('GLÓRIA - BH').city,'Belo Horizonte');
  assert.equal(splitCongregation('Centro - cidade desconhecida').city,'');
  assert.equal(splitCongregation('Vera Cruz de Minas').city,'');
  assert.deepEqual(splitCongregation('CENTRO - SETOR NORTE - BETIM'),{congregation:'CENTRO - SETOR NORTE',city:'Betim'});
});
test('cidade é validada e a mesma congregação em municípios distintos tem identidades distintas', async () => {
  const data = {name:'João Silva',congregation:'Centro'};
  const a = playerDetails({...data,city:'Belo Horizonte'}), b = playerDetails({...data,city:'Vespasiano'});
  assert.notEqual(await playerId(a.name,a.congregation),await playerId(b.name,b.congregation));
  for (const city of ['',null,'Outra cidade','bh']) assert.throws(() => playerDetails({...data,city}),/cidade da lista/);
  assert.throws(() => cityCongregation('Centro - Betim','Belo Horizonte'),/diferente/);
});
test('BH é expandido e os demais separadores legados não duplicam a cidade', async () => {
  const known = ['GLÓRIA - BH','SANTA CLARA – VESPASIANO'];
  for (const [base,city,old] of [['Glória','Belo Horizonte',known[0]],['Santa Clara','Vespasiano',known[1]]]) {
    const result = cityCongregation(base,city,known);
    const expected = old.replace(/\bBH$/,'BELO HORIZONTE');
    assert.equal(result.congregation,expected);
    assert.equal(await playerId('João',result.congregation),await playerId('João',expected));
    assert.deepEqual(playerDetails({name:'João',...result}).city,city);
  }
});
