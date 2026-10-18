import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGameApi} from '../public/game-store.js';
import {playerId} from '../public/domain.js';

async function fixture() {
  const records = new Map([['users/u',{role:'admin',displayName:'Admin'}]]); let sequence = 0, clock = Date.parse('2026-10-22T20:00:00Z');
  const sdk = {
    collection:(_,path) => ({path}),
    doc:(...args) => args.length === 1 ? {path:`events/e${++sequence}`,id:`e${sequence}`} : {path:args.slice(1).join('/')},
    serverTimestamp:() => 1000,
    runTransaction:async (_,callback) => { const writes = []; const result = await callback({get:async ref => ({data:() => records.get(ref.path)}),set:(ref,data) => writes.push([ref.path,data])}); writes.forEach(([key,data]) => records.set(key,data)); return result; }
  };
  const api = createGameApi(sdk,{}, {currentUser:{uid:'u'}},() => clock);
  const ids = [];
  for (let i=0;i<12;i++) { const name = `JOGADOR ${i}`, id = await playerId(name,'CENTRO'); ids.push(id); records.set(`players/${id}`,{name,congregation:'CENTRO',teams:['VERDE']}); }
  await api('saveGameWeek',{gameDate:'2026-10-25',teams:['VERDE','BRANCO'],status:'open',notes:'Rodada'});
  return {api,records,ids,setClock:time => clock=time};
}
test('admin programa a semana e diretor publica somente jogadores do próprio time',async () => {
  const {api,records,ids} = await fixture(); records.set('users/u',{role:'director',team:'VERDE'});
  await api('submitGameSquad',{weekId:'2026-10-19',teamId:'VERDE',playerIds:ids});
  const squad = records.get('gameSquads/2026-10-19_VERDE');
  assert.ok(squad); assert.equal(records.get(`events/${squad.lastEvent}`).kind,'gameSquad');
  assert.equal([...records.values()].filter(v => v.draftId === squad.draftId && v.playerId).length,12);
  await assert.rejects(api('submitGameSquad',{weekId:'2026-10-19',teamId:'BRANCO',playerIds:[ids[0]]}),/bloqueado/);
  await assert.rejects(api('saveGameWeek',{gameDate:'2026-10-25',teams:['VERDE'],status:'open'}),/administração/);
});
test('diretor não envia depois de quinta; admin corrige depois do prazo',async () => {
  const {api,records,ids,setClock} = await fixture(); setClock(Date.parse('2026-10-23T03:00:00Z')); records.set('users/u',{role:'director',team:'VERDE'});
  await assert.rejects(api('submitGameSquad',{weekId:'2026-10-19',teamId:'VERDE',playerIds:[ids[0]]}),/bloqueado/);
  records.set('users/u',{role:'admin'});
  await api('submitGameSquad',{weekId:'2026-10-19',teamId:'VERDE',playerIds:[ids[0]]});
  const old = records.get('gameSquads/2026-10-19_VERDE').draftId;
  await api('submitGameSquad',{weekId:'2026-10-19',teamId:'VERDE',playerIds:[ids[1]]});
  assert.notEqual(records.get('gameSquads/2026-10-19_VERDE').draftId,old);
});
test('publica jogador de outro time com aviso e continua recusando jogador repetido',async () => {
  const {api,records,ids} = await fixture();
  await api('submitGameSquad',{weekId:'2026-10-19',teamId:'VERDE',playerIds:[ids[0]]});
  const old = records.get('gameSquads/2026-10-19_VERDE'); records.get(`players/${ids[1]}`).teams = ['BRANCO'];
  await api('submitGameSquad',{weekId:'2026-10-19',teamId:'VERDE',playerIds:ids.slice(0,5)});
  const current = records.get('gameSquads/2026-10-19_VERDE'); assert.notEqual(current,old);
  const warning = [...records.values()].find(row => row.draftId === current.draftId && row.playerId === ids[1]);
  assert.equal(warning.issue,'otherTeam');
  await assert.rejects(api('submitGameSquad',{weekId:'2026-10-19',teamId:'VERDE',playerIds:[ids[0],ids[0]]}),/não repita/);
});
test('mudança de cadastro durante a conferência e edição concorrente não publicam escalação obsoleta',async () => {
  const {api,records,ids} = await fixture();
  await assert.rejects(api('submitGameSquad',{weekId:'2026-10-19',teamId:'VERDE',playerIds:[ids[0]],onProgress:() => { records.get(`players/${ids[0]}`).status = 'inactive'; }}),/mudou durante/);
  assert.equal(records.has('gameSquads/2026-10-19_VERDE'),false);
  await assert.rejects(api('submitGameSquad',{weekId:'2026-10-19',teamId:'VERDE',playerIds:[ids[1]],onProgress:() => { records.set('gameSquads/2026-10-19_VERDE',{draftId:'other'}); }}),/Outra escalação/);
  assert.equal(records.get('gameSquads/2026-10-19_VERDE').draftId,'other');
});

test('publica nomes sem cadastro e inativos com avisos persistidos e sem congregação pública',async () => {
  const {api,records,ids} = await fixture(); records.get(`players/${ids[0]}`).status = 'inactive';
  await api('submitGameSquad',{weekId:'2026-10-19',teamId:'VERDE',entries:[{playerId:'',rawName:'Gabriel sem confirmar'},{playerId:ids[0],rawName:'Jogador inativo'}]});
  const squad = records.get('gameSquads/2026-10-19_VERDE'), lineup = [...records.values()].filter(row => row.draftId === squad.draftId && row.position !== undefined);
  assert.equal(lineup.length,2); assert.deepEqual(lineup.map(row => row.issue),['unknown','inactive']);
  assert.ok(lineup.every(row => !('congregation' in row))); assert.equal(lineup[0].name,'Gabriel sem confirmar');
});
