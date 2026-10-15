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

test('login atualiza e-mail de conta antiga preservando permissão e time', async () => {
  const {sdk,records} = setup({role:'director',team:'VERDE'});
  await ensureAccessProfile(sdk,{}, {uid:'director',displayName:'João',email:'joao@gmail.com'});
  assert.deepEqual(records.get('users/director'),{role:'director',team:'VERDE',displayName:'João',email:'joao@gmail.com'});
});

test('regras antigas não bloqueiam login quando apenas a atualização de perfil é negada', async () => {
  const {sdk} = setup({role:'admin'});
  const run = sdk.runTransaction;
  sdk.runTransaction = (_,callback) => run(_,tx => callback({...tx,set:() => { throw Object.assign(new Error('Denied'),{code:'permission-denied'}); }}));
  assert.deepEqual(await ensureAccessProfile(sdk,{}, {uid:'director',email:'admin@gmail.com'}),{metadataSyncPending:true});
  await assert.rejects(ensureAccessProfile(sdk,{}, {uid:'new',email:'new@gmail.com'}),{code:'permission-denied'});
});

test('administrador inscreve em qualquer time e adiciona segundo time com janela fechada', async () => {
  const {api,records} = setup({role:'admin'}, {'settings/transfers':{open:false}});
  const {TEAMS} = await import('../public/domain.js');
  for (const team of TEAMS) {
    await api('addPlayer',{name:`Jogador ${team}`,congregation:'Centro',team});
    const id = await playerId(`Jogador ${team}`,'Centro');
    assert.deepEqual(records.get(`players/${id}`).teams,[team]);
  }
  await api('addPlayer',{name:'Jogador BRANCO',congregation:'Centro',team:'VERDE'});
  const id = await playerId('Jogador BRANCO','Centro');
  const player = records.get(`players/${id}`);
  assert.deepEqual(player.teams,['BRANCO','VERDE']);
  assert.equal(records.get(`events/${player.lastEvent}`).to,'VERDE');
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

async function mergeFixture(profile = {role:'admin'}, sourceTeams = ['VERDE'], targetTeams = ['BRANCO']) {
  const sourceId = await playerId('Joao Silva','Centro'), targetId = await playerId('João da Silva','Centro');
  const seed = {
    [`players/${sourceId}`]:{name:'Joao Silva',congregation:'Centro',teams:sourceTeams,lastEvent:'old-source'},
    [`players/${targetId}`]:{name:'João da Silva',congregation:'Centro',teams:targetTeams,lastEvent:'old-target'},
    'events/old-source':{name:'Joao Silva',kind:'add'},'events/old-target':{name:'João da Silva',kind:'add'}
  };
  return {...setup(profile,seed),sourceId,targetId};
}
test('admin unifica atomicamente, preserva histórico e impede terceiro time pelo nome antigo', async () => {
  const {api,records,sourceId,targetId} = await mergeFixture();
  await api('mergePlayers',{sourceId,targetId});
  const source = records.get(`players/${sourceId}`), target = records.get(`players/${targetId}`);
  assert.equal(source.mergedInto,targetId); assert.deepEqual(source.teams,[]);
  assert.deepEqual(target.teams,['BRANCO','VERDE']); assert.equal(source.lastEvent,target.lastEvent);
  const event = records.get(`events/${target.lastEvent}`);
  assert.equal(event.kind,'merge'); assert.deepEqual(event.sourceTeams,['VERDE']); assert.deepEqual(event.targetTeams,['BRANCO']);
  assert.ok(records.has('events/old-source')); assert.ok(records.has('events/old-target'));
  await assert.rejects(api('addPlayer',{name:'Joao Silva',congregation:'Centro',team:'BLUES'}),/dois times/);
  await assert.rejects(api('mergePlayers',{sourceId,targetId}),/já unificado/);
});
test('unificação rejeita diretor, mesmo cadastro, cadastro ausente e união acima do limite sem gravar', async () => {
  const director = await mergeFixture({role:'director',team:'VERDE'});
  await assert.rejects(director.api('mergePlayers',director),/administração/);
  const fixture = await mergeFixture({role:'admin'},['VERDE','BLUES'],['BRANCO']);
  const before = JSON.stringify([...fixture.records]);
  await assert.rejects(fixture.api('mergePlayers',fixture),/mais de dois/);
  await assert.rejects(fixture.api('mergePlayers',{sourceId:fixture.sourceId,targetId:fixture.sourceId}),/diferentes/);
  await assert.rejects(fixture.api('mergePlayers',{sourceId:fixture.sourceId,targetId:'a'.repeat(64)}),/alterado/);
  assert.equal(JSON.stringify([...fixture.records]),before);
});
test('inscrição pelo cadastro antigo redireciona para o mantido e registra o id correto', async () => {
  const {api,records,sourceId,targetId} = await mergeFixture({role:'admin'},['VERDE'],['VERDE']);
  await api('mergePlayers',{sourceId,targetId});
  await api('addPlayer',{name:'Joao Silva',congregation:'Centro',team:'BLUES'});
  const target = records.get(`players/${targetId}`);
  assert.deepEqual(target.teams,['VERDE','BLUES']);
  assert.equal(records.get(`events/${target.lastEvent}`).playerId,targetId);
  assert.deepEqual(records.get(`players/${sourceId}`).teams,[]);
});
