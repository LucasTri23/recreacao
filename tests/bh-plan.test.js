import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planBh,expandBh} from '../scripts/bh-plan.mjs';
import {playerId} from '../public/domain.js';
const document = (id,congregation,extra = {}) => ({name:'players/'+id,updateTime:'original',fields:{name:{stringValue:'JOÃO SILVA'},congregation:{stringValue:congregation},teams:{arrayValue:{values:[{stringValue:'VERDE'}]}},...extra}});
test('migração altera só o sufixo BH e reconhece a identidade por extenso',async () => {
  const doc = document('old','GLÓRIA - BH');
  const {plans,conflicts} = await planBh([doc,document('other','BH CENTRAL - BETIM')]);
  assert.equal(plans.length,1); assert.equal(conflicts.length,0);
  assert.equal(plans[0].congregation,'GLÓRIA - BELO HORIZONTE');
  assert.equal(plans[0].targetId,await playerId('JOÃO SILVA','GLÓRIA - BELO HORIZONTE'));
  assert.equal(plans[0].source,doc);
  assert.equal(expandBh('BH CENTRAL - BETIM'),'BH CENTRAL - BETIM');
});
test('migração preserva cadastros duplicados e não reaplica em identidades arquivadas',async () => {
  const target = await playerId('JOÃO SILVA','GLÓRIA - BELO HORIZONTE');
  const {plans,conflicts} = await planBh([document('old','GLÓRIA - BH'),document(target,'GLÓRIA - BELO HORIZONTE'),document('alias','CENTRO - BH',{mergedInto:{stringValue:target}})]);
  assert.equal(plans.length,0); assert.equal(conflicts.length,1);
});
