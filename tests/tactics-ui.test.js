import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {setupTactics} from '../public/tactics-ui.js';

function setup(t,admin = true,demo = true) {
  const {document,window} = parseHTML('<html><body><nav></nav><main><footer></footer></main></body></html>');
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{
    configurable:true,
    get() {return (this.querySelector('option[selected]') || this.querySelector('option'))?.value || '';},
    set(value) {for (const option of this.querySelectorAll('option')) option.toggleAttribute('selected',option.value === value);}
  });
  const previous = {document:globalThis.document,localStorage:globalThis.localStorage};
  const storage = new Map(); globalThis.document = document;
  globalThis.localStorage = {getItem:key => storage.get(key),setItem:(key,value) => storage.set(key,value)};
  const players = [{id:'a',name:'ANA',teams:['VERDE']},{id:'b',name:'BRUNO',teams:['VERDE']},{id:'c',name:'CAIO',teams:['VERDE'],status:'deleted'},{id:'d',name:'DAVI',teams:['BRANCO']}];
  const element = (tag,text,className) => {const e = document.createElement(tag); if (text != null) e.textContent = text; if (className) e.className = className; return e;};
  const notices = [];
  const ui = setupTactics({element,isAdmin:() => admin,getUserId:() => 'u',getPlayers:() => players,getTeams:() => ({VERDE:{name:'VERDE',status:'active'},BRANCO:{name:'BRANCO',status:'active'}}),isReady:() => true,toast:text => notices.push(text),demo});
  ui.refresh();
  t.after(() => {globalThis.document = previous.document; globalThis.localStorage = previous.localStorage;});
  return {document,ui,storage,players,notices,setAdmin:value => admin = value,button:text => [...document.querySelectorAll('button')].find(b => b.textContent === text)};
}
const click = button => button.onclick({stopPropagation(){}});

test('admin monta, troca, reposiciona e devolve jogador ao banco, salvando por time',async t => {
  const {document,button,storage,notices} = setup(t);
  assert.match(document.querySelector('.tactics-bench-list').textContent,/ANA/);
  assert.doesNotMatch(document.querySelector('.tactics-bench-list').textContent,/CAIO|DAVI/);
  click(document.querySelector('.tactics-bench-player'));
  click(document.querySelector('.tactics-marker'));
  assert.match(document.querySelector('.tactics-marker').textContent,/ANA/);
  assert.doesNotMatch(document.querySelector('.tactics-bench-list').textContent,/ANA/);
  click(document.querySelector('.tactics-bench-player'));
  click(document.querySelectorAll('.tactics-marker')[1]);
  click(document.querySelector('.tactics-marker'));
  click(document.querySelectorAll('.tactics-marker')[1]);
  assert.match(document.querySelector('.tactics-marker').textContent,/BRUNO/);
  const marker = document.querySelectorAll('.tactics-marker')[1];
  const original = marker.style.left; marker.onkeydown({key:'ArrowRight',preventDefault(){}});
  assert.notEqual(marker.style.left,original);
  click(marker); click(button('Devolver selecionado ao banco'));
  assert.match(document.querySelector('.tactics-bench-list').textContent,/ANA/);
  await button('Salvar montagem').onclick();
  const saved = JSON.parse(storage.get('recreacao-tactics-demo')).VERDE;
  assert.equal(saved.slots.filter(s => s.playerId).length,1);
  assert.equal(saved.slots[0].playerId,'b'); assert.match(notices.at(-1),/salva/);
  const team = document.querySelector('select[aria-label="Time do campinho"]');
  team.value = 'BRANCO'; team.onchange(); assert.match(document.querySelector('.tactics-bench-list').textContent,/DAVI/);
  team.value = 'VERDE'; team.onchange(); assert.match(document.querySelector('.tactics-marker').textContent,/BRUNO/);
});
test('mudança de formação preserva jogadores e atualização de vínculo os retira do campo',t => {
  const {document,ui,players} = setup(t);
  click(document.querySelector('.tactics-bench-player')); click(document.querySelector('.tactics-marker'));
  const formation = document.querySelector('select[aria-label="Formação do campinho"]'); formation.value = '2-2'; formation.onchange();
  assert.equal(document.querySelectorAll('.tactics-marker').length,5);
  assert.match(document.querySelector('.tactics-marker').textContent,/ANA/);
  players[0].status = 'deleted'; ui.refresh();
  assert.doesNotMatch(document.querySelector('.tactics-markers').textContent,/ANA/);
  assert.doesNotMatch(document.querySelector('.tactics-bench-list').textContent,/ANA/);
});
test('diretores e visitantes não têm acesso e perda de permissão limpa o campo',t => {
  const {document,ui,setAdmin} = setup(t,false);
  assert.equal(document.querySelector('[data-nav="campinho"]').hidden,true);
  assert.equal(document.querySelector('.tactics-markers').children.length,0);
  setAdmin(true); ui.refresh(); assert.equal(document.querySelectorAll('.tactics-marker').length,11);
  setAdmin(false); ui.refresh(); assert.equal(document.querySelector('.tactics-markers').children.length,0);
  assert.equal(document.querySelector('.tactics-bench-list').children.length,0);
});
test('arrastar do banco para o campo e mover pelo toque mantém coordenadas e jogador único',t => {
  const {document} = setup(t);
  const field = document.querySelector('.tactics-pitch'); field.getBoundingClientRect = () => ({left:0,top:0,right:500,bottom:700,width:500,height:700});
  const button = document.querySelector('.tactics-bench-player');
  button.onpointerdown({button:0,pointerId:1,clientX:550,clientY:100});
  button.onpointermove({clientX:250,clientY:350});
  assert.ok(document.querySelector('.tactics-drag-ghost'));
  button.onpointerup({clientX:250,clientY:350});
  assert.equal(document.querySelector('.tactics-drag-ghost'),null);
  const marker = [...document.querySelectorAll('.tactics-marker')].find(b => b.textContent.includes('ANA'));
  assert.equal(marker.style.left,'50%'); assert.equal(marker.style.top,'50%');
  click(marker);
  field.onclick({target:field,clientX:100,clientY:140});
  const moved = [...document.querySelectorAll('.tactics-marker')].find(b => b.textContent.includes('ANA'));
  assert.equal(moved.style.left,'20%'); assert.equal(moved.style.top,'20%');
  assert.equal([...document.querySelectorAll('.tactics-marker')].filter(b => b.textContent.includes('ANA')).length,1);
});
test('Firebase salva montagem privada e recusa sobrescrever edição concorrente',async t => {
  const {document,ui,button,notices} = setup(t,true,false);
  const records = new Map(), writes = []; let listener;
  const emit = () => listener({docs:[...records].map(([id,value]) => ({id,data:() => value}))});
  const sdk = {
    collection:(_,name) => name,doc:(_,collection,id) => ({collection,id}),serverTimestamp:() => 1000,
    onSnapshot:(_,callback) => {listener = callback; queueMicrotask(emit); return () => {};},
    runTransaction:async (_,callback) => {await callback({get:async ref => ({data:() => records.get(ref.id)}),set:(ref,data) => {writes.push({ref,data}); records.set(ref.id,data);}}); emit();}
  };
  ui.connect(sdk,{}); await Promise.resolve();
  click(document.querySelector('.tactics-bench-player')); click(document.querySelector('.tactics-marker'));
  await button('Salvar montagem').onclick();
  assert.equal(writes.length,1); assert.equal(writes[0].ref.collection,'tacticalLineups');
  assert.equal(writes[0].data.teamId,'VERDE'); assert.equal(writes[0].data.slots[0].playerId,'a');
  click(document.querySelector('.tactics-bench-player')); click(document.querySelectorAll('.tactics-marker')[1]);
  records.set('VERDE',{...records.get('VERDE'),updatedAt:2000});
  await button('Salvar montagem').onclick();
  assert.equal(writes.length,1); assert.match(notices.at(-1),/Outro administrador/);
});
