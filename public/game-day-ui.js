import {localDay,weekStart,dateValue,weekDeadline,gameWeekDetails,compareGameList,gameListEntries,gameEntryIssue,GAME_ISSUES,canSubmitSquad,rosterChoices,gameReviewSummary} from './game-day.js';
import {isActivePlayer,playerName} from './domain.js';
import {roundSummary,fixtureText} from './game-sharing.js';

export function setupGameDay({element,getProfile,getUserId,getPlayers,getTeams,mutate,toast,demo}) {
  const link = element('a','⚽ Dia de jogo'); link.href = '#/dia-de-jogo'; link.dataset.nav = 'dia-de-jogo'; document.querySelector('nav').append(link);
  const adminLink = element('a','⚙ Jogos da semana'); adminLink.href = '#/gerenciar-rodada'; adminLink.dataset.nav = 'gerenciar-rodada'; adminLink.hidden = true; document.querySelector('nav').append(adminLink);
  const adminPage = element('section',null,'page-section'); adminPage.dataset.page = 'gerenciar-rodada'; adminPage.hidden = true;
  const adminHeading = element('h2','Jogos da semana'), adminRestriction = element('p','Esta página é exclusiva da administração.');
  const adminWeekLabel = element('label','Escolha uma data da semana'), adminReference = element('input'); adminReference.type = 'date'; adminWeekLabel.append(adminReference);
  adminPage.append(adminHeading,adminRestriction,adminWeekLabel); document.querySelector('footer').before(adminPage);
  const page = element('section',null,'page-section'); page.dataset.page = 'dia-de-jogo'; page.hidden = true;
  const title = element('h2','Dia de jogo'); title.tabIndex = -1;
  const weekLabel = element('label','Escolha uma data da semana'), reference = element('input'); reference.type = 'date'; reference.value = localDay(); weekLabel.append(reference);
  const message = element('p',null,'notice'); message.setAttribute('role','status');
  page.append(title,element('p','O admin define os times da semana. O diretor envia sua escalação até quinta-feira, às 23h59 (Brasília). Depois do prazo, o admin pode corrigir.'),weekLabel,message);
  const schedule = element('form',null,'game-panel'), scheduleTitle = element('h3','Programação da semana');
  const dateLabel = element('label','Data do jogo'), gameDate = element('input'); gameDate.type = 'date'; gameDate.required = true; dateLabel.append(gameDate);
  const teamChecks = element('div',null,'game-match-editor');
  const addMatch = element('button','Deseja adicionar outro confronto?','row-action'); addMatch.type = 'button';
  const statusLabel = element('label','Envio de escalações'), status = element('select');
  for (const [value,label] of [['open','Aberto até o prazo'],['closed','Fechado para diretores']]) { const option = element('option',label); option.value = value; status.append(option); } statusLabel.append(status);
  const noteLabel = element('label','Observações públicas da rodada'), notes = element('textarea'); notes.maxLength = 500; noteLabel.append(notes);
  const deadlineHint = element('p'), scheduleError = element('p',null,'form-error'), saveWeek = element('button','Salvar programação','primary'); saveWeek.type = 'submit'; scheduleError.setAttribute('role','alert');
  schedule.append(scheduleTitle,dateLabel,teamChecks,addMatch,statusLabel,noteLabel,deadlineHint,scheduleError,saveWeek); adminPage.append(schedule);
  const launch = element('div',null,'game-panel'), ownFixture = element('p'), start = element('button','Montar minha escalação','primary'); start.type = 'button'; launch.append(ownFixture,start); page.append(launch);
  const editor = element('div',null,'game-panel'), chooseLabel = element('label','Time da escalação'), choose = element('select'); chooseLabel.append(choose);
  const pasteLabel = element('label','Cole a lista do TXT: um jogador por linha. Cabeçalhos, emojis e posições serão retirados; confira os nomes antes de enviar.'), raw = element('textarea'); raw.rows = 8; raw.maxLength = 12000; raw.placeholder = 'BRANCO X COYOTES\nCAMPO SANTA CRUZ\nGOL Felipe ✅\nZAG João Silva ✅\nGabriel'; pasteLabel.append(raw);
  const modeLabel = element('label','Como montar a escalação?'), mode = element('select');
  for (const [value,text] of [['roster','Escolher jogadores da lista do time'],['txt','Colar uma lista TXT']]) { const option = element('option',text); option.value = value; mode.append(option); } modeLabel.append(mode);
  const rosterPicker = element('fieldset');
  const searchLabel = element('label','Buscar jogador do elenco'), rosterSearch = element('input'); rosterSearch.type = 'search'; rosterSearch.placeholder = 'Nome ou congregação'; searchLabel.append(rosterSearch);
  const selectedCount = element('p',null,'game-selected-count'); selectedCount.setAttribute('role','status');
  const steps = element('ol',null,'game-steps'); for (const text of ['Escolher jogadores','Conferir pendências','Publicar']) steps.append(element('li',text));
  const reviewSummary = element('p',null,'notice'), finalPreview = element('div'), back = element('button','Voltar','row-action'), actionBar = element('div',null,'game-action-bar'); back.type = 'button';
  const loadCurrent = element('button','Usar última escalação enviada','row-action'), results = element('div'), feedback = element('p'), publish = element('button','Enviar escalação conferida','primary'); feedback.setAttribute('role','status');
  const ackLabel = element('label',null,'duplicate-ack'), ack = element('input'); ack.type = 'checkbox'; ackLabel.append(ack,element('span','Confirmo a publicação da escalação. Os nomes e as pendências ficarão visíveis a todos, mesmo sem login.'));
  actionBar.append(back,publish);
  editor.append(element('h3','Montar escalação'),steps,chooseLabel,modeLabel,searchLabel,selectedCount,rosterPicker,pasteLabel,loadCurrent,reviewSummary,results,finalPreview,ackLabel,feedback,actionBar); page.append(editor);
  const official = element('div',null,'game-panel'); page.append(official); document.querySelector('footer').before(page);
  let sdk = null, db = null, stops = [], generation = 0, session = '', week = null, squads = [], entries = [], ready = false, rows = [], dirty = false, programSource, busy = false, submitError = '';
  let matchDraft = [['','']];
  let matchInfo = [{time:'',field:''}];
  let step = 1, opened = false;
  const demoWeeks = {}, demoSquads = {}, demoEntries = {};
  try { const saved = JSON.parse(localStorage.getItem('recreacao-games-demo') || '{}'); Object.assign(demoWeeks,saved.weeks); Object.assign(demoSquads,saved.squads); Object.assign(demoEntries,saved.entries); } catch {}
  const selectedWeek = () => weekStart(reference.value || localDay());
  const admin = () => getProfile()?.role === 'admin';
  const nameOf = id => getUserId() && ['admin','director'].includes(getProfile()?.role) ? getTeams()[id]?.name || week?.teamNames?.[id] || id : week?.teamNames?.[id] || getTeams()[id]?.name || id;
  function clearDraft() { rows = []; results.replaceChildren(); ack.checked = false; raw.value = ''; rosterSearch.value = ''; feedback.textContent = ''; submitError = ''; step = 1; opened = false; }
  function stop() { generation++; stops.forEach(fn => fn()); stops = []; }
  function watch() {
    stop(); week = null; squads = []; entries = []; ready = false; programSource = undefined; dirty = false; clearDraft();
    if (demo) { week = demoWeeks[selectedWeek()] || null; squads = Object.values(demoSquads).filter(s => s.weekId === selectedWeek()); entries = Object.values(demoEntries).filter(e => e.weekId === selectedWeek()); ready = true; render(); return; }
    if (!sdk) { render(); return; }
    const version = generation, id = selectedWeek(); let loaded = 0, entryVersion = 0, entryStops = [], entriesLoaded = false;
    stops.push(() => { entryVersion++; entryStops.forEach(fn => fn()); });
    const listen = (ref,callback) => { let first = true; stops.push(sdk.onSnapshot(ref,snap => { if (version !== generation) return; callback(snap); if (first) { loaded++; first = false; } ready = loaded === 2 && entriesLoaded; render(); },error => { if (version !== generation) return; ready = false; message.textContent = 'Não foi possível carregar a rodada: '+error.message; })); };
    listen(sdk.doc(db,'gameWeeks',id),s => { week = s.data() || null; });
    listen(sdk.query(sdk.collection(db,'gameSquads'),sdk.where('weekId','==',id)),s => {
      squads = s.docs.map(d => ({...d.data(),id:d.id})); entryVersion++; const current = entryVersion;
      entryStops.forEach(fn => fn()); entryStops = []; entriesLoaded = squads.length === 0; entries = []; const buckets = new Map();
      for (const squad of squads) entryStops.push(sdk.onSnapshot(sdk.query(sdk.collection(db,'gameEntries'),sdk.where('weekId','==',id),sdk.where('teamId','==',squad.teamId),sdk.where('draftId','==',squad.draftId)),snap => {
        if (version !== generation || current !== entryVersion) return;
        buckets.set(squad.id,snap.docs.map(d => ({...d.data(),id:d.id}))); entries = [...buckets.values()].flat(); entriesLoaded = buckets.size === squads.length; ready = loaded === 2 && entriesLoaded; render();
      },error => { if (version !== generation || current !== entryVersion) return; ready = false; message.textContent = 'Não foi possível carregar a escalação: '+error.message; }));
    });
    render();
  }
  reference.onchange = () => { if (busy) return; try { watch(); } catch(error) { message.textContent = error.message; } };
  adminReference.onchange = () => { reference.value = adminReference.value; reference.onchange(); };
  start.onclick = () => { opened = true; if (!rows.length && squads.some(s => s.teamId === choose.value)) loadPublished(); else render(); editor.scrollIntoView({behavior:'smooth',block:'start'}); };
  back.onclick = () => { if (busy) return; step = Math.max(1,step-1); ack.checked = false; render(); };
  rosterSearch.oninput = () => renderRoster();
  schedule.oninput = () => { dirty = true; updateDeadline(); };
  function renderMatches() {
    teamChecks.replaceChildren();
    const used = new Set(matchDraft.flat().filter(Boolean));
    matchDraft.forEach((pair,index) => {
      const card = element('fieldset',null,'game-match'); card.append(element('legend',`Confronto ${index+1}`));
      pair.forEach((id,side) => {
        const label = element('label',side ? 'Adversário' : 'Time'), select = element('select');
        const empty = element('option','Selecione um time'); empty.value = ''; select.append(empty);
        for (const [key,team] of Object.entries(getTeams())) if ((team.status === 'active' && !used.has(key)) || key === id) {
          const option = element('option',`${team.badge} ${team.name}${team.status !== 'active' ? ' (indisponível)' : ''}`); option.value = key; select.append(option);
        }
        select.value = id; select.onchange = () => { pair[side] = select.value; dirty = true; scheduleError.textContent = ''; renderMatches(); }; label.append(select); card.append(label);
      });
      const info = matchInfo[index];
      const timeLabel = element('label','Horário (Brasília)'), time = element('input'); time.type = 'time'; time.value = info.time;
      time.oninput = () => { info.time = time.value; dirty = true; }; timeLabel.append(time);
      const fieldLabel = element('label','Campo / local'), field = element('input'); field.type = 'text'; field.maxLength = 120; field.value = info.field; field.placeholder = 'Ex.: Campo Santa Cruz';
      field.oninput = () => { info.field = field.value; dirty = true; }; fieldLabel.append(field);
      card.append(timeLabel,fieldLabel,element('p','Horário e campo são opcionais. Se estiverem vazios, aparecerão como “a definir”.','game-match-hint'));
      const remove = element('button','Excluir confronto','row-action'); remove.type = 'button';
      remove.onclick = () => { matchDraft.splice(index,1); matchInfo.splice(index,1); dirty = true; renderMatches(); toast('Confronto retirado. Clique em Salvar programação para confirmar a exclusão, inclusive das escalações publicadas.'); };
      card.append(remove); teamChecks.append(card);
    });
    if (!matchDraft.length) teamChecks.append(element('p','Nenhum confronto. Salve para excluir os jogos da semana e retirar suas escalações da consulta pública.'));
    const remaining = Object.entries(getTeams()).filter(([id,team]) => team.status === 'active' && !used.has(id)).length;
    addMatch.disabled = busy || matchDraft.some(pair => pair.some(id => !id)) || remaining < 2;
  }
  addMatch.onclick = () => { matchDraft.push(['','']); matchInfo.push({time:'',field:''}); dirty = true; renderMatches(); teamChecks.lastElementChild?.querySelector('select')?.focus(); };
  function updateDeadline() { try { deadlineHint.textContent = `Diretores podem enviar até quinta-feira ${weekDeadline(gameDate.value).cutoff}, às 23h59 (Brasília).`; } catch { deadlineHint.textContent = ''; } }
  schedule.onsubmit = async event => {
    event.preventDefault(); saveWeek.disabled = true; scheduleError.textContent = '';
    try {
      const data = {gameDate:gameDate.value,status:status.value,notes:notes.value,teams:matchDraft.flat(),matchTimes:matchInfo.map(info => info.time),matchFields:matchInfo.map(info => info.field)};
      if (!data.teams.length) data.status = 'closed';
      if (weekStart(data.gameDate) !== selectedWeek()) throw Error('A data do jogo precisa pertencer à semana selecionada.');
      if (demo) {
        const details = gameWeekDetails(data,getTeams()); details.teamNames = Object.fromEntries(details.teams.map(id => [id,nameOf(id)]));
        for (const teamId of week?.teams || []) if (!details.teams.includes(teamId)) delete demoSquads[`${details.weekId}_${teamId}`];
        demoWeeks[details.weekId] = details; week = details; squads = Object.values(demoSquads).filter(s => s.weekId === details.weekId); persist();
      }
      else await mutate('saveGameWeek',data);
      dirty = false; toast('Programação da semana salva.'); render();
    } catch(error) { scheduleError.textContent = error.message; }
    finally { saveWeek.disabled = false; }
  };
  choose.onchange = () => { clearDraft(); opened = true; if (squads.some(s => s.teamId === choose.value)) loadPublished(); else render(); };
  mode.onchange = () => {
    step = 1; opened = true; ack.checked = false; submitError = '';
    if (mode.value === 'txt' && rows.length) raw.value = rows.filter(row => !row.ignored).map(row => row.name).join('\n');
    render();
  };
  raw.oninput = () => { rows = []; submitError = ''; results.replaceChildren(); ack.checked = false; validate(); };
  function removalButton(row) {
    const button = element('button',row.ignored ? 'Restaurar na escalação' : 'Remover da escalação','row-action game-remove-player'); button.type = 'button'; button.disabled = busy;
    button.setAttribute('aria-label',`${row.ignored ? 'Restaurar' : 'Remover'} ${row.name} ${row.ignored ? 'na' : 'da'} escalação`);
    button.onclick = () => { row.ignored = !row.ignored; ack.checked = false; submitError = ''; renderRoster(); renderRows(); };
    return button;
  }
  function renderRows() {
    results.replaceChildren(); ack.checked = false; submitError = '';
    const roster = getPlayers().filter(p => isActivePlayer(p) && p.teams.includes(choose.value));
    rows.forEach((row,index) => {
      const issue = gameEntryIssue(getPlayers().find(p => p.id === row.selectedId),choose.value);
      const confirmed = !row.ignored && issue === 'ok';
      const wrapper = element('div',null,'duplicate-card'), card = element(confirmed ? 'details' : 'div');
      card.append(element(confirmed ? 'summary' : 'strong',`${row.ignored ? 'Retirado · ' : confirmed ? '✅ ' : ''}${index+1}. ${row.raw}${confirmed ? ' · confirmado (clique para alterar)' : ''}`));
      const question = element('label',`“${row.name}” na lista corresponde a qual jogador cadastrado no time?`), select = element('select');
      const empty = element('option','Publicar este nome com aviso de vínculo não confirmado'); empty.value = ''; select.append(empty);
      const candidates = [...row.candidates,...roster.filter(p => !row.candidates.some(c => c.id === p.id))];
      for (const player of candidates) { const option = element('option',`${playerName(player.name)} · ${player.congregation}`); option.value = player.id; select.append(option); }
      if (row.selectedId && !candidates.some(p => p.id === row.selectedId)) { const current = getPlayers().find(p => p.id === row.selectedId), option = element('option',current ? `${playerName(current.name)} · vínculo irregular` : row.name+' · cadastro alterado'); option.value = row.selectedId; select.append(option); }
      select.value = row.selectedId; select.onchange = () => { row.selectedId = select.value; ack.checked = false; renderRows(); }; question.append(select); card.append(question);
      if (!row.ignored && issue !== 'ok') card.append(element('p',`⚠ ${GAME_ISSUES[issue]}. A escalação pode ser enviada e este aviso ficará público.`,'game-warning'));
      if (!row.candidates.length && issue !== 'ok') card.append(element('p','Nenhum nome parecido neste time. Confira o cadastro; não será feita uma nova inscrição automaticamente.'));
      if (row.outside.length) card.append(element('p',`Também encontrado fora da relação ativa deste time: ${row.outside.map(p => `${playerName(p.name)} (${p.congregation} · ${p.teams.map(nameOf).join(', ')})`).join('; ')}.`));
      const ignoreLabel = element('label',null,'duplicate-ack'), ignore = element('input'); ignore.type = 'checkbox'; ignore.checked = row.ignored;
      select.disabled = row.ignored;
      ignore.onchange = () => { row.ignored = ignore.checked; renderRoster(); renderRows(); }; ignoreLabel.append(ignore,element('span','Ignorar esta linha (cabeçalho ou pessoa que não vai jogar).')); card.append(ignoreLabel);
      wrapper.append(card,removalButton(row)); results.append(wrapper);
    }); validate();
  }
  function validate() {
    let error = '';
    let warningCount = 0;
    try { if (!ready) throw Error('Aguarde o carregamento da rodada.'); if (!canSubmitSquad(getProfile(),week,choose.value,getTeams())) throw Error('Envio indisponível para este time ou fora do prazo. Após quinta-feira, peça ao admin para corrigir.'); const selected = gameListEntries(rows); warningCount = selected.filter(entry => gameEntryIssue(getPlayers().find(p => p.id === entry.playerId),choose.value) !== 'ok').length; } catch(e) { error = e.message; }
    const permitted = ready && canSubmitSquad(getProfile(),week,choose.value,getTeams());
    publish.disabled = busy || !permitted || (step === 1 && mode.value === 'txt' ? !raw.value.trim() : !!error) || (step === 3 && !ack.checked);
    if (!busy) feedback.textContent = submitError || (step === 1 && permitted ? 'Selecione os jogadores ou cole a lista para conferir.' : error) || (warningCount ? `${warningCount} pendência(s). Você pode publicar; os avisos ficarão visíveis para todos.` : 'Nomes conferidos. Avance para publicar.');
    renderStage();
  }
  function renderRoster() {
    rosterPicker.replaceChildren(element('legend','Marque os jogadores que vão jogar'));
    const choices = rosterChoices(getPlayers(),choose.value,rows,rosterSearch.value);
    for (const player of choices) {
      const label = element('label',null,'duplicate-ack'), check = element('input'); check.type = 'checkbox'; check.value = player.id; check.checked = rows.some(row => row.selectedId === player.id && !row.ignored); check.disabled = busy;
      check.onchange = () => {
        rows = rows.filter(row => row.selectedId !== player.id);
        if (check.checked) rows.push({raw:player.name,name:player.name,selectedId:player.id,candidates:[player],outside:[],ignored:false});
        ack.checked = false; submitError = ''; renderRoster(); validate();
      };
      label.append(check,element('span',`${playerName(player.name)} · ${player.congregation}`));
      const choice = element('div',null,'game-roster-choice'); choice.append(label);
      if (check.checked) choice.append(removalButton(rows.find(row => row.selectedId === player.id && !row.ignored)));
      rosterPicker.append(choice);
    }
    if (!choices.length) rosterPicker.append(element('p','Nenhum jogador encontrado. Ajuste a busca ou use a opção TXT.'));
  }
  function renderStage() {
    const summary = gameReviewSummary(rows,getPlayers(),choose.value);
    [...steps.children].forEach((item,index) => { item.classList.toggle('active',index+1 === step); if (index+1 === step) item.setAttribute('aria-current','step'); else item.removeAttribute('aria-current'); });
    modeLabel.hidden = step !== 1; chooseLabel.hidden = !admin() || step !== 1;
    searchLabel.hidden = rosterPicker.hidden = step !== 1 || mode.value !== 'roster';
    pasteLabel.hidden = step !== 1 || mode.value !== 'txt';
    results.hidden = step !== 2; reviewSummary.hidden = step === 1; finalPreview.hidden = ackLabel.hidden = step !== 3;
    selectedCount.textContent = `${summary.included} ${summary.included === 1 ? 'jogador selecionado' : 'jogadores selecionados'}`;
    reviewSummary.textContent = `${summary.found} ${summary.found === 1 ? 'nome encontrado' : 'nomes encontrados'} · ${summary.confirmed} ${summary.confirmed === 1 ? 'confirmado' : 'confirmados'} · ${summary.pending} para conferir${summary.ignored ? ' · '+summary.ignored+' ignorados' : ''}`;
    loadCurrent.hidden = step !== 1; back.hidden = step === 1; back.disabled = busy; rosterSearch.disabled = busy;
    publish.textContent = busy ? 'Publicando…' : step === 1 ? 'Conferir lista' : step === 2 ? 'Revisar publicação' : `Publicar ${summary.included} ${summary.included === 1 ? 'jogador' : 'jogadores'}`;
    if (step === 3) {
      finalPreview.replaceChildren(element('h4','Confira a escalação que ficará pública'));
      const list = element('ol');
      for (const row of rows.filter(row => !row.ignored)) {
        const player = getPlayers().find(p => p.id === row.selectedId), issue = gameEntryIssue(player,choose.value);
        const item = element('li',playerName(player?.name || row.name));
        if (issue !== 'ok') { item.className = 'game-warning'; item.append(element('strong',`⚠ ${GAME_ISSUES[issue]}`)); }
        item.append(removalButton(row));
        list.append(item);
      }
      finalPreview.append(list);
    }
  }
  ack.onchange = validate;
  function loadPublished(review = false) {
    const squad = squads.find(s => s.teamId === choose.value);
    mode.value = review ? 'txt' : 'roster'; const current = entries.filter(e => e.teamId === choose.value && e.draftId === squad?.draftId).sort((a,b) => (a.position||0)-(b.position||0));
    raw.value = current.map(e => e.rawName || e.name).join('\n');
    rows = current.map(entry => ({raw:entry.rawName || entry.name,name:entry.rawName || entry.name,selectedId:entry.playerId || '',candidates:[],outside:[],ignored:false})); opened = true; step = review ? 2 : 1; renderRows(); render();
  }
  loadCurrent.onclick = () => loadPublished();
  publish.onclick = async () => {
    if (busy) return;
    if (step < 3) {
      try {
        if (step === 1 && mode.value === 'txt' && !rows.length) rows = compareGameList(raw.value,getPlayers(),choose.value);
        gameListEntries(rows);
        if (!ready || !canSubmitSquad(getProfile(),week,choose.value,getTeams())) throw Error('Envio indisponível para este time ou fora do prazo.');
        step++; ack.checked = false; renderRows(); render(); steps.scrollIntoView({behavior:'smooth',block:'start'});
      } catch(error) { feedback.textContent = error.message; toast(error.message); }
      return;
    }
    if (!ack.checked || busy) return;
    try {
      const selected = gameListEntries(rows), data = {weekId:selectedWeek(),teamId:choose.value,entries:selected,onProgress:(done,total) => { feedback.textContent = `Salvando ${done} de ${total} nomes…`; }};
      if (!canSubmitSquad(getProfile(),week,choose.value,getTeams())) throw Error('O prazo ou a programação mudou. Confira antes de enviar.');
      busy = true; submitError = ''; render();
      if (demo) {
        const draftId = crypto.randomUUID(), squadId = `${data.weekId}_${data.teamId}`;
        demoSquads[squadId] = {...data,draftId,updatedAt:Date.now()}; delete demoSquads[squadId].onProgress;
        selected.forEach((entry,position) => { const p = getPlayers().find(p => p.id === entry.playerId); demoEntries[`${draftId}_${position}`] = {weekId:data.weekId,teamId:data.teamId,draftId,position,rawName:entry.rawName,playerId:p ? entry.playerId : '',name:p?.name || entry.rawName,issue:gameEntryIssue(p,data.teamId)}; });
        squads = Object.values(demoSquads).filter(s => s.weekId === selectedWeek()); entries = Object.values(demoEntries).filter(e => e.weekId === selectedWeek()); persist();
      } else await mutate('submitGameSquad',data);
      toast('Escalação publicada. Pendências ficam sinalizadas para todos.'); clearDraft();
    } catch(error) { submitError = error.message; feedback.textContent = error.message; toast(error.message); }
    finally { busy = false; render(); }
  };
  function persist() { localStorage.setItem('recreacao-games-demo',JSON.stringify({weeks:demoWeeks,squads:demoSquads,entries:demoEntries})); }
  function render() {
    const profile = getProfile(), authorized = ['admin','director'].includes(profile?.role);
    const issueOf = (entry,id) => authorized && getPlayers().length ? gameEntryIssue(getPlayers().find(p => p.id === entry.playerId),id) : entry.issue || 'ok';
    adminLink.hidden = !admin(); adminRestriction.hidden = admin(); adminWeekLabel.hidden = schedule.hidden = !admin();
    adminReference.value = reference.value; adminReference.disabled = busy;
    const eligible = authorized && week && (admin() || week.teams.includes(profile?.team));
    launch.hidden = !eligible; editor.hidden = !eligible || !opened;
    message.textContent = !ready ? 'Carregando programação e escalações públicas…' : !week ? `Semana ${selectedWeek()}: o administrador ainda não definiu os times que vão jogar.` : `Jogo: ${week.gameDate} · Envio até quinta-feira ${week.cutoff}, às 23h59 · ${week.status === 'open' ? 'Envio aberto até o prazo' : 'Fechado para diretores'}${week.notes ? ' · '+week.notes : ''}`;
    const oldSelection = choose.value;
    const permitted = (week?.teams || []).filter(id => admin() || id === profile?.team);
    choose.replaceChildren();
    for (const id of permitted) { const option = element('option',nameOf(id)); option.value = id; choose.append(option); }
    if (permitted.includes(oldSelection)) choose.value = oldSelection;
    if (oldSelection && choose.value !== oldSelection) clearDraft();
    editor.hidden = !eligible || !opened;
    const ownIndex = week?.teams.indexOf(choose.value) ?? -1, opponent = ownIndex >= 0 ? week.teams[ownIndex % 2 ? ownIndex-1 : ownIndex+1] : '';
    ownFixture.textContent = ownIndex >= 0 ? `${nameOf(choose.value)} × ${opponent ? nameOf(opponent) : 'adversário a definir'}` : '';
    start.textContent = opened ? 'Continuar minha escalação' : squads.some(s => s.teamId === choose.value) ? 'Editar minha escalação' : 'Montar minha escalação';
    start.disabled = busy || !ready || !canSubmitSquad(profile,week,choose.value,getTeams());
    renderRoster();
    if (admin()) {
      if (!dirty && programSource !== week) {
        const ids = week?.teams || []; matchDraft = [];
        for (let i=0;i<ids.length;i+=2) matchDraft.push([ids[i],ids[i+1] || '']);
        if (!matchDraft.length && !week) matchDraft.push(['','']);
        matchInfo = matchDraft.map((_,index) => ({time:week?.matchTimes?.[index] || '',field:week?.matchFields?.[index] || ''}));
        const saturday = dateValue(selectedWeek()); saturday.setUTCDate(saturday.getUTCDate()+5);
        gameDate.value = week?.gameDate || saturday.toISOString().slice(0,10); status.value = week?.status || 'open'; notes.value = week?.notes || ''; programSource = week;
      }
      if (!gameDate.value) { const saturday = dateValue(selectedWeek()); saturday.setUTCDate(saturday.getUTCDate()+5); gameDate.value = saturday.toISOString().slice(0,10); }
      updateDeadline();
      renderMatches();
    }
    reference.disabled = busy; choose.disabled = busy; mode.disabled = busy; raw.disabled = busy; ack.disabled = busy;
    loadCurrent.disabled = busy || !ready || !squads.some(s => s.teamId === choose.value);
    results.inert = busy; schedule.inert = busy;
    official.replaceChildren(element('h3','Escalações da semana'));
    if (ready && week && !week.teams.length) official.append(element('p','Nenhum jogo programado nesta semana.'));
    if (ready && week?.teams.length) {
      const summary = roundSummary(week,squads), panel = element('div',null,'game-round-summary');
      panel.append(element('h4','Resumo da rodada'),element('p',`${summary.submitted.length} de ${week.teams.length} times enviaram · ${summary.pending.length} pendente(s)`));
      for (const [label,ids] of [['✅ Enviaram',summary.submitted],['⏳ Ainda não enviaram',summary.pending]]) {
        panel.append(element('strong',label),element('p',ids.length ? ids.map(nameOf).join(' · ') : 'Nenhum time'));
      }
      panel.append(element('p','Enviada indica que a escalação foi publicada. Confira os avisos de cadastro nos confrontos.')); official.append(panel);
    }
    let matchCard;
    if (ready) for (const [teamIndex,id] of (week?.teams || []).entries()) {
      if (teamIndex % 2 === 0) {
        const opponent = week.teams[teamIndex+1];
        matchCard = element('section',null,'game-fixture');
        matchCard.append(element('h4',opponent ? `${nameOf(id)} × ${nameOf(opponent)}` : `${nameOf(id)} · escolha o adversário na programação`));
        const matchIndex = teamIndex/2;
        matchCard.append(element('p',`Horário: ${week.matchTimes?.[matchIndex] ? week.matchTimes[matchIndex]+' (Brasília)' : 'a definir'} · Campo: ${week.matchFields?.[matchIndex] || 'a definir'}`,'game-fixture-info'));
        const share = element('div',null,'game-fixture-share'), copy = element('button','Copiar confronto para WhatsApp','row-action'), copyStatus = element('p'); copy.type = 'button'; copyStatus.setAttribute('role','status');
        const fallbackLabel = element('label','Copie este texto e cole no WhatsApp'), fallback = element('textarea'); fallback.readOnly = true; fallback.rows = 10; fallbackLabel.append(fallback); fallbackLabel.hidden = true;
        copy.onclick = async () => {
          const text = fixtureText(week,matchIndex,squads,entries,nameOf,issueOf);
          try { await navigator.clipboard.writeText(text); copyStatus.textContent = 'Confronto copiado! Cole na conversa do WhatsApp.'; fallbackLabel.hidden = true; }
          catch { fallback.value = text; fallbackLabel.hidden = false; fallback.focus(); fallback.select(); copyStatus.textContent = 'A cópia automática não está disponível. Selecione e copie o texto abaixo.'; }
        };
        share.append(copy,copyStatus,fallbackLabel); matchCard.append(share);
        official.append(matchCard);
      }
      const card = element('div',null,'duplicate-card'), squad = squads.find(s => s.teamId === id), lineup = entries.filter(e => e.teamId === id && e.draftId === squad?.draftId).sort((a,b) => (a.position ?? 0)-(b.position ?? 0));
      card.append(element('h4',`${nameOf(id)} · ${squad ? lineup.length+' jogadores' : 'aguardando escalação'}`));
      const list = element('ol');
      let warnings = 0;
      for (const [index,entry] of lineup.entries()) {
        const issue = issueOf(entry,id);
        const item = element('li'); item.append(element('span',playerName(entry.name)));
        if (issue !== 'ok') {
          warnings++; item.className = 'game-warning'; item.append(element('strong',` ⚠ ${GAME_ISSUES[issue] || GAME_ISSUES.unknown}`));
          if (authorized && canSubmitSquad(profile,week,id,getTeams())) {
            const fix = element('button','Ajustar: escolher jogador do time','row-action');
            fix.disabled = busy;
            fix.onclick = () => { choose.value = id; loadPublished(true); const select = results.children[index]?.querySelector('select'); results.children[index]?.scrollIntoView({behavior:'smooth',block:'center'}); select?.focus(); };
            item.append(fix);
          }
        }
        list.append(item);
      }
      if (warnings) card.append(element('p',`⚠ Esta escalação tem ${warnings} pendência(s) de cadastro ou vínculo. Não considere esses nomes como confirmados no time.`,'game-warning'));
      card.append(list); if (squad && !lineup.length) card.append(element('p','Nenhum jogador disponível nesta versão. Confira a conexão e reenvie a lista.')); matchCard.append(card);
    }
    validate();
  }
  const timer = setInterval(() => { if (!page.hidden) validate(); },30000);
  return {
    connect(nextSdk,nextDb) { sdk = nextSdk; db = nextDb; session = ''; this.refresh(); },
    refresh() {
      const key = `${getUserId() || ''}:${getProfile()?.role || ''}:${getProfile()?.team || ''}`;
      if (session !== key) { session = key; watch(); } else render();
    },
    dispose() { stop(); clearInterval(timer); }
  };
}
