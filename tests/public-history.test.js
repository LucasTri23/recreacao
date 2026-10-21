import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicMovement,publicMovementDetail,withPublicHistory} from '../public/public-history.js';
test('resumo público exclui congregação, responsáveis e detalhes privados',() => {
  const safe = publicMovement({kind:'transfer',name:'JOÃO',at:1,from:'A',to:'B',actor:'uid',actorName:'email@example.com',detail:'Congregação: Centro',congregation:'Centro'});
  assert.deepEqual(Object.keys(safe).sort(),['at','from','kind','name','teams','to']);
  assert.equal(publicMovementDetail(safe,{A:{name:'BRANCO'},B:{name:'VERDE'}}),'BRANCO → VERDE.');
});
test('resumo é salvo na mesma transação do histórico, sem alterar outras escritas',async () => {
  const writes = [];
  const sdk = {doc:(_,collection,id) => ({path:`${collection}/${id}`,id}),runTransaction:async (_,callback) => callback({set:(ref,data) => writes.push({ref,data}),get:async () => 'ok'})};
  await withPublicHistory(sdk,{}).runTransaction({},async tx => {
    assert.equal(await tx.get({}),'ok');
    tx.set({path:'events/one',id:'one'},{name:'JOÃO',kind:'add',to:'VERDE',at:1,actor:'private'});
    tx.set({path:'players/p'},{name:'JOÃO'});
  });
  assert.equal(writes.length,3);
  assert.equal(writes[1].ref.path,'publicEvents/one');
  assert.equal(writes[1].data.actor,undefined);
});
