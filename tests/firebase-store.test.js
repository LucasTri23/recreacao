import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseApi} from '../public/firebase-store.js';
import {playerId} from '../public/domain.js';

function setup(profile, seed = {}) {
  const records = new Map(Object.entries({'users/director':profile, ...seed}));
  let eventCount = 0;
  const sdk = {
    collection:(_, path) => ({path}),
    doc:(...args) => args.length === 1 ? {path:`events/e${++eventCount}`,id:`e${eventCount}`} : {path:args.slice(1).join('/')},
    serverTimestamp:() => 'SERVER_TIME',
    runTransaction:async (_, callback) => {
      const writes = [];
      await callback({get:async ref => ({data:() => records.get(ref.path)}),set:(ref,data) => writes.push([ref.path,data])});
      writes.forEach(([key,value]) => records.set(key,value));
    }
  };
  return {api:createFirebaseApi(sdk, {}, {currentUser:{uid:'director'}}), records};
}
test('inscrição persiste jogador e histórico juntos e rejeita outro time', async () => {
  const {api,records} = setup({role:'director',team:'VERDE'});
  await assert.rejects(api('addPlayer',{name:'João Silva',congregation:'Centro',team:'BLUES'}),/próprio time/);
  assert.equal(records.size,1);
  await api('addPlayer',{name:'João Silva',congregation:'Centro',team:'VERDE'});
  const id = await playerId('João Silva','Centro');
  const player = records.get(`players/${id}`);
  assert.deepEqual(player.teams,['VERDE']);
  assert.equal(records.get(`events/${player.lastEvent}`).playerId,id);
});
test('terceira inscrição e janela fechada não geram histórico ou alteração', async () => {
  const id = await playerId('João Silva','Centro');
  const {api,records} = setup({role:'admin'}, {
    [`players/${id}`]:{name:'João Silva',congregation:'Centro',teams:['BRANCO','VERDE']},
    'settings/transfers':{open:false}
  });
  await assert.rejects(api('addPlayer',{name:'João Silva',congregation:'Centro',team:'BLUES'}),/dois times/);
  await assert.rejects(api('transferPlayer',{id,from:'BRANCO',to:'BLUES'}),/fechada/);
  assert.equal(records.size,3);
  assert.deepEqual(records.get(`players/${id}`).teams,['BRANCO','VERDE']);
});
test('transferência preserva segunda inscrição e só admin abre janela', async () => {
  const id = await playerId('João Silva','Centro');
  const {api,records} = setup({role:'director',team:'BRANCO'}, {
    [`players/${id}`]:{name:'João Silva',congregation:'Centro',teams:['BRANCO','VERDE']},
    'settings/transfers':{open:true}
  });
  await assert.rejects(api('setWindow',{open:false}),/administração/);
  await api('transferPlayer',{id,from:'BRANCO',to:'BLUES'});
  assert.deepEqual(records.get(`players/${id}`).teams,['BLUES','VERDE']);
  assert.equal(records.get(`events/${records.get(`players/${id}`).lastEvent}`).from,'BRANCO');
});
