import {identity} from './domain.js';
export const HISTORY_ACTIONS = {add:'Inscrição',transfer:'Transferência',edit:'Edição de jogador',status:'Situação do jogador',merge:'Unificação de cadastros',duplicateReview:'Revisão de duplicidade',team:'Gerenciamento de time',window:'Janela de transferências',legacy:'Registro antigo'};
const clean = text => identity(String(text || ''),'').slice(0,-1);
export function eventTime(event) {
  const value = event.at?.toMillis?.() ?? (event.at instanceof Date ? event.at.getTime() : typeof event.at === 'object' && event.at ? event.at.seconds * 1000 : event.at);
  return typeof value === 'number' ? value : Date.parse(value);
}
export function eventTeamIds(event,players = []) {
  const ids = [event.from,event.to,event.teamId,...(event.teams || []),...(event.sourceTeams || []),...(event.targetTeams || [])].filter(Boolean);
  if (ids.length || !['edit','status','duplicateReview'].includes(event.kind)) return [...new Set(ids)];
  // Registros antigos não guardavam os times: use o vínculo atual, inclusive após correções de nome.
  for (const id of [event.playerId,event.sourceId,event.targetId,...(event.kind === 'duplicateReview' ? String(event.reviewId || '').split('_') : [])].filter(Boolean)) {
    let player = players.find(p => p.id === id); const visited = new Set();
    while (player?.mergedInto && !visited.has(player.id)) { visited.add(player.id); player = players.find(p => p.id === player.mergedInto); }
    ids.push(...(player?.teams || []));
  }
  return [...new Set(ids)];
}
export function filterHistory(logs,filters,players = [],teams = {}) {
  if (filters.from && filters.to && filters.from > filters.to) throw Error('A data inicial deve ser anterior ou igual à data final.');
  const query = clean(filters.player), start = filters.from ? Date.parse(`${filters.from}T00:00:00-03:00`) : -Infinity;
  const end = filters.to ? Date.parse(`${filters.to}T00:00:00-03:00`) + 86400000 : Infinity;
  return logs.filter(event => {
    if (filters.action && (event.kind || 'legacy') !== filters.action) return false;
    if (filters.team && !eventTeamIds(event,players).includes(filters.team)) {
      // Registros de demonstração antigos só possuíam o texto da movimentação.
      if (event.kind || !clean(event.detail).includes(clean(teams[filters.team]?.name || filters.team))) return false;
    }
    const names = [event.name,event.sourceName,event.previousName,...(event.kind === 'duplicateReview' ? [event.detail] : [])];
    for (const id of [event.playerId,event.sourceId,event.targetId,...(event.kind === 'duplicateReview' ? String(event.reviewId || '').split('_') : [])].filter(Boolean)) {
      let player = players.find(p => p.id === id); const visited = new Set();
      while (player?.mergedInto && !visited.has(player.id)) { visited.add(player.id); player = players.find(p => p.id === player.mergedInto); }
      if (player) names.push(player.name);
    }
    if (query && (['team','window'].includes(event.kind) || !clean(names.filter(Boolean).join(' ')).includes(query))) return false;
    const time = eventTime(event);
    if ((filters.from || filters.to) && (!Number.isFinite(time) || time < start || time >= end)) return false;
    return true;
  }).sort((a,b) => (eventTime(b) || 0)-(eventTime(a) || 0));
}
export function setupHistory({element,getLogs,getTeams,getPlayers,loadMore,canLoadMore,isLoading,canRead}) {
  const list = document.querySelector('#history-list'), section = list.closest('section');
  const controls = element('form',null,'history-filters'); controls.setAttribute('aria-label','Filtros de movimentações');
  const inputs = {};
  for (const [key,label,type] of [['player','Jogador','search'],['team','Time','select'],['action','Tipo de ação','select'],['from','De','date'],['to','Até','date']]) {
    const field = element('label',label), input = element(type === 'select' ? 'select' : 'input');
    if (type !== 'select') input.type = type;
    input.name = key; if (key === 'player') input.placeholder = 'Nome atual ou anterior';
    inputs[key] = input; field.append(input); controls.append(field);
    input.addEventListener(type === 'search' ? 'input' : 'change',render);
  }
  const any = element('option','Todas as ações'); any.value = ''; inputs.action.append(any);
  for (const [value,label] of Object.entries(HISTORY_ACTIONS)) { const option = element('option',label); option.value = value; inputs.action.append(option); }
  const clear = element('button','Limpar filtros','row-action'); clear.type = 'reset'; controls.append(clear);
  controls.onsubmit = event => event.preventDefault(); controls.onreset = () => queueMicrotask(render);
  const feedback = element('p'); feedback.setAttribute('role','status');
  const help = element('p','As datas usam o horário de Brasília. Em registros antigos de edição/situação sem times salvos, o filtro considera o vínculo atual do jogador.','history-help');
  list.before(controls,feedback,help);
  const more = element('button','Carregar mais movimentações','row-action'); section.append(more);
  more.onclick = () => loadMore();
  function render() {
    const selected = inputs.team.value; inputs.team.replaceChildren();
    const all = element('option','Todos os times'); all.value = ''; inputs.team.append(all);
    const teamEntries = new Map(Object.entries(getTeams()).map(([id,t]) => [id,t.name + (t.status === 'active' ? '' : ' · inativo/excluído')]));
    for (const event of getLogs()) for (const id of eventTeamIds(event,getPlayers())) if (!teamEntries.has(id)) teamEntries.set(id,id);
    for (const [id,name] of teamEntries) { const option = element('option',name); option.value = id; inputs.team.append(option); }
    if (teamEntries.has(selected)) inputs.team.value = selected;
    const filters = Object.fromEntries(Object.entries(inputs).map(([key,input]) => [key,input.value]));
    feedback.className = ''; list.replaceChildren();
    let matches = [];
    try { matches = filterHistory(getLogs(),filters,getPlayers(),getTeams()); feedback.textContent = `${matches.length} de ${getLogs().length} movimentações carregadas${canLoadMore() ? ' · há registros mais antigos' : ''}.`; }
    catch(e) { feedback.textContent = e.message; feedback.className = 'form-error'; }
    for (const event of matches) {
      const item = element('div',null,'history-item'), time = eventTime(event);
      item.append(element('strong',event.name),element('span',HISTORY_ACTIONS[event.kind || 'legacy'] || event.kind,'history-kind'),element('div',event.detail),element('small',Number.isFinite(time) ? new Date(time).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) + ' · Brasília' : 'Data indisponível')); list.append(item);
    }
    if (!matches.length) list.append(element('p',canRead() ? 'Nenhuma movimentação encontrada. Ajuste os filtros ou carregue registros mais antigos.' : 'Entre com uma conta autorizada para consultar as movimentações.'));
    more.hidden = !canRead() || !canLoadMore(); more.disabled = isLoading(); more.textContent = isLoading() ? 'Carregando…' : 'Carregar mais movimentações';
  }
  return {refresh:render};
}
