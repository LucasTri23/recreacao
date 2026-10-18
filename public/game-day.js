import {identity,similarity,isActivePlayer} from './domain.js';
const clean = value => identity(value,'').slice(0,-1);
export function localDay(now = new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function dateValue(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) throw Error('Informe uma data válida.');
  const date = new Date(day+'T12:00:00Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0,10) !== day) throw Error('Informe uma data válida.');
  return date;
}
export function weekStart(day) { const date = dateValue(day); date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7)); return date.toISOString().slice(0,10); }
export function weekDeadline(gameDate) {
  const thursday = dateValue(weekStart(gameDate)); thursday.setUTCDate(thursday.getUTCDate()+3);
  if (thursday.toISOString().slice(0,10) > gameDate) thursday.setUTCDate(thursday.getUTCDate()-7);
  const cutoff = thursday.toISOString().slice(0,10);
  return {cutoff,deadline:Date.parse(cutoff+'T00:00:00-03:00')+86400000};
}
export function gameWeekDetails(data,teams) {
  dateValue(data.gameDate);
  if (!Array.isArray(data.teams)) throw Error('Escolha os times da semana.');
  const ids = [...data.teams];
  if (ids.length < 2 || ids.length > 100 || ids.length % 2) throw Error('Cada confronto precisa de dois times. Complete ou remova o confronto incompleto.');
  if (new Set(ids).size !== ids.length) throw Error('Um time não pode participar de mais de um confronto na mesma rodada.');
  if (!ids.every(id => Object.hasOwn(teams,id) && teams[id].status === 'active')) throw Error('Escolha apenas times ativos para os confrontos.');
  if (!['open','closed'].includes(data.status)) throw Error('Situação da semana inválida.');
  const notes = String(data.notes || '').trim(); if (notes.length > 500) throw Error('As observações devem ter até 500 caracteres.');
  const count = ids.length/2;
  const matchTimes = data.matchTimes ?? Array(count).fill(''), matchFields = data.matchFields ?? Array(count).fill('');
  if (!Array.isArray(matchTimes) || !Array.isArray(matchFields) || matchTimes.length !== count || matchFields.length !== count) throw Error('Informe horário e campo para cada confronto.');
  if (!matchTimes.every(time => typeof time === 'string' && (time === '' || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)))) throw Error('Horário inválido. Use o formato HH:MM.');
  if (!matchFields.every(field => typeof field === 'string' && field.trim().length <= 120 && !/[\r\n|]/.test(field))) throw Error('O campo deve ter até 120 caracteres, em uma linha e sem o caractere |.');
  return {weekId:weekStart(data.gameDate),gameDate:data.gameDate,...weekDeadline(data.gameDate),teams:ids,matchTimes:[...matchTimes],matchFields:matchFields.map(field => field.trim()),status:data.status,notes};
}
export function canSubmitSquad(profile,week,teamId,teams,now = Date.now()) {
  if (!week || !['admin','director'].includes(profile?.role) || !Array.isArray(week.teams) || !week.teams.includes(teamId) || teams[teamId]?.status !== 'active') return false;
  if (profile.role === 'admin') return true;
  const deadline = week.deadline?.toMillis?.() ?? week.deadline;
  return profile.team === teamId && week.status === 'open' && now < deadline;
}
export function extractGameNames(text) {
  const position = '(?:zag(?:ueiro)?|gol(?:eiro)?|lat(?:eral)?|ld|le|vol(?:ante)?|mei(?:a|o)?|ata(?:cante)?|ponta|centroavante)';
  return String(text).split(/\r?\n/).flatMap(raw => {
    let name = raw.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\u20E3✅☑✓✔]/gu,'')
      .replace(/[*_~`]/g,'').trim()
      .replace(/^(?:\d+\s*[.)\-:]\s*|[-•]+\s*)/,'').trim();
    const normalized = clean(name);
    if (!name || /^(?:campo|local|dia|data|horario|hora|valor|pix|chave|pagamento|taxa|tecnico|tec|treinador|auxiliar|comissao|arbitro|confirmados|escalacao|lista|jogadores|reservas|titulares)\b/.test(normalized)
      || /\s(?:x|vs\.?)\s/i.test(name) || /\d{1,2}[/:]\d{2}/.test(name)
      || /\b(?:reais|r\$)\b/i.test(name) || /\d{6,}/.test(name.replace(/[.\-\s]/g,''))) return [];
    name = name.replace(new RegExp('^\\(?'+position+'\\)?(?:\\s*[:.\\-–]\\s*|\\s+)','i'),'')
      .replace(new RegExp('(?:\\s+[-–:]?\\s*|\\s*\\()'+position+'\\)?$','i'),'').trim();
    if (!/\p{L}/u.test(name) || new RegExp('^'+position+'$','i').test(name)) return [];
    return [{raw,name}];
  });
}
export function compareGameList(text,players,teamId) {
  if (String(text).length > 12000) throw Error('A lista é muito grande. Cole até 50 nomes, um por linha.');
  const lines = extractGameNames(text);
  if (!lines.length || lines.length > 50) throw Error('Cole de 1 a 50 nomes, um por linha.');
  const roster = players.filter(p => isActivePlayer(p) && p.teams.includes(teamId));
  return lines.map(({raw,name}) => {
    const query = clean(name);
    const ranked = roster.map(player => {
      const value = clean(player.name), tokens = value.split(' '), typed = query.split(' ').filter(Boolean);
      const partial = typed.length && typed.every(t => tokens.some(w => w.startsWith(t) || t.startsWith(w)));
      return {player,score:value === query ? 1 : partial ? .88 : similarity(query,value)};
    }).filter(match => match.score >= .65).sort((a,b) => b.score-a.score || a.player.name.localeCompare(b.player.name,'pt-BR'));
    const exact = ranked.filter(match => clean(match.player.name) === query);
    const outside = players.filter(p => !p.mergedInto && !roster.includes(p) && (clean(p.name) === query || clean(p.name).split(' ').includes(query)));
    const outsideExact = outside.filter(p => clean(p.name) === query);
    return {raw,name,candidates:ranked.map(match => match.player),outside,selectedId:exact.length === 1 ? exact[0].player.id : exact.length === 0 && outsideExact.length === 1 ? outsideExact[0].id : '',ignored:false};
  });
}
export const GAME_ISSUES = {ok:'Vínculo confirmado no envio',unknown:'Nome sem cadastro confirmado',inactive:'Cadastro inativo, excluído ou alterado',otherTeam:'Jogador não pertence a este time'};
export function gameEntryIssue(player,teamId) {
  return !player ? 'unknown' : !isActivePlayer(player) ? 'inactive' : !player.teams.includes(teamId) ? 'otherTeam' : 'ok';
}
export function gameListEntries(rows) {
  const active = rows.filter(row => !row.ignored);
  if (!active.length || active.length > 50) throw Error('A escalação precisa ter de 1 a 50 nomes.');
  const ids = active.map(row => row.selectedId).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw Error('O mesmo jogador foi escolhido em mais de uma linha. Corrija a lista.');
  return active.map(row => {
    const rawName = String(row.name || row.raw || '').trim();
    if (!rawName || rawName.length > 160) throw Error('Cada nome da lista precisa ter entre 1 e 160 caracteres.');
    return {playerId:row.selectedId || '',rawName};
  });
}
