import { firebaseConfig } from './firebase-config.js';
import { identity, membership, playerId, mergedTeams, playerStatus, isActivePlayer, playerDetails,playerName,reviewKey,reusableIdentity } from './domain.js';
import { setupDuplicates } from './duplicates.js';
import { setupPages, PUBLIC_PAGES } from './pages.js';
import {withPublicHistory,publicMovementDetail} from './public-history.js';
import {setupPresentation} from './presentation.js';
import { setupPlayerManagement } from './player-management.js';
import { DEFAULT_TEAMS,TEAM_COLORS,changeTeam,teamActive } from './teams.js';
import { setupTeamManagement } from './team-management.js';
import { setupRoster } from './roster.js';
import { setupHistory } from './history.js';
import {setupCongregations,congregationOptions,standardCongregation} from './congregations.js';
import {goalkeeperToggle} from './goalkeeper-toggle.js';
import {citySelect,splitCongregation,cityCongregation} from './cities.js';
import {setupNotifications} from './notifications.js';
import {setupGameDay} from './game-day-ui.js';
const $ = s => document.querySelector(s);
const toast = setupNotifications(document);
const mobileActions = window.matchMedia('(max-width:700px)');
mobileActions.addEventListener('change',() => renderPlayers());
let teamCatalog = structuredClone(DEFAULT_TEAMS);
const teamIds = (activeOnly = false) => Object.keys(teamCatalog).filter(id => !activeOnly || teamActive(teamCatalog,id));
const teamName = id => teamCatalog[id]?.name || id;
let players = [], logs = [], windowOpen = false, profile = null, user = null, api = null, filter = 'all', transferring = null;
const demo = !firebaseConfig;
const member = () => demo || ['admin','director'].includes(profile?.role);
let navigation = null;
let reviews = [], playersReady = demo, teamsReady = demo;
let historyLimit = 100, historyHasMore = false, historyLoading = false, historyLoader = null;
let accessUsers = [];
let archivedPlayers = [];
const duplicates = setupDuplicates({element,getPlayers:() => players,getReviews:() => reviews,isAdmin:() => demo || profile?.role === 'admin',openAdd,mutate,toast,teamName});
const management = setupPlayerManagement({element,isAdmin:() => demo || profile?.role === 'admin',getPlayers:() => players,mutate,toast,teamName});
const teamManagement = setupTeamManagement({element,isAdmin:() => demo || profile?.role === 'admin',getTeams:() => teamCatalog,getPlayers:() => players,getUsers:() => accessUsers,mutate,toast});
const roster = setupRoster({element,getPlayers:() => players,getTeams:() => teamCatalog,canExport:() => playersReady && teamsReady && (demo || ['admin','director'].includes(profile?.role)),toast});
const history = setupHistory({element,getLogs:() => logs,getTeams:() => teamCatalog,getPlayers:() => [...players,...archivedPlayers],getUsers:() => accessUsers,showAuthors:member,canRead:() => true,canLoadMore:() => historyHasMore,isLoading:() => historyLoading,loadMore:() => historyLoader?.()});
const gameDay = setupGameDay({element,getProfile:() => demo ? {role:'admin'} : profile,getUserId:() => user?.uid,getPlayers:() => players,getTeams:() => teamCatalog,mutate,toast,demo});
setupCongregations({element,getPlayers:() => [...players,...archivedPlayers]});
const statusFilter = element('select'); statusFilter.id = 'status-filter'; statusFilter.setAttribute('aria-label','Filtrar situação do jogador');
for (const [value,label] of [['active','Ativos'],['inactive','Inativos'],['deleted','Excluídos'],['all','Todas as situações']]) { const option = element('option',label); option.value = value; statusFilter.append(option); }
$('#team-filter').after(statusFilter); statusFilter.onchange = renderPlayers;
const accessButton = element('a', '⚙ Gerenciar acessos'); accessButton.href = '#/gerenciar-acessos'; accessButton.dataset.nav = 'gerenciar-acessos';
accessButton.hidden = true;
document.querySelector('nav').append(accessButton);
const accessDialog = element('section',null,'page-section');
accessDialog.id = 'access-page'; accessDialog.dataset.page = 'gerenciar-acessos'; accessDialog.hidden = true;
const accessTitle = element('div', null, 'dialog-title');
accessTitle.append(element('h2','Diretores e acessos'));
const accessList = element('div');
const accessSearch = element('input');
accessSearch.type = 'search';
accessSearch.placeholder = 'Buscar diretor por nome, e-mail ou time';
accessSearch.setAttribute('aria-label',accessSearch.placeholder);
accessSearch.oninput = renderAccess;
accessDialog.append(accessTitle,element('p','Escolha o time de cada diretor pelo e-mail da conta Google. Quem ainda não apareceu precisa entrar no site com Google uma vez.'),accessSearch,accessList);
document.querySelector('footer').before(accessDialog);
accessButton.onclick = () => renderAccess();
function renderAccess() {
  accessList.replaceChildren();
  const authorized = profile?.role === 'admin';
  accessSearch.hidden = !authorized;
  if (!authorized) { accessList.append(element('p','Esta página é exclusiva da administração.')); return; }
  const query = identity(accessSearch.value, '').slice(0,-1);
  const sorted = accessUsers.filter(a => identity(`${a.displayName || ''} ${a.email || ''} ${teamName(a.team) || ''}`, '').includes(query)).sort((a,b) => (a.role === 'pending' ? 0 : 1) - (b.role === 'pending' ? 0 : 1) || (a.email || a.displayName || '').localeCompare(b.email || b.displayName || '','pt-BR'));
  if (!sorted.length) accessList.append(element('p','Nenhuma conta encontrada.'));
  for (const account of sorted) {
    const item = element('div',null,'access-item');
    item.append(element('strong',account.email || 'E-mail ainda não disponível'),element('small',account.displayName || 'Conta Google'));
    if (!account.email) item.append(element('p','Peça para esta pessoa entrar novamente com Google para atualizar o e-mail.'));
    if (account.role === 'admin') item.append(element('p','Administrador'));
    else {
      const form = element('form',null,'access-controls');
      const select = element('select');
      select.setAttribute('aria-label',`Time de ${account.email || account.displayName || 'conta Google'}`);
      options(select,['',...new Set([...teamIds(true),...(account.team ? [account.team] : [])])]); select.options[0].textContent = 'Sem acesso · aguardando liberação'; select.value = account.team || '';
      if (account.team && !teamActive(teamCatalog,account.team)) { select.selectedOptions[0].textContent += ' · inativo/excluído'; select.selectedOptions[0].disabled = true; }
      const save = element('button','Salvar','primary');
      const feedback = element('p',null,'access-feedback'); feedback.setAttribute('role','status');
      form.append(select,save);
      form.onsubmit = async event => {
        event.preventDefault(); save.disabled = true; select.disabled = true; feedback.textContent = '';
        try { await api('assignDirector',{uid:account.id,team:select.value}); toast('Acesso atualizado. O diretor recebe a mudança automaticamente.'); }
        catch(e) { feedback.textContent = e.message; }
        finally { save.disabled = false; select.disabled = false; }
      };
      item.append(form,feedback);
    }
    accessList.append(item);
  }
}
const style = team => { const c = TEAM_COLORS[teamCatalog[team]?.color] || TEAM_COLORS.green; return `--team:${c.color};--soft:${c.soft};--ink:${c.ink}`; };
function element(tag, text, className) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (className) e.className = className; return e; }
function allowed(team) { return demo || profile?.role === 'admin' || (profile?.role === 'director' && profile.team === team); }
function options(select, teams) { select.replaceChildren(...teams.map(t => { const e = element('option', teamName(t)); e.value = t; return e; })); }
function render() {
  navigation?.refresh();
  for (const id of ['#add-player','#players-add','#empty-add']) $(id).hidden = !member();
  gameDay.refresh();
  $('#player-count').textContent = member() ? players.filter(isActivePlayer).length : '—';
  statusFilter.hidden = !(demo || profile?.role === 'admin');
  if (statusFilter.hidden) statusFilter.value = 'active';
  management.refresh();
  roster.refresh();
  teamManagement.refresh();
  const selectedTeam = $('#team-filter').value;
  options($('#team-filter'),['',...teamIds()]); $('#team-filter').options[0].textContent = 'Todos os times'; $('#team-filter').value = teamIds().includes(selectedTeam) ? selectedTeam : '';
  $('#teams-count').textContent = teamIds(true).length;
  $('#teams-heading-count').textContent = ` (${teamIds(true).length})`;
  if (profile?.role === 'director') $('#mode-notice').textContent = `Diretor · ${teamName(profile.team)}.${teamActive(teamCatalog,profile.team) ? ' Você pode cadastrar e transferir jogadores do seu time.' : ' Time inativo ou excluído: novas inscrições estão bloqueadas; transferências de saída seguem a janela.'}`;
  $('#window-label').textContent = member() ? (windowOpen ? 'Janela aberta' : 'Janela fechada') : 'Consulta pública';
  $('#window-toggle').hidden = !(demo || profile?.role === 'admin');
  accessButton.hidden = profile?.role !== 'admin';
  if (profile?.role !== 'admin') renderAccess();
  $('#login').textContent = demo ? 'Modo demonstração' : user ? `${profile?.role === 'admin' ? 'Administração' : teamName(profile?.team) || 'Sem acesso atribuído'} · Sair` : 'Entrar como diretor ↗';
  $('#team-grid').replaceChildren(...teamIds(true).map(team => {
    const count = players.filter(p => isActivePlayer(p) && p.teams.includes(team)).length;
    const card = element(member() ? 'button' : 'article', null, 'team-card'); card.style.cssText = style(team);
    const badge = element('span', teamCatalog[team].badge, 'team-badge'); badge.setAttribute('aria-hidden','true');
    const top = element('div', null, 'team-top'); top.append(badge, element('span', '⋯'));
    const p = element('p'); p.append(element('b', String(count)), document.createTextNode(` ${count === 1 ? 'jogador' : 'jogadores'}`));
    if (!member()) p.textContent = 'Time registrado';
    const bottom = element('div', null, 'team-bottom'); bottom.append(element('span', 'Consultar registros'), element('span', '↗'));
    if (!member()) bottom.replaceChildren(element('span','Registro ativo'));
    card.append(top, element('h3', teamName(team)), p, bottom);
    if (member()) card.onclick = () => { $('#team-filter').value = team; statusFilter.value = 'active'; $('#search').value = ''; filter = 'all'; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('selected',b.dataset.filter === 'all')); renderPlayers(); location.hash = '/jogadores'; }; return card;
  }));
  if (!teamIds(true).length) $('#team-grid').append(element('p','Nenhum time ativo. A administração pode criar ou reativar times em Gerenciar times.'));
  $('#congregations').replaceChildren(...congregationOptions([...players,...archivedPlayers]).map(c => { const o = element('option'); o.value = c; return o; }));
  renderPlayers();
  duplicates.refresh();
  renderHistory();
}
function renderPlayers() {
  const search = identity($('#search').value, '');
  const selected = $('#team-filter').value;
  const list = players.filter(p => (statusFilter.value === 'all' || playerStatus(p) === statusFilter.value) && (!selected || p.teams.includes(selected)) && (filter !== 'two' || p.teams.length === 2) && identity(p.name + ' ' + p.congregation + ' ' + p.teams.map(teamName).join(' '), '').includes(search.slice(0, -1))).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
  $('#results-count').textContent = `${list.length} ${list.length === 1 ? 'jogador' : 'jogadores'}`;
  $('#empty').hidden = list.length > 0;
  $('#empty h3').textContent = players.length ? 'Nenhum jogador encontrado' : 'Nenhum jogador cadastrado';
  $('#empty p').textContent = players.length ? 'Tente outro nome, congregação ou filtro.' : 'Adicione um jogador para registrar sua inscrição em um time.';
  $('#empty-add').hidden = players.length > 0;
  $('#player-list').replaceChildren(...list.map(p => {
    const row = element('tr'); const name = element('td'); const person = element('div', null, 'person');
    person.append(element('span', p.name.split(' ').filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase(), 'avatar'), element('span', playerName(p.name))); name.append(person);
    const teams = element('td'); p.teams.forEach(t => { const tag = element('span',teamName(t) + (teamActive(teamCatalog,t) ? '' : ' · inativo/excluído'), 'tag'); tag.style.cssText = style(t); teams.append(tag); });
    const status = element('td', !isActivePlayer(p) ? playerStatus(p) === 'inactive' ? '● Inativo' : '● Excluído' : p.goalkeeper ? `🧤 Goleiro · ${p.teams.length} time(s)` : p.teams.length === 2 ? '● Dois times' : '● Um time', 'status'); const actions = element('td');
    if (p.goalkeeper) person.append(element('span','🧤 Goleiro','goalkeeper-badge'));
    if (isActivePlayer(p) && (p.goalkeeper || p.teams.length < 2) && teamIds(true).some(t => allowed(t) && !p.teams.includes(t))) { const b = element('button', 'Adicionar a outro time ＋', 'row-action'); b.onclick = () => openAdd(p); actions.append(b); }
    if (isActivePlayer(p) && windowOpen && p.teams.some(allowed) && teamIds(true).some(t => !p.teams.includes(t))) { const b = element('button', 'Transferir ↔', 'row-action'); b.onclick = () => openTransfer(p); actions.append(b); }
    if (demo || profile?.role === 'admin') actions.append(...management.actions(p));
    if (mobileActions.matches && actions.children.length) {
      const menu = element('details',null,'player-actions');
      const summary = element('summary','Ações'); summary.setAttribute('aria-label',`Ações para ${playerName(p.name)}`);
      const items = element('div',null,'player-action-items'); items.append(...actions.children);
      items.addEventListener('click',event => { if (event.target.closest('button')) menu.open = false; });
      menu.append(summary,items); actions.append(menu);
    }
    row.append(name, element('td', playerName(p.congregation)), teams, status, actions);
    [...row.children].forEach((cell,index) => cell.dataset.label = ['Jogador','Congregação','Times','Inscrição','Ações'][index]);
    return row;
  }));
}
function openAdd(player = null) {
  if (player && !isActivePlayer(player)) return toast('Peça à administração para reativar este jogador antes de inscrevê-lo.');
  const teams = teamIds(true).filter(t => allowed(t) && !player?.teams.includes(t));
  if (!teams.length) return toast('Não há um time ativo disponível para sua conta cadastrar este jogador.');
  $('#player-form').reset(); $('#player-form .form-error').textContent = ''; options($('#player-form [name=team]'), teams);
  const location = splitCongregation(player?.congregation || '');
  $('#player-form').dataset.playerId = player?.id || '';
  $('#player-form [name=city]').value = player?.city || location.city;
  $('#player-form [name=city]').disabled = !!player;
  $('#player-form [name=goalkeeper]').checked = player?.goalkeeper === true;
  $('#player-form [name=goalkeeper]').disabled = !!player;
  for (const field of ['name','congregation']) {
    const input = $(`#player-form [name=${field}]`);
    input.value = field === 'congregation' ? location.congregation : player?.[field] || ''; input.readOnly = !!player;
  }
  if (teams.includes($('#team-filter').value)) $('#player-form [name=team]').value = $('#team-filter').value;
  $('#player-dialog').showModal();
  duplicates.suggest();
}
function openTransfer(p) {
  transferring = p.id; $('#transfer-form .form-error').textContent = ''; $('#transfer-name').textContent = `${playerName(p.name)} · ${playerName(p.congregation)}`;
  options($('#transfer-form [name=from]'), p.teams.filter(allowed)); options($('#transfer-form [name=to]'), teamIds(true).filter(t => !p.teams.includes(t))); $('#transfer-dialog').showModal();
}
function saveDemo() { localStorage.setItem('recreacao-demo-v1', JSON.stringify({ players, archivedPlayers, logs, windowOpen,teamCatalog,reviews })); render(); }
async function mutate(action, data) {
  if (['addPlayer','editPlayer'].includes(action)) data = {...data,congregation:standardCongregation(data.congregation,congregationOptions([...players,...archivedPlayers]))};
  if (['addPlayer','editPlayer'].includes(action) && 'city' in data) data = {...data,...cityCongregation(data.congregation,data.city,congregationOptions([...players,...archivedPlayers]))};
  if (!demo) { await api(action, data); return; }
  if (action === 'reviewDuplicates') {
    const [sourceId,targetId] = [data.sourceId,data.targetId].sort();
    const source = players.find(p => p.id === sourceId), target = players.find(p => p.id === targetId);
    if (!source || !target || sourceId === targetId || !isActivePlayer(source) || !isActivePlayer(target) || typeof data.different !== 'boolean') throw Error('Revisão inválida.');
    const id = reviewKey(sourceId,targetId);
    reviews = reviews.filter(r => reviewKey(r.sourceId,r.targetId) !== id);
    reviews.push({sourceId,targetId,sourceName:source.name,targetName:target.name,sourceCongregation:source.congregation,targetCongregation:target.congregation,different:data.different});
    logs.unshift({kind:'duplicateReview',name:source.name,teams:[...new Set([...source.teams,...target.teams])],detail:`${source.name} (${source.congregation}) e ${target.name} (${target.congregation}): ${data.different ? 'confirmados como pessoas diferentes' : 'revisão reaberta'}.`,at:Date.now()});
  }
  if (['createTeam','editTeam','setTeamStatus'].includes(action)) {
    const change = changeTeam(teamCatalog,action,data); teamCatalog = change.items;
    logs.unshift({kind:'team',teamId:data.id,name:change.next.name,detail:`Time ${action === 'createTeam' ? 'criado' : 'atualizado'}: ${change.next.name}. Situação: ${change.next.status === 'active' ? 'ativo' : change.next.status === 'inactive' ? 'inativo' : 'excluído'}.`,at:Date.now()});
  }
  if (action === 'setWindow') { windowOpen = data.open; logs.unshift({kind:'window',name:'Janela de transferências', detail: windowOpen ? 'Aberta pela administração' : 'Fechada pela administração', at: Date.now() }); }
  if (action === 'addPlayer') {
    if (!teamActive(teamCatalog,data.team)) throw Error('Time inválido, inativo ou excluído.');
    let id = await playerId(data.name, data.congregation);
    const visited = new Set();
    while (archivedPlayers.some(p => p.id === id)) {
      if (visited.has(id)) throw Error('Vínculo de cadastro inválido.');
      visited.add(id); id = archivedPlayers.find(p => p.id === id).mergedInto;
    }
    const p = players.find(p => p.id === id);
    if (p && !isActivePlayer(p)) throw Error('Este jogador está inativo ou excluído. Reative o cadastro existente.');
    if (p) p.teams = membership(p, data.team); else players.push({ id, ...playerDetails(data), teams:[data.team] });
    logs.unshift({kind:'add',playerId:id,to:data.team,name:data.name, detail:`Inscrição em ${teamName(data.team)}`, at:Date.now() });
  }
  if (action === 'editPlayer' || action === 'setPlayerStatus') {
    const p = players.find(p => p.id === data.id); if (!p) throw Error('Jogador não encontrado.');
    if (action === 'setPlayerStatus') {
      if (!['active','inactive','deleted'].includes(data.status)) throw Error('Situação inválida.');
      p.status = data.status; logs.unshift({kind:'status',playerId:p.id,teams:[...p.teams],name:p.name,detail:`Situação alterada para ${data.status === 'active' ? 'ativo' : data.status === 'inactive' ? 'inativo' : 'excluído'}.`,at:Date.now()});
    } else {
      if (playerStatus(p) === 'deleted') throw Error('Restaure o jogador antes de editar.');
      const details = playerDetails(data), id = await playerId(details.name,details.congregation);
      if (!(details.goalkeeper ?? p.goalkeeper) && p.teams.length > 2) throw Error('Reduza as inscrições para até dois times antes de desmarcar goleiro.');
      const target = [...players,...archivedPlayers].find(other => other.id === id);
      if (id !== p.id && target && !await reusableIdentity(target,p.id,async key => [...players,...archivedPlayers].find(other => other.id === key))) throw Error('Já existe outro cadastro com esse nome, congregação e cidade. Use a revisão de duplicidades.');
      logs.unshift({kind:'edit',playerId:id,sourceId:p.id,previousName:p.name,teams:[...p.teams],name:details.name,detail:`Cadastro editado: ${p.name} (${playerName(p.congregation)}) → ${details.name} (${details.congregation}).`,at:Date.now()});
      if (id !== p.id) { archivedPlayers = archivedPlayers.filter(other => other.id !== id); archivedPlayers.push({...p,teams:[],mergedInto:id}); }
      Object.assign(p,details,{id});
    }
  }
  if (action === 'mergePlayers') {
    const source = players.find(p => p.id === data.sourceId), target = players.find(p => p.id === data.targetId);
    if (!source || !target || source === target || !isActivePlayer(source) || !isActivePlayer(target)) throw Error('Escolha dois cadastros diferentes e ativos.');
    const teams = mergedTeams(source,target);
    logs.unshift({kind:'merge',sourceName:source.name,sourceId:source.id,targetId:target.id,teams:[...teams],name:target.name,detail:`Cadastro de ${source.name} (${source.congregation}) unificado com ${target.name} (${target.congregation}). Times: ${teams.map(teamName).join(', ')}.`,at:Date.now()});
    target.teams = teams; archivedPlayers.push({...source,teams:[],mergedInto:target.id}); players = players.filter(p => p.id !== source.id);
  }
  if (action === 'transferPlayer') {
    if (!teamActive(teamCatalog,data.to)) throw Error('Time de destino inativo ou excluído.');
    if (!windowOpen) throw Error('A janela de transferências está fechada.');
    const p = players.find(p => p.id === data.id); if (!p) throw Error('Jogador não encontrado.');
    if (!isActivePlayer(p)) throw Error('Este jogador está inativo ou excluído. Reative o cadastro existente.');
    p.teams = membership(p, data.from, data.to); logs.unshift({kind:'transfer',playerId:p.id,from:data.from,to:data.to,name:p.name, detail:`${teamName(data.from)} → ${teamName(data.to)}`, at:Date.now() });
  }
  saveDemo();
}
for (const id of ['#add-player','#empty-add','#players-add']) $(id).onclick = () => openAdd();
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
$('#search').oninput = renderPlayers; $('#team-filter').onchange = renderPlayers;
document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(e => e.classList.toggle('selected', e === b)); renderPlayers(); });
function submit(form, action, getData, dialog, success) {
  $(form).onsubmit = async event => {
    event.preventDefault(); const button = $(form + ' .submit'); button.disabled = true; $(form + ' .form-error').textContent = '';
    try { if (form === '#player-form') duplicates.validate(); await mutate(action, getData(new FormData(event.target))); $(dialog).close(); toast(success); }
    catch(e) { $(form + ' .form-error').textContent = e.message; } finally { button.disabled = false; }
  };
}
$('#player-form [name=team]').closest('label').before(goalkeeperToggle(element));
$('#player-form [name=congregation]').closest('label').after(citySelect(element));
$('#player-form .form-note').textContent = '↔ Jogadores de linha: até dois times. Goleiros: sem limite de times. Em cadastros existentes, só o admin altera essa opção em Editar.';
submit('#player-form','addPlayer', f => {
  const data = {...Object.fromEntries(f),goalkeeper:$('#player-form [name=goalkeeper]').checked};
  const city = $('#player-form [name=city]');
  if (city.disabled) { const original = players.find(p => p.id === $('#player-form').dataset.playerId); if (original) data.congregation = original.congregation; }
  else data.city = city.value;
  return data;
}, '#player-dialog', 'Jogador adicionado ao time.');
submit('#transfer-form','transferPlayer', f => ({ ...Object.fromEntries(f), id:transferring }), '#transfer-dialog', 'Transferência registrada.');
$('#window-toggle').onclick = async () => { try { await mutate('setWindow', { open:!windowOpen }); toast('Janela atualizada.'); } catch(e) { toast(e.message); } };
function renderHistory() {
  history.refresh();
}
setupPresentation();
navigation = setupPages(() => { duplicates.refresh(); teamManagement.refresh(); gameDay.refresh(); renderAccess(); renderHistory(); },page => member() || PUBLIC_PAGES.includes(page));
if (demo) {
  try { const stored = JSON.parse(localStorage.getItem('recreacao-demo-v1')); if (stored) { ({ players, logs, windowOpen } = stored); archivedPlayers = stored.archivedPlayers || []; teamCatalog = stored.teamCatalog || structuredClone(DEFAULT_TEAMS); reviews = stored.reviews || []; } } catch { localStorage.removeItem('recreacao-demo-v1'); }
  $('#mode-notice').textContent = 'Demonstração local · Experimente os cadastros e transferências. Os dados ficam apenas neste navegador até conectar o Firebase.';
  $('#login').onclick = () => toast('Conecte o Firebase para habilitar o acesso dos diretores.'); render();
} else {
  $('#mode-notice').textContent = 'Entre com sua conta de diretor para acessar os jogadores.';
  render();
  try {
    const base = 'https://www.gstatic.com/firebasejs/12.4.0/';
    const [appSDK, authSDK, dbSDK] = await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(p => import(base + p)));
    const app = appSDK.initializeApp(firebaseConfig), auth = authSDK.getAuth(app), db = dbSDK.getFirestore(app);
    const { createFirebaseApi, ensureAccessProfile } = await import('./firebase-store.js');
    const writingSDK = withPublicHistory(dbSDK,db);
    api = createFirebaseApi(writingSDK, db, auth,() => congregationOptions([...players,...archivedPlayers]));
    gameDay.connect(writingSDK,db);
    $('#login').onclick = async () => { try { if (auth.currentUser) await authSDK.signOut(auth); else await authSDK.signInWithPopup(auth, new authSDK.GoogleAuthProvider()); } catch(e) { toast(e.message); } };
    let unsubscribers = [], dataSubscriptions = [], authVersion = 0;
    authSDK.onAuthStateChanged(auth, async current => {
      const version = ++authVersion;
      unsubscribers.forEach(u => u()); unsubscribers = [];
      dataSubscriptions.forEach(u => u()); dataSubscriptions = [];
      user = current; profile = null; players = []; archivedPlayers = []; logs = []; accessUsers = []; reviews = []; playersReady = false; teamsReady = false; historyLimit = 100; historyHasMore = false; historyLoading = false; historyLoader = null; windowOpen = false; teamCatalog = structuredClone(DEFAULT_TEAMS); render();
      const publicError = e => toast('Não foi possível carregar a consulta pública: '+e.message);
      function subscribePublic() {
        dataSubscriptions.push(dbSDK.onSnapshot(dbSDK.doc(db,'settings','teams'),s => {
          if (version !== authVersion || member()) return;
          teamCatalog = s.data()?.items || structuredClone(DEFAULT_TEAMS); teamsReady = true; render();
        },publicError));
        let stop = null, request = 0;
        function load() {
          const revision = ++request; stop?.(); historyLoading = true;
          stop = dbSDK.onSnapshot(dbSDK.query(dbSDK.collection(db,'publicEvents'),dbSDK.orderBy('at','desc'),dbSDK.limit(historyLimit)),s => {
            if (version !== authVersion || member() || revision !== request) return;
            logs = s.docs.map(d => ({...d.data(),id:d.id,detail:publicMovementDetail(d.data(),teamCatalog)}));
            historyHasMore = s.docs.length === historyLimit; historyLoading = false; renderHistory();
          },publicError);
        }
        dataSubscriptions.push(() => { request++; stop?.(); });
        historyLoader = () => { if (!historyLoading && historyHasMore) { historyLimit += 100; load(); } };
        load();
      }
      if (!current) { $('#mode-notice').textContent = 'Consulta pública · Dia de jogo, times e movimentações. Entre como diretor para gerenciar inscrições.'; subscribePublic(); return; }
      try {
        const accessResult = await ensureAccessProfile(dbSDK,db,current);
        if (accessResult?.metadataSyncPending) toast('Você entrou. O e-mail da conta será atualizado quando as regras do banco forem publicadas.');
        if (version !== authVersion) return;
        const error = e => toast('Não foi possível sincronizar: ' + e.message);
        unsubscribers.push(dbSDK.onSnapshot(dbSDK.doc(db,'users',current.uid), snap => {
          if (version !== authVersion) return;
          dataSubscriptions.forEach(u => u()); dataSubscriptions = [];
          profile = snap.data(); players = []; archivedPlayers = []; logs = []; accessUsers = []; reviews = []; playersReady = false; teamsReady = false; historyLimit = 100; historyHasMore = false; historyLoading = false; historyLoader = null; windowOpen = false; teamCatalog = structuredClone(DEFAULT_TEAMS);
          if (!['admin','director'].includes(profile?.role)) {
            $('#mode-notice').textContent = 'Seu pedido de acesso foi enviado. Aguarde o administrador vincular sua conta a um time; esta tela será atualizada automaticamente.';
            subscribePublic(); render(); return;
          }
          $('#mode-notice').textContent = profile.role === 'admin' ? 'Administração · Use Gerenciar acessos para liberar diretores e escolher seus times.' : `Diretor · ${profile.team}. Você pode cadastrar e transferir jogadores do seu time.`;
          const active = callback => value => { if (version === authVersion && ['admin','director'].includes(profile?.role)) callback(value); };
          dataSubscriptions.push(dbSDK.onSnapshot(dbSDK.doc(db,'settings','teams'),active(s => { teamCatalog = s.data()?.items || structuredClone(DEFAULT_TEAMS); teamsReady = true; renderAccess(); render(); }),error));
          dataSubscriptions.push(dbSDK.onSnapshot(dbSDK.collection(db,'players'), active(s => { const all = s.docs.map(d => ({...d.data(), id:d.id})); players = all.filter(p => !p.mergedInto); archivedPlayers = all.filter(p => p.mergedInto); playersReady = true; render(); }), error));
          dataSubscriptions.push(dbSDK.onSnapshot(dbSDK.doc(db,'settings','transfers'), active(s => { windowOpen = s.data()?.open === true; render(); }), error));
          let stopHistory = null, historyVersion = 0;
          function subscribeHistory() {
            const requestVersion = ++historyVersion;
            stopHistory?.(); historyLoading = true; renderHistory();
            stopHistory = dbSDK.onSnapshot(dbSDK.query(dbSDK.collection(db,'events'),dbSDK.orderBy('at','desc'),dbSDK.limit(historyLimit)),active(s => {
              if (requestVersion !== historyVersion) return;
              logs = s.docs.map(d => ({...d.data(),id:d.id})); historyHasMore = s.docs.length === historyLimit; historyLoading = false; renderHistory();
            }),e => { if (requestVersion !== historyVersion) return; historyLoading = false; renderHistory(); error(e); });
          }
          dataSubscriptions.push(() => { historyVersion++; stopHistory?.(); });
          historyLoader = () => { if (!historyHasMore || historyLoading) return; historyLimit += 100; subscribeHistory(); };
          subscribeHistory();
          if (profile.role === 'admin') dataSubscriptions.push(dbSDK.onSnapshot(dbSDK.collection(db,'users'), s => {
            if (version !== authVersion || profile?.role !== 'admin') return;
            accessUsers = s.docs.map(d => ({...d.data(),id:d.id})); renderAccess(); teamManagement.refresh(); history.refresh();
          },error));
          if (profile.role === 'admin') dataSubscriptions.push(dbSDK.onSnapshot(dbSDK.collection(db,'duplicateReviews'),s => {
            if (version !== authVersion || profile?.role !== 'admin') return;
            reviews = s.docs.map(d => d.data()); duplicates.refresh();
          },error));
          render();
        },error));
      } catch(e) {
        const message = e.code === 'permission-denied'
          ? 'O banco bloqueou seu acesso. A administração precisa publicar as regras do Firestore para liberar o login.'
          : 'Não foi possível concluir o login: ' + e.message;
        $('#mode-notice').textContent = message;
        toast(message);
      }
    });
  } catch(e) { $('#mode-notice').textContent = 'Falha ao conectar ao Firebase. Verifique a configuração e a conexão.'; }
}
