import {FORMATIONS,formationSlots,tacticalRoster,cleanLineup,placePlayer} from './tactics.js';
import {playerName} from './domain.js';

export function setupTactics({element,isAdmin,getUserId,getPlayers,getTeams,isReady,toast,demo}) {
  const link = element('a','⚽ Campinho'); link.href = '#/campinho'; link.dataset.nav = 'campinho'; link.hidden = true;
  document.querySelector('nav').append(link);
  const page = element('section',null,'page-section tactics-page'); page.dataset.page = 'campinho'; page.hidden = true;
  const heading = element('h2','Campinho'), restricted = element('p','Esta página é exclusiva da administração.','notice');
  const workspace = element('div');
  page.append(heading,restricted,workspace); document.querySelector('footer').before(page);
  workspace.append(element('p','Escolha um time e monte os jogadores no campo. Esta organização é privada dos administradores e não altera a lista publicada no Dia de jogo.','tactics-intro'));
  const toolbar = element('div',null,'tactics-toolbar');
  function select(label) { const field = element('label',label), input = element('select'); field.append(input); toolbar.append(field); return input; }
  const team = select('Time'), formation = select('Formação');
  team.setAttribute('aria-label','Time do campinho'); formation.setAttribute('aria-label','Formação do campinho');
  for (const [id,preset] of Object.entries(FORMATIONS)) { const option = element('option',preset.label); option.value = id; formation.append(option); }
  const save = element('button','Salvar montagem','primary'), reset = element('button','Voltar às posições da formação','row-action'), clear = element('button','Devolver todos ao banco','row-action');
  for (const button of [save,reset,clear]) {button.type = 'button'; toolbar.append(button);}
  const message = element('p',null,'tactics-feedback'); message.setAttribute('role','status');
  const instruction = element('p','Toque em um jogador do banco e depois em uma posição vazia. Para reposicionar, selecione um jogador no campo e toque em outro ponto, ou arraste.','tactics-instruction');
  const layout = element('div',null,'tactics-layout'), fieldPanel = element('div',null,'tactics-field-panel'), field = element('div',null,'tactics-pitch');
  field.setAttribute('aria-label','Campo de montagem da escalação');
  for (const className of ['tactics-boundary','tactics-halfway','tactics-circle','tactics-area tactics-area-top','tactics-area tactics-area-bottom','tactics-goal tactics-goal-top','tactics-goal tactics-goal-bottom']) { const line = element('div',null,className); line.setAttribute('aria-hidden','true'); field.append(line); }
  const markers = element('div',null,'tactics-markers'); field.append(markers);
  const count = element('p',null,'tactics-count'), returnPlayer = element('button','Devolver selecionado ao banco','row-action'); returnPlayer.type = 'button';
  fieldPanel.append(count,field,returnPlayer);
  const bench = element('aside',null,'tactics-bench'), searchLabel = element('label','Buscar no banco'), search = element('input'); search.type = 'search'; search.placeholder = 'Nome do jogador'; searchLabel.append(search);
  const benchTitle = element('h3','Banco'), benchList = element('div',null,'tactics-bench-list'); bench.append(benchTitle,searchLabel,benchList);
  layout.append(fieldPanel,bench); workspace.append(toolbar,message,instruction,layout);
  let sdk,db,unsubscribe,session='',loaded=demo,busy=false,selected='',generation=0;
  let saved = new Map(), drafts = new Map();
  if (demo) {try {saved = new Map(Object.entries(JSON.parse(localStorage.getItem('recreacao-tactics-demo') || '{}')));} catch {}}
  const roster = () => tacticalRoster(getPlayers(),team.value);
  const version = data => data?.updatedAt?.toMillis?.() ?? data?.updatedAt ?? null;
  function draft() {
    if (!drafts.has(team.value)) drafts.set(team.value,{...cleanLineup(saved.get(team.value),roster()),dirty:false,base:version(saved.get(team.value))});
    return drafts.get(team.value);
  }
  function change(next) { Object.assign(draft(),next,{dirty:true}); renderBoard(); }
  function syncSession() {
    const next = isAdmin() ? (demo ? 'demo' : getUserId() || '') : '';
    if (session === next) return;
    generation++; unsubscribe?.(); unsubscribe = null; session = next; selected = ''; drafts.clear();
    if (!demo) saved.clear(); loaded = demo;
    if (next && sdk && !demo) {
      const current = generation;
      unsubscribe = sdk.onSnapshot(sdk.collection(db,'tacticalLineups'),snapshot => {
        if (current !== generation || !isAdmin()) return;
        saved = new Map(snapshot.docs.map(doc => [doc.id,doc.data()])); loaded = true;
        for (const [id,value] of drafts) if (!value.dirty) drafts.delete(id);
        refresh();
      },error => { if (current === generation) {loaded = false; message.textContent = 'Não foi possível carregar as montagens: '+error.message;} });
    }
  }
  team.onchange = () => {selected = ''; search.value = ''; renderBoard();};
  search.oninput = () => renderBoard();
  formation.onchange = () => {
    const old = draft(), slots = formationSlots(formation.value);
    old.slots.forEach((slot,index) => {if (slots[index]) slots[index].playerId = slot.playerId;});
    selected = ''; change({formation:formation.value,slots});
  };
  reset.onclick = () => change({slots:formationSlots(draft().formation).map((slot,index) => ({...slot,playerId:draft().slots[index]?.playerId || ''}))});
  clear.onclick = () => {selected = ''; change({slots:draft().slots.map(s => ({...s,playerId:''}))});};
  returnPlayer.onclick = () => {if (!selected || busy) return; const id = selected; selected = ''; change({slots:draft().slots.map(s => s.playerId === id ? {...s,playerId:''} : s)});};
  function assign(index) {
    if (!selected || busy || !isAdmin()) return;
    const next = placePlayer(draft(),selected,index); selected = ''; change(next);
  }
  function point(event) { const rect = field.getBoundingClientRect(); return {x:Math.round(Math.min(92,Math.max(8,(event.clientX-rect.left)/rect.width*100))),y:Math.round(Math.min(92,Math.max(8,(event.clientY-rect.top)/rect.height*100)))}; }
  field.onclick = event => {
    if (event.target.closest('button') || !selected || busy || !isAdmin()) return;
    const lineup = draft(), index = lineup.slots.findIndex(s => s.playerId === selected);
    if (index >= 0) {const slots = structuredClone(lineup.slots); Object.assign(slots[index],point(event)); change({slots});}
    else {const empty = lineup.slots.findIndex(s => !s.playerId); if (empty >= 0) {const next = placePlayer(lineup,selected,empty); Object.assign(next.slots[empty],point(event)); selected = ''; change(next);} else toast('O campo está completo. Devolva um jogador ao banco para abrir uma posição.');}
  };
  function attachDrag(button,id) {
    button.onpointerdown = event => {
      if (busy || !isAdmin() || (event.button != null && event.button !== 0)) return;
      const initial = {x:event.clientX,y:event.clientY}; let moved = false, ghost;
      button.setPointerCapture?.(event.pointerId);
      button.onpointermove = move => {
        if (Math.hypot(move.clientX-initial.x,move.clientY-initial.y) < 8 && !moved) return;
        moved = true; button.classList.add('dragging');
        if (!ghost) {ghost = element('div',playerName(roster().find(p => p.id === id)?.name || ''),'tactics-drag-ghost'); ghost.setAttribute('aria-hidden','true'); document.body.append(ghost);}
        ghost.style.left = move.clientX+'px'; ghost.style.top = move.clientY+'px';
      };
      const cleanup = () => {ghost?.remove(); button.onpointermove = null; button.onpointerup = null; button.onpointercancel = null; button.classList.remove('dragging');};
      button.onpointercancel = cleanup;
      button.onpointerup = up => {
        cleanup(); if (!moved || busy || !isAdmin()) return;
        button.onclick = event => event.stopPropagation();
        const rect = field.getBoundingClientRect();
        if (up.clientX < rect.left || up.clientX > rect.right || up.clientY < rect.top || up.clientY > rect.bottom) {renderBoard(); return;}
        const lineup = draft(), at = point(up), occupied = lineup.slots.findIndex(s => s.playerId === id);
        let index = occupied;
        if (index < 0) index = lineup.slots.reduce((best,s,i) => s.playerId ? best : best < 0 || Math.hypot(s.x-at.x,s.y-at.y) < Math.hypot(lineup.slots[best].x-at.x,lineup.slots[best].y-at.y) ? i : best,-1);
        if (index < 0) {toast('O campo está completo. Devolva um jogador ao banco primeiro.'); renderBoard(); return;}
        const next = placePlayer(lineup,id,index); Object.assign(next.slots[index],at); selected = ''; change(next);
      };
    };
  }
  function renderBoard() {
    const enabled = isAdmin() && loaded && isReady() && !!team.value;
    for (const control of [team,formation,reset,clear]) control.disabled = busy || !enabled;
    // A seleção de time continua disponível quando ainda não existe uma montagem.
    team.disabled = busy || !isAdmin() || !loaded || !isReady() || !team.options.length;
    layout.hidden = !enabled; save.disabled = busy || !enabled; returnPlayer.disabled = true;
    if (!enabled) {markers.replaceChildren(); benchList.replaceChildren(); if (!busy) message.textContent = !isReady() || !loaded ? 'Carregando times, jogadores e montagens…' : 'Cadastre um time ativo para montar a escalação.'; return;}
    const value = draft(), eligible = roster(), cleaned = cleanLineup(value,eligible);
    if (JSON.stringify(value.slots) !== JSON.stringify(cleaned.slots)) Object.assign(value,cleaned,{dirty:true});
    if (selected && !eligible.some(p => p.id === selected)) selected = '';
    instruction.textContent = selected ? `${playerName(eligible.find(p => p.id === selected).name)} selecionado. Toque em uma posição ou em um ponto do campo. Para trocar com outro jogador, toque nele.` : 'Toque em um jogador do banco e depois em uma posição vazia. Para reposicionar, selecione um jogador no campo e toque em outro ponto, ou arraste.';
    formation.value = value.formation;
    const ids = new Set(value.slots.map(s => s.playerId).filter(Boolean)), byId = new Map(eligible.map(p => [p.id,p]));
    count.textContent = `${getTeams()[team.value]?.name || team.value} · ${ids.size} de ${value.slots.length} no campo · ${eligible.length-ids.size} no banco`;
    message.textContent = busy ? 'Salvando montagem…' : value.dirty ? 'Alterações não salvas. Clique em Salvar montagem para guardar.' : saved.has(team.value) ? 'Montagem salva. Visível somente para administradores.' : 'Monte os jogadores e salve quando terminar.';
    save.textContent = busy ? 'Salvando…' : 'Salvar montagem';
    markers.replaceChildren();
    value.slots.forEach((slot,index) => {
      const player = byId.get(slot.playerId), marker = element('button',null,'tactics-marker'+(selected && selected === slot.playerId ? ' selected' : '')+(player ? ' occupied' : ''));
      marker.type = 'button'; marker.style.left = slot.x+'%'; marker.style.top = slot.y+'%'; marker.disabled = busy;
      marker.append(element('span',player ? index === 0 ? 'GOL' : String(index+1) : '+','tactics-shirt'),element('span',player ? playerName(player.name) : index === 0 ? 'GOLEIRO' : 'POSIÇÃO LIVRE','tactics-player-name'));
      marker.setAttribute('aria-label',player ? `${playerName(player.name)}. Selecionar ou arrastar. Use as setas para ajustar a posição.` : `Posição ${index+1}${index === 0 ? ', goleiro' : ''}. Colocar jogador selecionado.`);
      marker.setAttribute('aria-pressed',String(!!player && selected === slot.playerId));
      marker.onclick = event => {event.stopPropagation(); if (selected && selected !== slot.playerId) assign(index); else if (player) {selected = selected === slot.playerId ? '' : slot.playerId; renderBoard();} else assign(index);};
      marker.onkeydown = event => {
        const direction = {ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2]}[event.key];
        if (!direction || !player || busy) return; event.preventDefault();
        slot.x = Math.min(92,Math.max(8,slot.x+direction[0])); slot.y = Math.min(92,Math.max(8,slot.y+direction[1])); value.dirty = true;
        marker.style.left = slot.x+'%'; marker.style.top = slot.y+'%'; message.textContent = 'Alterações não salvas. Clique em Salvar montagem para guardar.';
      };
      if (player) attachDrag(marker,player.id); markers.append(marker);
    });
    returnPlayer.disabled = busy || !value.slots.some(s => s.playerId && s.playerId === selected);
    benchList.replaceChildren(); const query = search.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const available = eligible.filter(p => !ids.has(p.id)), matches = available.filter(p => p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query));
    benchTitle.textContent = `Banco · ${available.length}`;
    for (const player of matches) {
      const button = element('button',null,'tactics-bench-player'+(selected === player.id ? ' selected' : '')); button.type = 'button'; button.disabled = busy;
      button.append(element('span',player.goalkeeper ? '🧤' : '♙','tactics-bench-icon'),element('strong',playerName(player.name)));
      button.setAttribute('aria-pressed',String(selected === player.id)); button.onclick = () => {selected = selected === player.id ? '' : player.id; renderBoard();};
      attachDrag(button,player.id); benchList.append(button);
    }
    if (!matches.length) benchList.append(element('p',!eligible.length ? 'Este time não possui jogadores ativos.' : !available.length ? 'Todos os jogadores estão no campo.' : 'Nenhum jogador encontrado.'));
  }
  save.onclick = async () => {
    if (busy || !isAdmin() || !isReady() || !loaded || !team.value) return;
    const id = team.value, value = draft(), lineup = cleanLineup(value,roster()), currentSession = generation;
    busy = true; renderBoard();
    try {
      if (demo) {saved.set(id,{...lineup,updatedAt:Date.now()}); localStorage.setItem('recreacao-tactics-demo',JSON.stringify(Object.fromEntries(saved)));}
      else await sdk.runTransaction(db,async tx => {
        const ref = sdk.doc(db,'tacticalLineups',id), snapshot = await tx.get(ref);
        if (version(snapshot.data()) !== value.base) throw Error('Outro administrador alterou esta montagem. Troque de página e recarregue o site para conferir antes de salvar novamente.');
        tx.set(ref,{teamId:id,...lineup,updatedAt:sdk.serverTimestamp(),updatedBy:getUserId()});
      });
      if (currentSession !== generation || !isAdmin()) return;
      drafts.delete(id); selected = ''; toast('Montagem salva. A escalação do Dia de jogo não foi alterada.');
    } catch(error) {if (currentSession === generation) toast('Não foi possível salvar: '+error.message);}
    finally {busy = false; if (currentSession === generation) renderBoard();}
  };
  function refresh() {
    syncSession(); link.hidden = !isAdmin(); restricted.hidden = isAdmin(); workspace.hidden = !isAdmin();
    if (!isAdmin()) {markers.replaceChildren(); benchList.replaceChildren(); team.replaceChildren(); return;}
    const previous = team.value; team.replaceChildren();
    for (const [id,value] of Object.entries(getTeams())) if (value.status === 'active') {const option = element('option',value.name); option.value = id; team.append(option);}
    if ([...team.options].some(o => o.value === previous)) team.value = previous;
    renderBoard();
  }
  return {refresh,connect(databaseSDK,database) {sdk = databaseSDK; db = database; session = ''; refresh();}};
}
