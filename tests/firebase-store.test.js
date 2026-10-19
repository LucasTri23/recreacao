import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseApi,ensureAccessProfile} from '../public/firebase-store.js';
import {playerId,reviewKey} from '../public/domain.js';
import {DEFAULT_TEAMS} from '../public/teams.js';

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

test('admin cadastra UZIEL LUCAS no PRETO com congregação acentuada e sem vínculo de time', async () => {
  const {api,records} = setup({role:'admin',displayName:'Outro Admin',email:'admin@example.com'});
  await api('addPlayer',{name:'UZIEL LUCAS',congregation:'GLÓRIA - BH',team:'PRETO'});
  const id = await playerId('UZIEL LUCAS','GLÓRIA - BH');
  assert.deepEqual(records.get('players/'+id).teams,['PRETO']);
  assert.equal(records.get('players/'+id).congregation,'GLÓRIA - BH');
  assert.equal(records.get('events/e1').actorName,'Outro Admin');
});
test('cidade obrigatória no formulário compõe a identidade e edição preserva abreviação antiga', async () => {
  const {api,records,sdk} = setup({role:'admin'});
  await api('addPlayer',{name:'Cidade Teste',congregation:'Vera Cruz de Minas',city:'Pedro Leopoldo',team:'PRETO'});
  const id = await playerId('Cidade Teste','VERA CRUZ DE MINAS - PEDRO LEOPOLDO');
  assert.equal(records.get('players/'+id).city,'Pedro Leopoldo');
  await assert.rejects(api('addPlayer',{name:'Cidade Inválida',congregation:'Centro',city:'Outra',team:'PRETO'}),/cidade da lista/);
  const oldId = await playerId('Antigo Teste','GLÓRIA - BH');
  records.set('players/'+oldId,{name:'ANTIGO TESTE',congregation:'GLÓRIA - BH',teams:['PRETO'],updatedAt:1,lastEvent:'old'});
  const legacyApi = createFirebaseApi(sdk,{}, {currentUser:{uid:'director'}},() => ['GLÓRIA - BH']);
  await legacyApi('editPlayer',{id:oldId,name:'Antigo Teste',congregation:'Glória',city:'Belo Horizonte'});
  assert.equal(records.get('players/'+oldId).city,'Belo Horizonte');
  assert.equal(records.get('players/'+oldId).congregation,'GLÓRIA - BH');
  assert.equal(records.get('players/'+oldId).mergedInto,undefined);
  await legacyApi('addPlayer',{name:'Antigo Teste',congregation:'Glória',city:'Belo Horizonte',team:'BRANCO'});
  assert.deepEqual(records.get('players/'+oldId).teams,['PRETO','BRANCO']);
});
test('goleiro entra em três times, não duplica inscrição e só admin muda a classificação existente', async () => {
  const {api,records} = setup({role:'admin'});
  const id = await playerId('Goleiro Teste','Centro');
  await api('addPlayer',{name:'Goleiro Teste',congregation:'Centro',team:'PRETO',goalkeeper:true});
  for (const team of ['BRANCO','VERDE']) await api('addPlayer',{name:'Goleiro Teste',congregation:'Centro',team,goalkeeper:false});
  assert.deepEqual(records.get('players/'+id).teams,['PRETO','BRANCO','VERDE']);
  assert.equal(records.get('players/'+id).goalkeeper,true);
  await assert.rejects(api('addPlayer',{name:'Goleiro Teste',congregation:'Centro',team:'PRETO'}),/já está/);
  await assert.rejects(api('editPlayer',{id,name:'Goleiro Teste',congregation:'Centro',goalkeeper:false}),/Reduza/);
  await api('editPlayer',{id,name:'Goleiro Alterado',congregation:'Centro',goalkeeper:true});
  assert.equal(records.get('players/'+await playerId('Goleiro Alterado','Centro')).teams.length,3);
});
test('marcar goleiro no envio não promove jogador já existente; admin pode editar primeiro', async () => {
  const {api,records} = setup({role:'admin'});
  const data = {name:'Linha Teste',congregation:'Centro'}, id = await playerId(data.name,data.congregation);
  for (const team of ['PRETO','BRANCO']) await api('addPlayer',{...data,team});
  await assert.rejects(api('addPlayer',{...data,team:'VERDE',goalkeeper:true}),/dois times/);
  await api('editPlayer',{id,...data,goalkeeper:true});
  await api('addPlayer',{...data,team:'VERDE'});
  assert.equal(records.get('players/'+id).teams.length,3);
  records.set('users/director',{role:'director',team:'PRETO'});
  await assert.rejects(api('editPlayer',{id,...data,goalkeeper:false}),/administração/);
});
test('inscrição persiste jogador e histórico juntos e rejeita outro time', async () => {
  const {api,records} = setup({role:'director',team:'VERDE',displayName:'João Diretor'});
  await assert.rejects(api('addPlayer',{name:'João Silva',congregation:'Centro',team:'BLUES'}),/próprio time/);
  assert.equal(records.size,1);
  await api('addPlayer',{name:'João Silva',congregation:'Centro',team:'VERDE'});
  const id = await playerId('João Silva','Centro');
  const player = records.get(`players/${id}`);
  assert.deepEqual(player.teams,['VERDE']);
  assert.equal(records.get(`events/${player.lastEvent}`).playerId,id);
  assert.equal(records.get(`events/${player.lastEvent}`).actorName,'João Diretor');
  assert.equal(records.get(`events/${player.lastEvent}`).actor,'director');
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

test('admin inativa, exclui e restaura preservando times e histórico e bloqueando inscrições', async () => {
  const {api,records,sourceId} = await mergeFixture();
  const before = records.get(`players/${sourceId}`);
  for (const status of ['inactive','deleted']) {
    await api('setPlayerStatus',{id:sourceId,status});
    const p = records.get(`players/${sourceId}`);
    assert.equal(p.status,status); assert.deepEqual(p.teams,before.teams);
    assert.equal(records.get(`events/${p.lastEvent}`).kind,'status');
    await assert.rejects(api('addPlayer',{name:before.name,congregation:before.congregation,team:'BLUES'}),/inativo ou excluído/);
    await assert.rejects(api('transferPlayer',{id:sourceId,from:'VERDE',to:'BLUES'}),/inativo ou excluído/);
  }
  await assert.rejects(api('editPlayer',{id:sourceId,name:'João Novo',congregation:'Norte'}),/Restaure/);
  await api('setPlayerStatus',{id:sourceId,status:'active'});
  await api('addPlayer',{name:before.name,congregation:before.congregation,team:'BLUES'});
  assert.deepEqual(records.get(`players/${sourceId}`).teams,['VERDE','BLUES']);
  assert.ok(records.has('events/old-source'));
});

test('diretor não edita, inativa ou exclui jogadores e situação inválida não grava', async () => {
  const director = await mergeFixture({role:'director',team:'VERDE'});
  const before = JSON.stringify([...director.records]);
  for (const status of ['inactive','deleted','active']) await assert.rejects(director.api('setPlayerStatus',{id:director.sourceId,status}),/administração/);
  await assert.rejects(director.api('editPlayer',{id:director.sourceId,name:'Outro nome',congregation:'Norte'}),/administração/);
  assert.equal(JSON.stringify([...director.records]),before);
  const admin = await mergeFixture();
  await assert.rejects(admin.api('setPlayerStatus',{id:admin.sourceId,status:'invalid'}),/inválida/);
  await assert.rejects(admin.api('setPlayerStatus',{id:admin.sourceId,status:'active'}),/já está/);
});

test('edição move a identidade, preserva situação e redireciona inscrições pelo nome antigo', async () => {
  const {api,records,sourceId} = await mergeFixture();
  await api('setPlayerStatus',{id:sourceId,status:'inactive'});
  await api('editPlayer',{id:sourceId,name:'João Silva Corrigido',congregation:'Norte'});
  const id = await playerId('João Silva Corrigido','Norte');
  const p = records.get(`players/${id}`);
  assert.equal(p.status,'inactive'); assert.deepEqual(p.teams,['VERDE']);
  assert.equal(records.get(`players/${sourceId}`).mergedInto,id);
  assert.deepEqual(records.get(`players/${sourceId}`).teams,[]);
  assert.equal(records.get(`events/${p.lastEvent}`).previousName,'Joao Silva');
  await assert.rejects(api('addPlayer',{name:'Joao Silva',congregation:'Centro',team:'BLUES'}),/inativo ou excluído/);
  await api('setPlayerStatus',{id,status:'active'});
  await api('addPlayer',{name:'Joao Silva',congregation:'Centro',team:'BLUES'});
  assert.deepEqual(records.get(`players/${id}`).teams,['VERDE','BLUES']);
});

test('edição rejeita identidade existente e dados inválidos; ajuste de caixa preserva o id', async () => {
  const {api,records,sourceId} = await mergeFixture();
  const before = JSON.stringify([...records]);
  await assert.rejects(api('editPlayer',{id:sourceId,name:'João da Silva',congregation:'Centro'}),/Já existe/);
  await assert.rejects(api('editPlayer',{id:sourceId,name:'A',congregation:'Centro'}),/válidos/);
  assert.equal(JSON.stringify([...records]),before);
  await api('editPlayer',{id:sourceId,name:'JOÃO SILVA',congregation:'CENTRO'});
  assert.equal(records.get(`players/${sourceId}`).name,'JOÃO SILVA');
  assert.equal(records.get(`players/${sourceId}`).mergedInto,undefined);
});

test('admin cria time dinâmico e inscreve jogador, vincula diretor e transfere para ele', async () => {
  const id = await playerId('João Silva','Centro');
  const {api,records} = setup({role:'admin'},{'users/new':{role:'pending',team:''},'settings/transfers':{open:true}});
  await api('createTeam',{id:'team_roxo',name:'Roxo',color:'purple',badge:'🟣'});
  assert.equal(Object.keys(records.get('settings/teams').items).length,9);
  await api('addPlayer',{name:'João Silva',congregation:'Centro',team:'team_roxo'});
  await api('assignDirector',{uid:'new',team:'team_roxo'});
  assert.equal(records.get('users/new').team,'team_roxo');
  await api('transferPlayer',{id,from:'team_roxo',to:'VERDE'});
  await api('transferPlayer',{id,from:'VERDE',to:'team_roxo'});
  const player = records.get(`players/${id}`);
  assert.deepEqual(player.teams,['team_roxo']);
  assert.equal(records.get(`events/${player.lastEvent}`).detail,'VERDE → ROXO');
});

test('renomear time mantém o id, inscrições e vínculo do diretor e não altera os outros times', async () => {
  const playerIdValue = await playerId('João Silva','Centro');
  const {api,records} = setup({role:'admin'},{'users/new':{role:'director',team:'VERDE'}});
  await api('addPlayer',{name:'João Silva',congregation:'Centro',team:'VERDE'});
  const playerBefore = {...records.get(`players/${playerIdValue}`)};
  await api('editTeam',{id:'VERDE',name:'Esmeralda',color:'green',badge:'🟢'});
  const catalog = records.get('settings/teams');
  assert.equal(catalog.items.VERDE.name,'ESMERALDA');
  assert.deepEqual(catalog.items.BRANCO,DEFAULT_TEAMS.BRANCO);
  assert.deepEqual(records.get(`players/${playerIdValue}`),playerBefore);
  assert.equal(records.get('users/new').team,'VERDE');
  const event = records.get(`events/${catalog.lastEvent}`);
  assert.equal(event.previous.name,'VERDE'); assert.equal(event.next.name,'ESMERALDA');
});

test('inativar e excluir time preserva vínculos e bloqueia novas entradas, mas permite saída e restauração', async () => {
  const id = await playerId('João Silva','Centro');
  const {api,records} = setup({role:'admin'},{'users/new':{role:'pending',team:''},'settings/transfers':{open:true}});
  await api('addPlayer',{name:'João Silva',congregation:'Centro',team:'VERDE'});
  for (const status of ['inactive','deleted']) {
    await api('setTeamStatus',{id:'VERDE',status});
    assert.deepEqual(records.get(`players/${id}`).teams,['VERDE']);
    await assert.rejects(api('addPlayer',{name:'Outro Jogador',congregation:'Centro',team:'VERDE'}),/inativo ou excluído/);
    await assert.rejects(api('assignDirector',{uid:'new',team:'VERDE'}),/inativo ou excluído/);
  }
  await api('transferPlayer',{id,from:'VERDE',to:'BRANCO'});
  await assert.rejects(api('transferPlayer',{id,from:'BRANCO',to:'VERDE'}),/inativo ou excluído/);
  await assert.rejects(api('editTeam',{id:'VERDE',name:'Nome',color:'blue',badge:'C'}),/Restaure/);
  await api('setTeamStatus',{id:'VERDE',status:'active'});
  await api('transferPlayer',{id,from:'BRANCO',to:'VERDE'});
  assert.deepEqual(records.get(`players/${id}`).teams,['VERDE']);
});

test('diretor não gerencia times e duplicatas ou campos inválidos não geram escrita', async () => {
  const director = setup({role:'director',team:'VERDE'});
  for (const action of ['createTeam','editTeam','setTeamStatus']) await assert.rejects(director.api(action,{id:'VERDE',status:'inactive'}),/administração/);
  assert.equal(director.records.size,1);
  const {api,records} = setup({role:'admin'});
  await assert.rejects(api('createTeam',{id:'new',name:'  vérde ',color:'green',badge:'🟢'}),/Já existe/);
  await assert.rejects(api('createTeam',{id:'bad/id',name:'Time',color:'blue',badge:'C'}),/inválido/);
  await assert.rejects(api('editTeam',{id:'VERDE',name:'Time',color:'invalid',badge:'C'}),/cor válida/);
  await assert.rejects(api('setTeamStatus',{id:'VERDE',status:'invalid'}),/inválida/);
  assert.equal(records.size,1);
});

test('diretor do time novo só inscreve no próprio time e limite de dois times continua válido', async () => {
  const items = {...DEFAULT_TEAMS,team_roxo:{name:'ROXO',color:'purple',badge:'🟣',status:'active'}};
  const {api,records} = setup({role:'director',team:'team_roxo'},{'settings/teams':{items}});
  await api('addPlayer',{name:'João Silva',congregation:'Centro',team:'team_roxo'});
  await assert.rejects(api('addPlayer',{name:'Maria Silva',congregation:'Centro',team:'BRANCO'}),/próprio time/);
  const admin = setup({role:'admin'},Object.fromEntries([...records].filter(([key]) => key !== 'users/director')));
  await admin.api('addPlayer',{name:'João Silva',congregation:'Centro',team:'BRANCO'});
  await assert.rejects(admin.api('addPlayer',{name:'João Silva',congregation:'Centro',team:'BLUES'}),/dois times/);
});

test('admin conclui e reabre revisão, com identidade e histórico, preservando jogadores', async () => {
  const {api,records,sourceId,targetId} = await mergeFixture();
  const before = [records.get(`players/${sourceId}`),records.get(`players/${targetId}`)];
  await api('reviewDuplicates',{sourceId:targetId,targetId:sourceId,different:true});
  const key = reviewKey(sourceId,targetId), review = records.get(`duplicateReviews/${key}`);
  assert.equal(review.different,true); assert.ok(review.sourceId < review.targetId);
  assert.equal(review.sourceName,records.get(`players/${review.sourceId}`).name);
  assert.equal(records.get(`events/${review.lastEvent}`).reviewId,key);
  await api('reviewDuplicates',{sourceId,targetId,different:false});
  const reopened = records.get(`duplicateReviews/${key}`);
  assert.equal(reopened.different,false); assert.notEqual(reopened.lastEvent,review.lastEvent);
  assert.deepEqual([records.get(`players/${sourceId}`),records.get(`players/${targetId}`)],before);
});
test('diretor não conclui revisão e pares inválidos ou inativos não gravam', async () => {
  const director = await mergeFixture({role:'director',team:'VERDE'});
  await assert.rejects(director.api('reviewDuplicates',{...director,different:true}),/administração/);
  const admin = await mergeFixture(); const before = JSON.stringify([...admin.records]);
  await assert.rejects(admin.api('reviewDuplicates',{sourceId:admin.sourceId,targetId:admin.sourceId,different:true}),/inválida/);
  await assert.rejects(admin.api('reviewDuplicates',{...admin,different:'true'}),/inválida/);
  assert.equal(JSON.stringify([...admin.records]),before);
  await admin.api('setPlayerStatus',{id:admin.sourceId,status:'inactive'});
  await assert.rejects(admin.api('reviewDuplicates',{...admin,different:true}),/inativos/);
});
