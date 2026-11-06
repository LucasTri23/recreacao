import {GAME_ISSUES} from './game-day.js';
import {playerName} from './domain.js';
export const publishedGoalkeeper = entry => entry.goalkeeper === true;
export function publishedLineup(entries,goalkeeperOf = publishedGoalkeeper) {
  return [...entries].sort((a,b) => Number(goalkeeperOf(b))-Number(goalkeeperOf(a)) || (a.position ?? 0)-(b.position ?? 0));
}
export function publishedName(entry,goalkeeperOf = publishedGoalkeeper) {
  return `${goalkeeperOf(entry) ? 'GOLEIRO: ' : ''}${playerName(entry.name)}`;
}

export function roundSummary(week,squads) {
  const scheduled = week?.teams || [];
  const sent = new Set(squads.filter(s => s.weekId === week?.weekId).map(s => s.teamId));
  return {submitted:scheduled.filter(id => sent.has(id)),pending:scheduled.filter(id => !sent.has(id))};
}

export function fixtureText(week,index,squads,entries,nameOf,issueOf = entry => entry.issue || 'ok',goalkeeperOf = publishedGoalkeeper) {
  const ids = week.teams.slice(index*2,index*2+2);
  const date = week.gameDate.split('-').reverse().join('/');
  const lines = [`⚽ ${ids.map(nameOf).join(' e ')}`,`Data: ${date}`,`Horário: ${week.matchTimes?.[index] ? week.matchTimes[index]+' (Brasília)' : 'a definir'}`,`Campo: ${week.matchFields?.[index] || 'a definir'}`];
  if (week.notes) lines.push(`Observações: ${week.notes}`);
  for (const id of ids) {
    lines.push('',nameOf(id));
    const squad = squads.find(s => s.weekId === week.weekId && s.teamId === id);
    if (!squad) { lines.push('⏳ Aguardando escalação'); continue; }
    const lineup = publishedLineup(entries.filter(e => e.weekId === week.weekId && e.teamId === id && e.draftId === squad.draftId),goalkeeperOf);
    if (!lineup.length) lines.push('⚠ Escalação indisponível. Confira no site.');
    lineup.forEach((entry,position) => {
      const issue = issueOf(entry,id);
      lines.push(`${position+1}. ${publishedName(entry,goalkeeperOf)}${issue !== 'ok' ? ' ⚠ '+(GAME_ISSUES[issue] || GAME_ISSUES.unknown) : ''}`);
    });
    if (lineup.some(entry => issueOf(entry,id) !== 'ok')) lines.push('⚠ Os nomes com aviso têm pendências de cadastro ou vínculo com o time.');
  }
  return lines.join('\n');
}
