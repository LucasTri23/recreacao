import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseApi,ensureAccessProfile} from '../public/firebase-store.js';
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
  return {api:createFirebaseApi(sdk, {}, {currentUser:{uid:'director'}}), records, sdk};
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
test('primeiro login solicita acesso sem escolher time ou se promover', async () => {
  const {sdk,records} = setup({role:'admin'});
  await ensureAccessProfile(sdk,{}, {uid:'new',displayName:'Diretor novo',email:'diretor@example.com'});
  assert.equal(records.get('users/new').role,'pending');
  assert.equal(records.get('users/new').team,'');
  await ensureAccessProfile(sdk,{}, {uid:'director',displayName:'Admin',email:'admin@example.com'});
  assert.equal(records.get('users/director').role,'admin');
});
test('administrador vincula, troca o time e suspende acesso preservando identidade', async () => {
  const {api,records} = setup({role:'admin'}, {'users/new':{role:'pending',team:'',email:'diretor@example.com',displayName:'Diretor'}});
  await api('assignDirector',{uid:'new',team:'VERDE'});
  assert.equal(records.get('users/new').role,'director');
  assert.equal(records.get('users/new').team,'VERDE');
  await api('assignDirector',{uid:'new',team:'BRANCO'});
  assert.equal(records.get('users/new').team,'BRANCO');
  await api('assignDirector',{uid:'new',team:''});
  assert.equal(records.get('users/new').role,'pending');
  assert.equal(records.get('users/new').email,'diretor@example.com');
});
test('diretor não vincula acessos e admin não altera administradores', async () => {
  const director = setup({role:'director',team:'VERDE'}, {'users/new':{role:'pending',team:''}});
  await assert.rejects(director.api('assignDirector',{uid:'new',team:'BRANCO'}),/administração/);
  const admin = setup({role:'admin'}, {'users/other':{role:'admin'}});
  await assert.rejects(admin.api('assignDirector',{uid:'director',team:'BRANCO'}),/inválida/);
  await assert.rejects(admin.api('assignDirector',{uid:'other',team:'BRANCO'}),/administração/);
  await assert.rejects(admin.api('assignDirector',{uid:'missing',team:'BRANCO'}),/uma vez/);
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
