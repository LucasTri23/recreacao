import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planRepeatedCities} from '../scripts/repeated-city-plan.mjs';
import {playerId} from '../public/domain.js';
const doc = (id,congregation,extra = {}) => ({name:'players/'+id,fields:{name:{stringValue:'JOÃO SILVA'},congregation:{stringValue:congregation},teams:{arrayValue:{values:[{stringValue:'VERDE'}]}},...extra}});
test('planeja correção de cidade repetida sem alterar o objeto ou os times de origem',async () => {
  const source = doc('old','BOM JESUS - MATOZINHOS - MATOZINHOS');
  const {plans,conflicts} = await planRepeatedCities([source,doc('healthy','CENTRO - BETIM')]);
  assert.equal(plans.length,1); assert.equal(conflicts.length,0);
  assert.equal(plans[0].targetId,await playerId('JOÃO SILVA','BOM JESUS - MATOZINHOS'));
  assert.equal(plans[0].city,'Matozinhos'); assert.equal(plans[0].source,source);
  assert.equal(source.fields.congregation.stringValue,'BOM JESUS - MATOZINHOS - MATOZINHOS');
});
test('não sobrescreve identidade correta existente nem remigra identidades arquivadas',async () => {
  const id = await playerId('JOÃO SILVA','BOM JESUS - MATOZINHOS');
  const {plans,conflicts} = await planRepeatedCities([doc('old','BOM JESUS - MATOZINHOS - MATOZINHOS'),doc(id,'BOM JESUS - MATOZINHOS'),doc('alias','CENTRO - BETIM - BETIM',{mergedInto:{stringValue:id}})]);
  assert.equal(plans.length,0); assert.equal(conflicts.length,1);
});
