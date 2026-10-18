import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekStart,weekDeadline,canSubmitSquad,compareGameList,gameWeekDetails,gameListEntries,gameEntryIssue,extractGameNames} from '../public/game-day.js';
import {DEFAULT_TEAMS} from '../public/teams.js';
const players = [{id:'a',name:'GABRIEL SLV',congregation:'CENTRO',teams:['VERDE']},{id:'b',name:'GABRIEL SOUZA',congregation:'NORTE',teams:['VERDE']},{id:'c',name:'JOÃO SILVA',congregation:'CENTRO',teams:['VERDE']},{id:'d',name:'PEDRO',congregation:'CENTRO',teams:['BRANCO']},{id:'e',name:'INATIVO',congregation:'CENTRO',teams:['VERDE'],status:'inactive'}];
test('extrai jogadores de lista de WhatsApp com cabeçalho e comissão técnica', () => {
  const text = `**BRANCO X COYOTES
*CAMPO SANTA CRUZ
* DIA 16/10
*HORÁRIO 20:30
*VALOR 37 REAIS*
PIX 000000000-00
DIENIS*

FELIPE GOLEIRO ✅
FRANK ✅
PETER✅
HELBIM ✅
GABRIEL
WALACE ✅
DIENIN ✅
LUCAS TEIXEIRA ✅
LUCCA ✅
PEDRINHO ✅
LUCAS TRI ✅
DANIEL MARQUES ✅
GUIZÃO✅
LUIZ HENRIQUE

TEC. ELTON`;
  assert.deepEqual(extractGameNames(text).map(row => row.name),['DIENIS','FELIPE','FRANK','PETER','HELBIM','GABRIEL','WALACE','DIENIN','LUCAS TEIXEIRA','LUCCA','PEDRINHO','LUCAS TRI','DANIEL MARQUES','GUIZÃO','LUIZ HENRIQUE']);
});
test('retira posição e numeração sem perder nomes e compara o nome limpo', () => {
  assert.deepEqual(extractGameNames('1. ZAG: João Silva ✅\nGOL - Felipe\nLAT. Pedro\n(ATA) Lucas\nGabriel (VOL)\nLD Marcos\nLE: Luiz\nMEIA Daniel\nTEC Elton').map(row => row.name),['João Silva','Felipe','Pedro','Lucas','Gabriel','Marcos','Luiz','Daniel']);
  assert.equal(compareGameList('ZAG: JOÃO SILVA ✅',players,'VERDE')[0].selectedId,'c');
  assert.equal(compareGameList(Array(55).fill('CAMPO SANTA CRUZ').join('\n')+'\nPedro',players,'VERDE').length,1);
});
test('semana começa segunda e prazo inclui quinta inteira em Brasília', () => {
  assert.equal(weekStart('2026-10-25'),'2026-10-19');
  assert.deepEqual(weekDeadline('2026-10-25'),{cutoff:'2026-10-22',deadline:Date.parse('2026-10-23T03:00:00Z')});
  assert.equal(weekDeadline('2026-10-20').cutoff,'2026-10-15');
  const week = gameWeekDetails({gameDate:'2026-10-25',teams:['VERDE'],status:'open'},DEFAULT_TEAMS);
  assert.ok(canSubmitSquad({role:'director',team:'VERDE'},week,'VERDE',DEFAULT_TEAMS,week.deadline-1));
  assert.equal(canSubmitSquad({role:'director',team:'VERDE'},week,'VERDE',DEFAULT_TEAMS,week.deadline),false);
  assert.ok(canSubmitSquad({role:'admin'},{...week,status:'closed'},'VERDE',DEFAULT_TEAMS,week.deadline+10000));
  assert.equal(canSubmitSquad({role:'director',team:'BRANCO'},week,'VERDE',DEFAULT_TEAMS,1),false);
  assert.equal(canSubmitSquad({role:'admin'},week,'BRANCO',DEFAULT_TEAMS,1),false);
  assert.throws(() => weekStart('2026-02-30'),/válida/);
});
test('TXT permite publicar pendências, enquanto identificação do problema é explícita', () => {
  const rows = compareGameList('Gabriel\nPedro\nInativo\nDesconhecido',players,'VERDE'), entries = gameListEntries(rows);
  assert.equal(entries.length,4); assert.equal(entries[0].playerId,''); assert.equal(entries[1].playerId,'d');
  assert.deepEqual(entries.map(entry => gameEntryIssue(players.find(p => p.id === entry.playerId),'VERDE')),['unknown','otherTeam','inactive','unknown']);
  assert.throws(() => gameListEntries([{selectedId:'a',name:'A'},{selectedId:'a',name:'A'}]),/mais de uma linha/);
});
test('Gabriel abre confirmação entre candidatos; correspondência exata única é resolvida', () => {
  const rows = compareGameList('1. Gabriel\n2. João Silva\n3. Pedro\n4. Inativo',players,'VERDE');
  assert.equal(rows[0].selectedId,''); assert.equal(rows[0].candidates.length,2);
  assert.equal(rows[1].selectedId,'c');
  assert.equal(rows[2].candidates.length,0); assert.equal(rows[2].outside[0].id,'d');
  assert.equal(rows[3].candidates.length,0);
  assert.equal(gameListEntries(rows).length,4);
  rows[0].selectedId = 'a'; rows[2].ignored = rows[3].ignored = true;
  assert.deepEqual(gameListEntries(rows).map(entry => entry.playerId),['a','c']);
});
test('não permite jogador repetido nem lista vazia; mantém escolha explícita de homônimos', () => {
  assert.throws(() => gameListEntries([{selectedId:'a',name:'A'},{selectedId:'a',name:'A'}]),/mais de uma linha/);
  assert.throws(() => gameListEntries([{ignored:true}]),/1 a 50/);
  assert.throws(() => compareGameList(Array(51).fill('Nome').join('\n'),players,'VERDE'),/50/);
  const sameName = [...players,{...players[0],id:'f'}];
  assert.equal(compareGameList('GABRIEL SLV',sameName,'VERDE')[0].selectedId,'');
});
