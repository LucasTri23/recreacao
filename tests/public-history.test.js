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
  assert.equal(writes.length,4);
  assert.equal(writes[1].ref.path,'publicEvents/one');
  assert.equal(writes[1].data.actor,undefined);
  assert.equal(writes[3].ref.path,'publicTeamPlayers/p');
});

test('edicoes e demais acoes administrativas nao geram resumo publico',async () => {
  const writes=[];
  const sdk={doc:(_,collection,id)=>({path:collection+'/'+id}),runTransaction:async (_,callback)=>callback({set:(ref,data)=>writes.push({ref,data})})};
  for (const kind of ['edit','status','merge','duplicateReview','team','window','gameWeek','gameSquad','legacy']) {
    await withPublicHistory(sdk,{}).runTransaction({},tx=>tx.set({path:'events/'+kind},{kind}));
  }
  assert.equal(writes.length,9);
  assert.ok(writes.every(w=>w.ref.path.startsWith('events/')));
});
