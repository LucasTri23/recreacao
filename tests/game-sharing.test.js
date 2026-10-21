import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roundSummary,fixtureText} from '../public/game-sharing.js';
const week = {weekId:'2026-10-19',gameDate:'2026-10-25',teams:['BRANCO','COIOTES','VERDE','BLUES'],matchTimes:['20:30',''],matchFields:['Santa Cruz',''],notes:'Chegar cedo'};
const squads = [{weekId:week.weekId,teamId:'BRANCO',draftId:'new'},{weekId:'2026-10-12',teamId:'COIOTES',draftId:'old'},{weekId:week.weekId,teamId:'OUTRO',draftId:'extra'}];
const entries = [
  {weekId:week.weekId,teamId:'BRANCO',draftId:'new',position:1,name:'Lucas',issue:'otherTeam',congregation:'DADO PRIVADO'},
  {weekId:week.weekId,teamId:'BRANCO',draftId:'new',position:0,name:'Felipe',issue:'ok'},
  {weekId:week.weekId,teamId:'BRANCO',draftId:'old',name:'ANTIGO',issue:'ok'},
  {weekId:week.weekId,teamId:'OUTRO',draftId:'new',name:'FORA',issue:'ok'}
];
test('resumo considera apenas os times programados e envios da semana atual', () => {
  assert.deepEqual(roundSummary(week,squads),{submitted:['BRANCO'],pending:['COIOTES','VERDE','BLUES']});
  assert.deepEqual(roundSummary(null,squads),{submitted:[],pending:[]});
});
test('texto contém detalhes do confronto, versão publicada e avisos sem dados privados', () => {
  const text = fixtureText(week,0,squads,entries,id => id);
  assert.match(text,/BRANCO × COIOTES/); assert.match(text,/25\/10\/2026/); assert.match(text,/20:30 \(Brasília\)/); assert.match(text,/Santa Cruz/);
  assert.match(text,/1\. FELIPE\n2\. LUCAS ⚠ Jogador não pertence a este time/);
  assert.match(text,/COIOTES\n⏳ Aguardando escalação/); assert.match(text,/Chegar cedo/);
  assert.doesNotMatch(text,/DADO PRIVADO|ANTIGO|FORA|draftId/);
});
test('compartilhamento informa dados indefinidos e permite avisos atualizados', () => {
  assert.match(fixtureText(week,1,squads,entries,id => id),/Horário: a definir\nCampo: a definir/);
  assert.match(fixtureText(week,0,squads,entries,id => id,() => 'inactive'),/Cadastro inativo/);
  assert.match(fixtureText(week,0,squads,[],id => id),/Escalação indisponível/);
});
