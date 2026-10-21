import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {setupGameDay} from '../public/game-day-ui.js';
import {localDay,weekStart} from '../public/game-day.js';
import {DEFAULT_TEAMS} from '../public/teams.js';

function setup(t,role = 'director',published = false) {
  const {document,window} = parseHTML('<html><body><nav></nav><main><footer></footer></main></body></html>');
  window.Element.prototype.scrollIntoView = function() {};
  // LinkeDOM does not implement the select.value setter used by browsers.
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{
    configurable:true,
    get() { return (this.querySelector('option[selected]') || this.querySelector('option'))?.value || ''; },
    set(value) { for (const option of this.querySelectorAll('option')) option.toggleAttribute('selected',option.value === value); }
  });
  const previous = {document:globalThis.document,localStorage:globalThis.localStorage};
  const weekId = weekStart(localDay()), week = {weekId,gameDate:localDay(),teams:['VERDE','BRANCO'],teamNames:{VERDE:'VERDE',BRANCO:'BRANCO'},status:'open',cutoff:localDay(),deadline:Date.now()+86400000};
  const storage = new Map([['recreacao-games-demo',JSON.stringify({weeks:{[weekId]:week}})]]);
  if (published) storage.set('recreacao-games-demo',JSON.stringify({weeks:{[weekId]:week},squads:{[weekId+'_VERDE']:{weekId,teamId:'VERDE',draftId:'published'}},entries:{one:{weekId,teamId:'VERDE',draftId:'published',playerId:'a',name:'JOÃO SILVA',rawName:'João',position:0,issue:'ok'},two:{weekId,teamId:'VERDE',draftId:'published',playerId:'c',name:'LUCAS',rawName:'Lucas',position:1,issue:'ok'}}}));
  globalThis.document = document; globalThis.localStorage = {getItem:key => storage.get(key),setItem:(key,value) => storage.set(key,value)};
  const players = [{id:'a',name:'JOÃO SILVA',congregation:'CENTRO',teams:['VERDE']},{id:'b',name:'PEDRO',congregation:'CENTRO',teams:['BRANCO']}];
  if (published) players.push({id:'c',name:'LUCAS',congregation:'CENTRO',teams:['VERDE']});
  const element = (tag,text,className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  const notices = [];
  const ui = setupGameDay({element,getProfile:() => ({role,team:'VERDE'}),getUserId:() => 'u',getPlayers:() => players,getTeams:() => DEFAULT_TEAMS,mutate:async () => {},toast:text => notices.push(text),demo:true});
  t.after(() => { ui.dispose(); globalThis.document = previous.document; globalThis.localStorage = previous.localStorage; });
  ui.refresh();
  const button = text => [...document.querySelectorAll('button')].find(node => node.textContent === text);
  return {document,button,notices,storage};
}
test('diretor entra no próprio confronto e publica pela seleção em três passos',async t => {
  const {document,button,notices} = setup(t);
  assert.equal(document.querySelector('[data-page="gerenciar-rodada"] form').hidden,true);
  assert.equal(document.querySelector('[data-nav="gerenciar-rodada"]').hidden,true);
  button('Montar minha escalação').onclick();
  assert.equal([...document.querySelectorAll('label')].find(label => label.textContent.startsWith('Time da escalação')).hidden,true);
  assert.equal(button('Conferir lista').disabled,true);
  const check = document.querySelector('fieldset input[value="a"]'); check.checked = true; check.onchange();
  assert.match(document.querySelector('.game-selected-count').textContent,/1 jogador selecionado/);
  await button('Conferir lista').onclick();
  assert.equal(document.querySelector('.game-steps [aria-current="step"]').textContent,'Conferir pendências');
  assert.equal(document.querySelector('.duplicate-card details').hasAttribute('open'),false);
  await button('Revisar publicação').onclick();
  const publish = button('Publicar 1 jogador'); assert.equal(publish.disabled,true);
  const ack = document.querySelector('.game-panel>.duplicate-ack input'); ack.checked = true; ack.onchange();
  assert.equal(publish.disabled,false); await publish.onclick();
  assert.match(notices.at(-1),/Escalação publicada/);
  assert.ok(button('Editar minha escalação'));
});
test('TXT mostra resumo, deixa aviso publicar e preserva escolhas ao voltar',async t => {
  const {document,button} = setup(t); button('Montar minha escalação').onclick();
  const mode = [...document.querySelectorAll('select')].find(select => select.querySelector('option[value="txt"]')); mode.value = 'txt'; mode.onchange();
  const raw = [...document.querySelectorAll('textarea')].find(node => node.placeholder?.includes('COYOTES')); raw.value = 'João Silva\nPedro'; raw.oninput();
  assert.equal(button('Conferir lista').disabled,false); await button('Conferir lista').onclick();
  assert.match(document.querySelector('[data-page="dia-de-jogo"] .game-panel .notice').textContent,/2 nomes encontrados · 1 confirmado · 1 para conferir/);
  assert.ok(document.querySelector('.game-warning'));
  assert.equal(button('Revisar publicação').disabled,false);
  button('Voltar').onclick(); await button('Conferir lista').onclick();
  await button('Revisar publicação').onclick(); assert.ok(button('Publicar 2 jogadores'));
});
test('admin configura em página separada da consulta',t => {
  const {document} = setup(t,'admin');
  assert.equal(document.querySelector('[data-page="gerenciar-rodada"] form').hidden,false);
  assert.equal(document.querySelector('[data-page="dia-de-jogo"] form'),null);
});
test('visitante não vê o editor nem os controles de configuração',t => {
  const {document,button} = setup(t,'pending');
  assert.equal(document.querySelector('[data-page="gerenciar-rodada"] form').hidden,true);
  assert.equal(button('Montar minha escalação').parentElement.hidden,true);
  assert.equal(document.querySelector('.game-steps').parentElement.hidden,true);
});
test('jogador pode ser removido na conferência, restaurado e retirado antes de publicar',async t => {
  const {document,button} = setup(t); button('Montar minha escalação').onclick();
  const check = document.querySelector('fieldset input[value="a"]'); check.checked = true; check.onchange();
  assert.ok(button('Remover da escalação'));
  await button('Conferir lista').onclick();
  button('Remover da escalação').onclick();
  assert.match(document.querySelector('.game-selected-count').textContent,/0 jogadores/);
  assert.equal(button('Revisar publicação').disabled,true);
  button('Restaurar na escalação').onclick(); await button('Revisar publicação').onclick();
  const ack = document.querySelector('.game-panel>.duplicate-ack input'); ack.checked = true; ack.onchange();
  const preview = [...document.querySelectorAll('h4')].find(node => node.textContent === 'Confira a escalação que ficará pública').parentElement;
  preview.querySelector('button').onclick();
  assert.equal(ack.checked,false); assert.equal(button('Publicar 0 jogadores').disabled,true);
});
test('edição carrega confirmados marcados, mantém seleção entre modos e publica remoção',async t => {
  const {document,button,storage} = setup(t,'director',true);
  button('Editar minha escalação').onclick();
  assert.equal(document.querySelector('fieldset input[value="a"]').checked,true);
  assert.equal(document.querySelector('fieldset input[value="c"]').checked,true);
  const mode = [...document.querySelectorAll('select')].find(select => select.querySelector('option[value="txt"]'));
  mode.value = 'txt'; mode.onchange(); mode.value = 'roster'; mode.onchange();
  assert.equal(document.querySelector('fieldset input[value="a"]').checked,true);
  const remove = document.querySelector('button[aria-label="Remover João da escalação"]'); remove.onclick();
  assert.equal(document.querySelector('fieldset input[value="a"]').checked,false);
  assert.equal(document.querySelector('fieldset input[value="c"]').checked,true);
  await button('Conferir lista').onclick(); await button('Revisar publicação').onclick();
  const ack = document.querySelector('.game-panel>.duplicate-ack input'); ack.checked = true; ack.onchange();
  await button('Publicar 1 jogador').onclick();
  const saved = JSON.parse(storage.get('recreacao-games-demo')), squad = Object.values(saved.squads).find(s => s.teamId === 'VERDE');
  assert.deepEqual(Object.values(saved.entries).filter(e => e.draftId === squad.draftId).map(e => e.playerId),['c']);
});
test('admin exclui último confronto já escalado e salva a semana sem jogos',async t => {
  const {document,button,storage} = setup(t,'admin',true);
  button('Excluir jogo').onclick();
  assert.equal(document.querySelectorAll('.game-match-editor fieldset').length,0);
  const form = document.querySelector('[data-page="gerenciar-rodada"] form');
  await form.onsubmit({preventDefault() {}});
  const saved = JSON.parse(storage.get('recreacao-games-demo'));
  assert.equal(Object.values(saved.weeks)[0].teams.length,0);
  assert.equal(Object.values(saved.squads).length,0);
  assert.match(document.querySelector('[data-page="dia-de-jogo"]').textContent,/Nenhum jogo programado/);
});

