import {FORMATIONS,POSITION_ROLES,MAX_POSITIONS,formationSlots,tacticalRoster,cleanLineup,placePlayer} from './tactics.js';
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
  const steps = element('ol',null,'tactics-steps');
  for (const text of ['Escolher time','Selecionar jogadores e reservas','Montar no campo']) steps.append(element('li',text));
  const teamPanel = element('div',null,'tactics-team-panel'); teamPanel.append(team.closest('label'));
  const preparation = element('div',null,'tactics-preparation'), preparationTitle = element('h3','Selecione os jogadores disponíveis');
  const preparationHint = element('p','Marque quem vai participar. Até 11 jogadores podem ocupar o campo; os demais ficam no banco de reservas.','tactics-instruction');
  const prepSearchLabel = element('label','Buscar no elenco'), prepSearch = element('input'); prepSearch.type = 'search'; prepSearch.placeholder = 'Nome do jogador'; prepSearchLabel.append(prepSearch);
  const preparationActions = element('div',null,'tactics-toolbar'), selectAll = element('button','Selecionar todo o elenco','row-action'), unselectAll = element('button','Limpar seleção','row-action'), continueToField = element('button','Montar no campo →','primary');
  for (const button of [selectAll,unselectAll,continueToField]) {button.type = 'button'; preparationActions.append(button);}
  const preparationCount = element('p',null,'tactics-selection-count'); preparationCount.setAttribute('role','status');
  const selectionList = element('div',null,'tactics-selection-list');
  preparation.append(preparationTitle,preparationHint,prepSearchLabel,preparationCount,selectionList,preparationActions);
  const editor = element('div'); editor.dataset.tacticsEditor = '';
  team.setAttribute('aria-label','Time do campinho'); formation.setAttribute('aria-label','Formação do campinho');
  for (const [id,preset] of Object.entries(FORMATIONS)) { const option = element('option',preset.label); option.value = id; formation.append(option); }
  const save = element('button','Salvar montagem','primary'), reset = element('button','Voltar às posições da formação','row-action'), clear = element('button','Devolver todos ao banco','row-action');
  for (const button of [save,reset,clear]) {button.type = 'button'; toolbar.append(button);}
  const backToSelection = element('button','← Editar jogadores e reservas','row-action'), autoPlace = element('button','Distribuir jogadores no campo','row-action'), undo = element('button','Desfazer','row-action'), redo = element('button','Refazer','row-action');
  for (const button of [backToSelection,autoPlace,undo,redo]) {button.type = 'button'; toolbar.append(button);}
  const positionTools = element('div',null,'tactics-toolbar tactics-position-tools');
  const addPosition = element('button','＋ Adicionar posição','row-action'), removePosition = element('button','Remover posição selecionada','row-action'), blank = element('button','Começar formação do zero','row-action');
  for (const button of [addPosition,removePosition,blank]) {button.type = 'button'; positionTools.append(button);}
  const roleLabel = element('label','Função da posição selecionada'), role = element('select'); role.setAttribute('aria-label','Função da posição selecionada');
  for (const [id,name] of Object.entries(POSITION_ROLES)) {const option = element('option',`${id} · ${name}`); option.value = id; role.append(option);}
  roleLabel.append(role); positionTools.append(roleLabel);
  const message = element('p',null,'tactics-feedback'); message.setAttribute('role','status');
  const instruction = element('p','Toque em um jogador do banco e depois em uma posição vazia. Para reposicionar, selecione um jogador no campo e toque em outro ponto, ou arraste.','tactics-instruction');
  const layout = element('div',null,'tactics-layout'), fieldPanel = element('div',null,'tactics-field-panel'), field = element('div',null,'tactics-pitch');
  field.setAttribute('aria-label','Campo de montagem da escalação');
  for (const className of ['tactics-boundary','tactics-halfway','tactics-circle','tactics-area tactics-area-top','tactics-area tactics-area-bottom','tactics-goal tactics-goal-top','tactics-goal tactics-goal-bottom']) { const line = element('div',null,className); line.setAttribute('aria-hidden','true'); field.append(line); }
  const markers = element('div',null,'tactics-markers'); field.append(markers);
  const count = element('p',null,'tactics-count'), returnPlayer = element('button','Devolver selecionado ao banco','row-action'); returnPlayer.type = 'button';
  fieldPanel.append(count,field,returnPlayer);
  const bench = element('aside',null,'tactics-bench'), searchLabel = element('label','Buscar no banco'), search = element('input'); search.type = 'search'; search.placeholder = 'Nome do jogador'; searchLabel.append(search);
  const benchTitle = element('h3','Banco de reservas'), benchList = element('div',null,'tactics-bench-list'); bench.append(benchTitle,element('p','Selecione um reserva e uma posição no campo para fazer a troca.','tactics-bench-hint'),searchLabel,benchList);
  layout.append(fieldPanel,bench); editor.append(toolbar,positionTools,message,instruction,layout); workspace.append(steps,teamPanel,preparation,editor);
  let sdk,db,unsubscribe,session='',loaded=demo,busy=false,selected='',selectedSlot=-1,generation=0,step=1;
  const histories = new Map();
  let saved = new Map(), drafts = new Map();
  if (demo) {try {saved = new Map(Object.entries(JSON.parse(localStorage.getItem('recreacao-tactics-demo') || '{}')));} catch {}}
  const roster = () => tacticalRoster(getPlayers(),team.value);
  const version = data => data?.updatedAt?.toMillis?.() ?? data?.updatedAt ?? null;
  function draft() {
    if (!drafts.has(team.value)) {
      const lineup = cleanLineup(saved.get(team.value),roster());
      drafts.set(team.value,{...lineup,squadIds:lineup.squadIds || lineup.slots.map(s => s.playerId).filter(Boolean),playerRoles:lineup.playerRoles || {},dirty:false,base:version(saved.get(team.value))});
    }
    return drafts.get(team.value);
  }
  const lineupState = () => {const value = draft(); return structuredClone({formation:value.formation,slots:value.slots,squadIds:value.squadIds,playerRoles:value.playerRoles});};
  function history() {if (!histories.has(team.value)) histories.set(team.value,{past:[],future:[]}); return histories.get(team.value);}
  function change(next) {const stack = history(); stack.past.push(lineupState()); if (stack.past.length > 40) stack.past.shift(); stack.future = []; Object.assign(draft(),next,{dirty:true}); renderBoard();}
  function restore(from,to) {const stack = history(); if (busy || !stack[from].length) return; stack[to].push(lineupState()); Object.assign(draft(),stack[from].pop(),{dirty:true}); selected = ''; selectedSlot = -1; renderBoard();}
  undo.onclick = () => restore('past','future'); redo.onclick = () => restore('future','past');
  function selectedRoster() {const ids = new Set(draft().squadIds); return roster().filter(p => ids.has(p.id));}
  function renderSelection() {
    const enabled = isAdmin() && loaded && isReady() && !!team.value;
    step = !team.value ? 1 : step;
    preparation.hidden = !enabled || step === 3; editor.hidden = !enabled || step !== 3;
    [...steps.children].forEach((item,index) => {item.classList.toggle('active',index+1 === step); if (index+1 === step) item.setAttribute('aria-current','step'); else item.removeAttribute('aria-current');});
    selectionList.replaceChildren();
    if (!enabled) {preparationCount.textContent = ''; return;}
    const value = draft(), all = roster(), ids = new Set(value.squadIds), query = prepSearch.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    continueToField.disabled = busy || !ids.size; selectAll.disabled = busy || !all.length; unselectAll.disabled = busy || !ids.size;
    preparationCount.textContent = `${ids.size} selecionado(s) de ${all.length} jogadores ativos · defina as posições para ajudar a distribuir no campo.`;
    for (const player of all.filter(p => p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query))) {
      const row = element('div',null,'tactics-selection-player'), label = element('label'), checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.value = player.id; checkbox.checked = ids.has(player.id); checkbox.disabled = busy; checkbox.dataset.squadPlayer = player.id;
      label.append(checkbox,element('strong',playerName(player.name))); row.append(label);
      const position = element('select'); position.setAttribute('aria-label',`Posição de ${playerName(player.name)}`); position.disabled = busy || !ids.has(player.id);
      for (const [id,name] of Object.entries(POSITION_ROLES)) {const option = element('option',`${id} · ${name}`); option.value = id; position.append(option);}
      position.value = value.playerRoles[player.id] || (player.goalkeeper ? 'GOL' : 'LIVRE');
      checkbox.onchange = () => {const chosen = new Set(draft().squadIds); if (checkbox.checked) chosen.add(player.id); else chosen.delete(player.id); change({squadIds:[...chosen].slice(0,200),playerRoles:{...draft().playerRoles,[player.id]:position.value}});};
      position.onchange = () => change({playerRoles:{...draft().playerRoles,[player.id]:position.value}});
      row.append(position); selectionList.append(row);
    }
    if (!selectionList.children.length) selectionList.append(element('p',all.length ? 'Nenhum jogador encontrado.' : 'Este time não possui jogadores ativos.'));
  }
  prepSearch.oninput = renderSelection;
  selectAll.onclick = () => {const players = roster().slice(0,200); change({squadIds:players.map(p => p.id),playerRoles:Object.fromEntries(players.map(p => [p.id,draft().playerRoles[p.id] || (p.goalkeeper ? 'GOL' : 'LIVRE')]))});};
  unselectAll.onclick = () => change({squadIds:[]});
  continueToField.onclick = () => {if (busy || !draft().squadIds.length) return; step = 3; selected = ''; selectedSlot = -1; renderBoard(); editor.scrollIntoView?.({behavior:'smooth',block:'start'});};
  backToSelection.onclick = () => {step = 2; selected = ''; selectedSlot = -1; renderBoard(); preparation.scrollIntoView?.({behavior:'smooth',block:'start'});};
  autoPlace.onclick = () => {
    const value = draft(), candidates = selectedRoster(), slots = value.slots.length ? structuredClone(value.slots) : formationSlots('4-4-2');
    const assigned = new Set(slots.map(s => s.playerId).filter(Boolean));
    const remaining = candidates.filter(p => !assigned.has(p.id));
    for (const slot of slots.filter(s => !s.playerId)) {
      if (!remaining.length) break;
      const index = remaining.findIndex(p => (value.playerRoles[p.id] || (p.goalkeeper ? 'GOL' : 'LIVRE')) === slot.role);
      const player = remaining.splice(index < 0 ? 0 : index,1)[0]; slot.playerId = player.id;
      if (value.playerRoles[player.id] && value.playerRoles[player.id] !== 'LIVRE') slot.role = value.playerRoles[player.id];
    }
    change({formation:value.slots.length ? value.formation : '4-4-2',slots});
  };
  function syncSession() {
    const next = isAdmin() ? (demo ? 'demo' : getUserId() || '') : '';
    if (session === next) return;
    generation++; unsubscribe?.(); unsubscribe = null; session = next; selected = ''; selectedSlot = -1; step = 1; drafts.clear(); histories.clear();
    if (!demo) saved.clear(); loaded = demo;
    if (next && sdk && !demo) {
      const current = generation;
      unsubscribe = sdk.onSnapshot(sdk.collection(db,'tacticalLineups'),snapshot => {
        if (current !== generation || !isAdmin()) return;
        saved = new Map(snapshot.docs.map(doc => [doc.id,doc.data()])); loaded = true;
        for (const [id,value] of drafts) if (!value.dirty) {drafts.delete(id); histories.delete(id);}
        refresh();
      },error => { if (current === generation) {loaded = false; message.textContent = 'Não foi possível carregar as montagens: '+error.message;} });
    }
  }
  team.onchange = () => {selected = ''; selectedSlot = -1; step = team.value ? 2 : 1; search.value = ''; prepSearch.value = ''; renderBoard();};
  search.oninput = () => renderBoard();
  formation.onchange = () => {
    if (formation.value === 'custom') {change({formation:'custom'}); return;}
    const old = draft(), slots = formationSlots(formation.value);
    old.slots.forEach((slot,index) => {if (slots[index]) slots[index].playerId = slot.playerId;});
    selected = ''; selectedSlot = -1; change({formation:formation.value,slots});
  };
  addPosition.onclick = () => {
    if (busy || !isAdmin() || draft().slots.length >= MAX_POSITIONS) return;
    selected = ''; selectedSlot = draft().slots.length;
    change({formation:'custom',slots:[...draft().slots,{playerId:'',x:20+(selectedSlot%4)*20,y:30+Math.floor(selectedSlot/4)*20,role:'LIVRE'}]});
  };
  removePosition.onclick = () => {
    if (busy || !isAdmin() || selectedSlot < 0) return;
    const slots = draft().slots.filter((_,index) => index !== selectedSlot); selected = ''; selectedSlot = -1; change({formation:'custom',slots});
  };
  blank.onclick = () => {selected = ''; selectedSlot = -1; change({formation:'custom',slots:[]});};
  role.onchange = () => {if (busy || !isAdmin() || selectedSlot < 0) return; const slots = structuredClone(draft().slots); slots[selectedSlot].role = role.value; change({formation:'custom',slots});};
  reset.onclick = () => change({slots:formationSlots(draft().formation).map((slot,index) => ({...slot,playerId:draft().slots[index]?.playerId || ''}))});
  clear.onclick = () => {selected = ''; change({slots:draft().slots.map(s => ({...s,playerId:''}))});};
  returnPlayer.onclick = () => {if (!selected || busy) return; const id = selected; selected = ''; change({slots:draft().slots.map(s => s.playerId === id ? {...s,playerId:''} : s)});};
  function assign(index) {
    if (!selected || busy || !isAdmin()) return;
    const next = placePlayer(draft(),selected,index);
    const preferred = draft().playerRoles[selected]; if (preferred && preferred !== 'LIVRE') next.slots[index].role = preferred;
    selected = ''; selectedSlot = -1; change(next);
  }
  function point(event) { const rect = field.getBoundingClientRect(); return {x:Math.round(Math.min(92,Math.max(8,(event.clientX-rect.left)/rect.width*100))),y:Math.round(Math.min(92,Math.max(8,(event.clientY-rect.top)/rect.height*100)))}; }
  field.onclick = event => {
    if (event.target.closest('button') || busy || !isAdmin()) return;
    if (selectedSlot >= 0 && !selected) {const slots = structuredClone(draft().slots); Object.assign(slots[selectedSlot],point(event)); change({formation:'custom',slots}); return;}
    if (!selected) return;
    const lineup = draft(), index = lineup.slots.findIndex(s => s.playerId === selected);
    if (index >= 0) {const slots = structuredClone(lineup.slots); Object.assign(slots[index],point(event)); change({formation:'custom',slots});}
    else {
      const empty = lineup.slots.findIndex(s => !s.playerId), at = point(event);
      if (empty >= 0) {const next = placePlayer(lineup,selected,empty); Object.assign(next.slots[empty],at); const preferred = lineup.playerRoles[selected]; if (preferred && preferred !== 'LIVRE') next.slots[empty].role = preferred; selected = ''; change({...next,formation:'custom'});}
      else if (lineup.slots.length < MAX_POSITIONS) {const id = selected; selected = ''; change({formation:'custom',slots:[...lineup.slots,{playerId:id,...at,role:lineup.playerRoles[id] || 'LIVRE'}]});}
      else toast('O campo está completo. Devolva um jogador ao banco para abrir uma posição.');
    }
  };
  function attachDrag(button,id,slotIndex = null) {
    button.onpointerdown = event => {
      if (busy || !isAdmin() || (event.button != null && event.button !== 0)) return;
      const initial = {x:event.clientX,y:event.clientY}; let moved = false, ghost;
      button.setPointerCapture?.(event.pointerId);
      button.onpointermove = move => {
        if (Math.hypot(move.clientX-initial.x,move.clientY-initial.y) < 8 && !moved) return;
        moved = true; button.classList.add('dragging');
        if (!ghost) {ghost = element('div',playerName(roster().find(p => p.id === id)?.name || (slotIndex == null ? '' : draft().slots[slotIndex]?.role || 'POSIÇÃO LIVRE')),'tactics-drag-ghost'); ghost.setAttribute('aria-hidden','true'); document.body.append(ghost);}
        ghost.style.left = move.clientX+'px'; ghost.style.top = move.clientY+'px';
        if (slotIndex != null) {const at = point(move); button.style.left = at.x+'%'; button.style.top = at.y+'%';}
        if (slotIndex == null) {
          const rect = field.getBoundingClientRect(), at = point(move);
          [...markers.children].forEach((marker,index) => {const slot = draft().slots[index]; marker.classList.toggle('drop-target',Math.hypot((slot.x-at.x)*rect.width/100,(slot.y-at.y)*rect.height/100) < 48);});
        }
      };
      const cleanup = () => {ghost?.remove(); button.onpointermove = null; button.onpointerup = null; button.onpointercancel = null; button.classList.remove('dragging'); [...markers.children].forEach(marker => marker.classList.remove('drop-target'));};
      button.onpointercancel = () => {cleanup(); renderBoard();};
      button.onpointerup = up => {
        cleanup(); if (!moved || busy || !isAdmin()) return;
        button.onclick = event => event.stopPropagation();
        const rect = field.getBoundingClientRect();
        const benchRect = bench.getBoundingClientRect();
        if (slotIndex != null && id && up.clientX >= benchRect.left && up.clientX <= benchRect.right && up.clientY >= benchRect.top && up.clientY <= benchRect.bottom) {
          selected = ''; selectedSlot = -1; change({slots:draft().slots.map((slot,index) => index === slotIndex ? {...slot,playerId:''} : slot)}); return;
        }
        if (up.clientX < rect.left || up.clientX > rect.right || up.clientY < rect.top || up.clientY > rect.bottom) {renderBoard(); return;}
        const lineup = draft(), at = point(up), occupied = lineup.slots.findIndex(s => s.playerId === id);
        if (slotIndex != null) {const slots = structuredClone(lineup.slots); Object.assign(slots[slotIndex],at); selected = ''; selectedSlot = slotIndex; change({formation:'custom',slots}); return;}
        let index = occupied;
        if (index < 0) index = lineup.slots.findIndex(slot => Math.hypot((slot.x-at.x)*rect.width/100,(slot.y-at.y)*rect.height/100) < 48);
        if (index < 0) index = lineup.slots.reduce((best,s,i) => s.playerId ? best : best < 0 || Math.hypot(s.x-at.x,s.y-at.y) < Math.hypot(lineup.slots[best].x-at.x,lineup.slots[best].y-at.y) ? i : best,-1);
        if (index < 0 && lineup.slots.length < MAX_POSITIONS) {selected = ''; selectedSlot = lineup.slots.length; change({formation:'custom',slots:[...lineup.slots,{playerId:id,...at,role:lineup.playerRoles[id] || 'LIVRE'}]}); return;}
        if (index < 0) {toast('O campo está completo. Devolva um jogador ao banco primeiro.'); renderBoard(); return;}
        const next = placePlayer(lineup,id,index); Object.assign(next.slots[index],at);
        const preferred = lineup.playerRoles[id]; if (preferred && preferred !== 'LIVRE') next.slots[index].role = preferred;
        selected = ''; change({...next,formation:'custom'});
      };
    };
  }
  function renderBoard() {
    const enabled = isAdmin() && loaded && isReady() && !!team.value;
    for (const control of [team,formation,reset,clear,addPosition,removePosition,blank,role,backToSelection,autoPlace]) control.disabled = busy || !enabled;
    renderSelection();
    // A seleção de time continua disponível quando ainda não existe uma montagem.
    team.disabled = busy || !isAdmin() || !loaded || !isReady() || !team.options.length;
    layout.hidden = !enabled; save.disabled = busy || !enabled; returnPlayer.disabled = true;
    if (!enabled) {markers.replaceChildren(); benchList.replaceChildren(); if (!busy) message.textContent = !isReady() || !loaded ? 'Carregando times, jogadores e montagens…' : 'Cadastre um time ativo para montar a escalação.'; return;}
    const value = draft(), eligible = roster(), cleaned = cleanLineup(value,eligible);
    if (selectedSlot >= value.slots.length) selectedSlot = -1;
    addPosition.disabled = busy || value.slots.length >= MAX_POSITIONS;
    removePosition.disabled = busy || selectedSlot < 0;
    role.disabled = busy || selectedSlot < 0;
    role.value = value.slots[selectedSlot]?.role || (selectedSlot === 0 && value.formation !== 'custom' ? 'GOL' : 'LIVRE');
    reset.disabled = busy || value.formation === 'custom';
    if (JSON.stringify({slots:value.slots,squadIds:value.squadIds,playerRoles:value.playerRoles}) !== JSON.stringify({slots:cleaned.slots,squadIds:cleaned.squadIds,playerRoles:cleaned.playerRoles})) {Object.assign(value,cleaned,{dirty:true}); renderSelection();}
    const participants = selectedRoster();
    undo.disabled = busy || !history().past.length; redo.disabled = busy || !history().future.length; autoPlace.disabled = busy || !participants.length;
    if (selected && !participants.some(p => p.id === selected)) selected = '';
    instruction.textContent = selected ? `${playerName(eligible.find(p => p.id === selected).name)} selecionado. Toque em uma posição ou em um ponto do campo. Para trocar com outro jogador, toque nele.` : 'Arraste qualquer posição, mesmo vazia, para criar sua formação. Ou selecione a posição e toque no destino. Adicione e remova posições livremente, até 11 no campo. Toque em um jogador do banco para escalá-lo.';
    formation.value = value.formation;
    const ids = new Set(value.slots.map(s => s.playerId).filter(Boolean)), byId = new Map(participants.map(p => [p.id,p]));
    count.textContent = `${getTeams()[team.value]?.name || team.value} · ${ids.size} de ${value.slots.length} no campo · ${participants.length-ids.size} reservas`;
    message.textContent = busy ? 'Salvando montagem…' : value.dirty ? 'Alterações não salvas. Clique em Salvar montagem para guardar.' : saved.has(team.value) ? 'Montagem salva. Visível somente para administradores.' : 'Monte os jogadores e salve quando terminar.';
    save.textContent = busy ? 'Salvando…' : 'Salvar montagem';
    markers.replaceChildren();
    value.slots.forEach((slot,index) => {
      const player = byId.get(slot.playerId), marker = element('button',null,'tactics-marker'+(selectedSlot === index || selected && selected === slot.playerId ? ' selected' : '')+(player ? ' occupied' : ''));
      const positionRole = slot.role || (index === 0 && value.formation !== 'custom' ? 'GOL' : 'LIVRE');
      marker.type = 'button'; marker.style.left = slot.x+'%'; marker.style.top = slot.y+'%'; marker.disabled = busy;
      marker.append(element('span',positionRole === 'LIVRE' ? player ? String(index+1) : '+' : positionRole,'tactics-shirt'),element('span',player ? playerName(player.name) : playerName(POSITION_ROLES[positionRole]),'tactics-player-name'));
      marker.setAttribute('aria-label',`${player ? playerName(player.name) : 'Posição '+(index+1)} · ${POSITION_ROLES[positionRole]}. Arraste ou use as setas para ajustar a posição.`);
      marker.setAttribute('aria-pressed',String(selectedSlot === index));
      marker.onclick = event => {event.stopPropagation(); if (selected && selected !== slot.playerId) assign(index); else {const wasSelected = selectedSlot === index; selectedSlot = wasSelected ? -1 : index; selected = wasSelected ? '' : slot.playerId; renderBoard();}};
      marker.onkeydown = event => {
        const direction = {ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2]}[event.key];
        if (!direction || busy) return; event.preventDefault();
        const stack = history(); stack.past.push(lineupState()); if (stack.past.length > 40) stack.past.shift(); stack.future = [];
        slot.x = Math.min(92,Math.max(8,slot.x+direction[0])); slot.y = Math.min(92,Math.max(8,slot.y+direction[1])); value.dirty = true; value.formation = 'custom'; formation.value = 'custom'; reset.disabled = true; undo.disabled = false; redo.disabled = true;
        marker.style.left = slot.x+'%'; marker.style.top = slot.y+'%'; message.textContent = 'Alterações não salvas. Clique em Salvar montagem para guardar.';
      };
      attachDrag(marker,player?.id || '',index); markers.append(marker);
    });
    returnPlayer.disabled = busy || !value.slots.some(s => s.playerId && s.playerId === selected);
    benchList.replaceChildren(); const query = search.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const available = participants.filter(p => !ids.has(p.id)), matches = available.filter(p => p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query));
    benchTitle.textContent = `Banco de reservas · ${available.length}`;
    for (const player of matches) {
      const button = element('button',null,'tactics-bench-player'+(selected === player.id ? ' selected' : '')); button.type = 'button'; button.disabled = busy;
      button.append(element('span',player.goalkeeper ? '🧤' : '♙','tactics-bench-icon'),element('strong',playerName(player.name)));
      button.append(element('small',value.playerRoles[player.id] || (player.goalkeeper ? 'GOL' : 'LIVRE'),'tactics-bench-role'));
      button.setAttribute('aria-pressed',String(selected === player.id)); button.onclick = () => {selected = selected === player.id ? '' : player.id; selectedSlot = -1; renderBoard();};
      attachDrag(button,player.id); benchList.append(button);
    }
    if (!matches.length) benchList.append(element('p',!participants.length ? 'Selecione os jogadores antes de montar o campo.' : !available.length ? 'Todos os selecionados estão no campo. Use Editar jogadores e reservas para incluir mais reservas.' : 'Nenhum jogador encontrado.'));
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
      drafts.delete(id); histories.delete(id); selected = ''; selectedSlot = -1; toast('Montagem e banco de reservas salvos. A escalação do Dia de jogo não foi alterada.');
    } catch(error) {if (currentSession === generation) toast('Não foi possível salvar: '+error.message);}
    finally {busy = false; if (currentSession === generation) renderBoard();}
  };
  function refresh() {
    syncSession(); link.hidden = !isAdmin(); restricted.hidden = isAdmin(); workspace.hidden = !isAdmin();
    if (!isAdmin()) {markers.replaceChildren(); benchList.replaceChildren(); team.replaceChildren(); return;}
    const previous = team.value; team.replaceChildren();
    const placeholder = element('option','Selecione um time'); placeholder.value = ''; team.append(placeholder);
    for (const [id,value] of Object.entries(getTeams())) if (value.status === 'active') {const option = element('option',value.name); option.value = id; team.append(option);}
    if ([...team.options].some(o => o.value === previous)) team.value = previous;
    renderBoard();
  }
  return {refresh,connect(databaseSDK,database) {sdk = databaseSDK; db = database; session = ''; refresh();}};
}
