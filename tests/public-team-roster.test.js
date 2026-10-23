import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicTeamPlayer,setupPublicTeams} from '../public/public-team-roster.js';
import {parseHTML} from 'linkedom';
test('consulta pública contém só nome e vínculos, sem dados de congregação e acesso',() => {
  assert.deepEqual(publicTeamPlayer({name:'JOÃO',teams:['VERDE','BRANCO'],congregation:'PRIVADO',city:'PRIVADO',email:'privado@example.com'}),{name:'JOÃO',teams:['VERDE','BRANCO'],active:true});
  for (const state of [{status:'inactive'},{status:'deleted'},{mergedInto:'other'}]) assert.deepEqual(publicTeamPlayer({name:'PRIVADO',teams:['VERDE'],...state}),{name:'',teams:[],active:false});
});
test('cartão público abre lista pesquisável sem controles de escrita',() => {
  const {document} = parseHTML('<html><body></body></html>');
  const previous = globalThis.document; globalThis.document = document;
  try {
    document.defaultView.HTMLElement.prototype.showModal = function() {this.open = true;};
    document.defaultView.HTMLElement.prototype.close = function() {this.open = false;};
    const element = (tag,text,className) => {const e = document.createElement(tag); if(text) e.textContent=text; if(className)e.className=className; return e;};
    const ui = setupPublicTeams({element,teamName:id=>id,getPlayers:()=>[{name:'JOÃO',teams:['VERDE'],active:true},{name:'PEDRO',teams:['BRANCO'],active:true}]});
    ui.open('VERDE');
    assert.equal(document.querySelector('dialog').open,true);
    assert.match(document.querySelector('ol').textContent,/JOÃO/);
    assert.doesNotMatch(document.querySelector('ol').textContent,/PEDRO/);
    assert.equal(document.querySelectorAll('form,select').length,0);
    assert.equal(document.querySelectorAll('button').length,1);
    const search = document.querySelector('input'); search.value='ninguem'; search.oninput();
    assert.match(document.querySelector('ol').textContent,/Nenhum jogador/);
  } finally { globalThis.document = previous; }
});
