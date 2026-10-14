import { firebaseConfig } from './firebase-config.js';
import { TEAMS, identity, membership, playerId } from './domain.js';
const $ = s => document.querySelector(s);
const palette = [['#c5c9b8','#f0f1e9','#68705a'],['#343c39','#e9ece8','#404b41'],['#648dc5','#ebf1fa','#5075aa'],['#a18270','#f4ede7','#8b6a54'],['#899b86','#ebf0e7','#667d5e'],['#d4b94e','#faf5dc','#99852c'],['#d99459','#fcf0e2','#b47d42'],['#71a08b','#eaf3ec','#5b8b6b']];
let players = [], logs = [], windowOpen = false, profile = null, user = null, api = null, filter = 'all', transferring = null;
const demo = !firebaseConfig;
const style = team => { const c = palette[TEAMS.indexOf(team)] || palette[0]; return `--team:${c[0]};--soft:${c[1]};--ink:${c[2]}`; };
function element(tag, text, className) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (className) e.className = className; return e; }
function toast(message) { $('#toast').textContent = message; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 4500); }
function allowed(team) { return demo || profile?.role === 'admin' || (profile?.role === 'director' && profile.team === team); }
function options(select, teams) { select.replaceChildren(...teams.map(t => { const e = element('option', t); e.value = t; return e; })); }
function render() {
  $('#player-count').textContent = players.length;
  $('#window-label').textContent = windowOpen ? 'Janela aberta' : 'Janela fechada';
  $('#window-toggle').hidden = !(demo || profile?.role === 'admin');
  $('#login').textContent = demo ? 'Modo demonstração' : user ? `${profile?.role === 'admin' ? 'Administração' : profile?.team || 'Sem acesso atribuído'} · Sair` : 'Entrar como diretor ↗';
  $('#team-grid').replaceChildren(...TEAMS.map((team, i) => {
    const count = players.filter(p => p.teams.includes(team)).length;
    const card = element('button', null, 'team-card'); card.style.cssText = style(team);
    const top = element('div', null, 'team-top'); top.append(element('span', ['✧','✦','≈','◇','↑','☀','✳','❋'][i], 'team-badge'), element('span', '⋯'));
    const p = element('p'); p.append(element('b', String(count)), document.createTextNode(` ${count === 1 ? 'jogador' : 'jogadores'}`));
    const bottom = element('div', null, 'team-bottom'); bottom.append(element('span', 'Conhecer o time'), element('span', '↗'));
    card.append(top, element('h3', team), p, bottom);
    card.onclick = () => { $('#team-filter').value = team; renderPlayers(); $('#jogadores').scrollIntoView({ behavior:'smooth' }); }; return card;
  }));
  $('#congregations').replaceChildren(...[...new Set(players.map(p => p.congregation))].sort().map(c => { const o = element('option'); o.value = c; return o; }));
  renderPlayers();
}
function renderPlayers() {
  const search = identity($('#search').value, '');
  const selected = $('#team-filter').value;
  const list = players.filter(p => (!selected || p.teams.includes(selected)) && (filter !== 'two' || p.teams.length === 2) && identity(p.name + ' ' + p.congregation, '').includes(search.slice(0, -1))).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
  $('#results-count').textContent = `${list.length} ${list.length === 1 ? 'jogador' : 'jogadores'}`;
  $('#empty').hidden = list.length > 0;
  $('#empty h3').textContent = players.length ? 'Nenhum jogador encontrado' : 'A turma começa por aqui';
  $('#empty p').textContent = players.length ? 'Tente outro nome, congregação ou filtro.' : 'Cadastre o primeiro jogador e reúna os irmãos nos times.';
  $('#empty-add').hidden = players.length > 0;
  $('#player-list').replaceChildren(...list.map(p => {
    const row = element('tr'); const name = element('td'); const person = element('div', null, 'person');
    person.append(element('span', p.name.split(' ').filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase(), 'avatar'), element('span', p.name)); name.append(person);
    const teams = element('td'); p.teams.forEach(t => { const tag = element('span', t, 'tag'); tag.style.cssText = style(t); teams.append(tag); });
    const status = element('td', p.teams.length === 2 ? '● Dois times' : '● Um time', 'status'); const actions = element('td');
    if (windowOpen && p.teams.some(allowed)) { const b = element('button', 'Transferir ↔', 'row-action'); b.onclick = () => openTransfer(p); actions.append(b); }
    row.append(name, element('td', p.congregation), teams, status, actions); return row;
  }));
}
function openAdd() {
  const teams = TEAMS.filter(allowed);
  if (!teams.length) return toast('Entre com uma conta de diretor autorizada para cadastrar.');
  $('#player-form').reset(); $('#player-form .form-error').textContent = ''; options($('#player-form select'), teams);
  if (teams.includes($('#team-filter').value)) $('#player-form select').value = $('#team-filter').value;
  $('#player-dialog').showModal();
}
function openTransfer(p) {
  transferring = p.id; $('#transfer-form .form-error').textContent = ''; $('#transfer-name').textContent = `${p.name} · ${p.congregation}`;
  options($('#transfer-form [name=from]'), p.teams.filter(allowed)); options($('#transfer-form [name=to]'), TEAMS.filter(t => !p.teams.includes(t))); $('#transfer-dialog').showModal();
}
function saveDemo() { localStorage.setItem('recreacao-demo-v1', JSON.stringify({ players, logs, windowOpen })); render(); }
async function mutate(action, data) {
  if (!demo) { await api(action, data); return; }
  if (action === 'setWindow') { windowOpen = data.open; logs.unshift({ name:'Janela de transferências', detail: windowOpen ? 'Aberta pela administração' : 'Fechada pela administração', at: Date.now() }); }
  if (action === 'addPlayer') {
    const id = await playerId(data.name, data.congregation); const p = players.find(p => p.id === id);
    if (p) p.teams = membership(p, data.team); else players.push({ id, name:data.name.trim().replace(/\s+/g,' '), congregation:data.congregation.trim().replace(/\s+/g,' '), teams:[data.team] });
    logs.unshift({ name:data.name, detail:`Inscrição em ${data.team}`, at:Date.now() });
  }
  if (action === 'transferPlayer') {
    if (!windowOpen) throw Error('A janela de transferências está fechada.');
    const p = players.find(p => p.id === data.id); if (!p) throw Error('Jogador não encontrado.');
    p.teams = membership(p, data.from, data.to); logs.unshift({ name:p.name, detail:`${data.from} → ${data.to}`, at:Date.now() });
  }
  saveDemo();
}
for (const id of ['#add-player','#empty-add']) $(id).onclick = openAdd;
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
$('#search').oninput = renderPlayers; $('#team-filter').onchange = renderPlayers;
TEAMS.forEach(t => { const o = element('option', t); o.value = t; $('#team-filter').append(o); });
document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(e => e.classList.toggle('selected', e === b)); renderPlayers(); });
function submit(form, action, getData, dialog, success) {
  $(form).onsubmit = async event => {
    event.preventDefault(); const button = $(form + ' .submit'); button.disabled = true; $(form + ' .form-error').textContent = '';
    try { await mutate(action, getData(new FormData(event.target))); $(dialog).close(); toast(success); }
    catch(e) { $(form + ' .form-error').textContent = e.message; } finally { button.disabled = false; }
  };
}
submit('#player-form','addPlayer', f => Object.fromEntries(f), '#player-dialog', 'Jogador adicionado ao time.');
submit('#transfer-form','transferPlayer', f => ({ ...Object.fromEntries(f), id:transferring }), '#transfer-dialog', 'Transferência registrada.');
$('#window-toggle').onclick = async () => { try { await mutate('setWindow', { open:!windowOpen }); toast('Janela atualizada.'); } catch(e) { toast(e.message); } };
$('#history-button').onclick = () => {
  $('#history-list').replaceChildren(...logs.slice(0,100).map(l => { const e = element('div', null, 'history-item'); e.append(element('strong', l.name), element('div', l.detail), element('small', new Date(l.at?.toMillis?.() || l.at).toLocaleString('pt-BR'))); return e; }));
  if (!logs.length) $('#history-list').append(element('p', 'As inscrições e transferências aparecerão aqui.'));
  $('#history-dialog').showModal();
};
if (demo) {
  try { const stored = JSON.parse(localStorage.getItem('recreacao-demo-v1')); if (stored) ({ players, logs, windowOpen } = stored); } catch { localStorage.removeItem('recreacao-demo-v1'); }
  $('#mode-notice').textContent = 'Demonstração local · Experimente os cadastros e transferências. Os dados ficam apenas neste navegador até conectar o Firebase.';
  $('#login').onclick = () => toast('Conecte o Firebase para habilitar o acesso dos diretores.'); render();
} else {
  $('#mode-notice').textContent = 'Entre com sua conta de diretor para acessar os jogadores.';
  render();
  try {
    const base = 'https://www.gstatic.com/firebasejs/12.4.0/';
    const [appSDK, authSDK, dbSDK] = await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(p => import(base + p)));
    const app = appSDK.initializeApp(firebaseConfig), auth = authSDK.getAuth(app), db = dbSDK.getFirestore(app);
    const { createFirebaseApi } = await import('./firebase-store.js');
    api = createFirebaseApi(dbSDK, db, auth);
    $('#login').onclick = async () => { try { if (auth.currentUser) await authSDK.signOut(auth); else await authSDK.signInWithPopup(auth, new authSDK.GoogleAuthProvider()); } catch(e) { toast(e.message); } };
    let unsubscribers = [];
    authSDK.onAuthStateChanged(auth, async current => {
      unsubscribers.forEach(u => u()); unsubscribers = []; user = current; profile = null; players = []; logs = []; windowOpen = false; render();
      if (!current) { $('#mode-notice').textContent = 'Entre com sua conta de diretor para acessar os jogadores.'; return; }
      try {
        const snap = await dbSDK.getDoc(dbSDK.doc(db, 'users', current.uid)); profile = snap.data();
        if (!['admin','director'].includes(profile?.role)) { $('#mode-notice').textContent = 'Sua conta aguarda liberação pela administração.'; render(); return; }
        $('#mode-notice').textContent = profile.role === 'admin' ? 'Administração · Gerencie os times e a janela de transferências.' : `Diretor · ${profile.team}. Você pode cadastrar e transferir jogadores do seu time.`;
        const error = e => toast('Não foi possível sincronizar: ' + e.message);
        unsubscribers.push(dbSDK.onSnapshot(dbSDK.collection(db,'players'), s => { players = s.docs.map(d => ({...d.data(), id:d.id})); render(); }, error));
        unsubscribers.push(dbSDK.onSnapshot(dbSDK.doc(db,'settings','transfers'), s => { windowOpen = s.data()?.open === true; render(); }, error));
        unsubscribers.push(dbSDK.onSnapshot(dbSDK.query(dbSDK.collection(db,'events'),dbSDK.orderBy('at','desc'),dbSDK.limit(100)), s => { logs = s.docs.map(d => d.data()); }, error)); render();
      } catch(e) { toast(e.message); }
    });
  } catch(e) { $('#mode-notice').textContent = 'Falha ao conectar ao Firebase. Verifique a configuração e a conexão.'; }
}
