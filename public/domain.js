import {cityCongregation} from './cities.js';
export const TEAMS = ['BRANCO','PRETO','BLUES','COIOTES','VETOR NORTE','AMARELO','LARANJA','VERDE'];
export const playerStatus = player => player.status || 'active';
export const isActivePlayer = player => !player.mergedInto && playerStatus(player) === 'active';
export const playerName = name => String(name || '').toLocaleUpperCase('pt-BR');
export function playerDetails(data) {
  const name = playerName(data.name).trim().replace(/\s+/g,' '), congregation = playerName(data.congregation).trim().replace(/\s+/g,' ');
  if (name.length < 3 || name.length > 120 || congregation.length < 2 || congregation.length > 120 || /[|]/.test(name + congregation)) throw Error('Informe nome completo e congregação válidos (até 120 caracteres, sem |).');
  if ('goalkeeper' in data && typeof data.goalkeeper !== 'boolean') throw Error('Informe se o jogador é goleiro.');
  return {name,congregation,...('city' in data ? cityCongregation(congregation,data.city,[congregation]) : {}),...('goalkeeper' in data ? {goalkeeper:data.goalkeeper} : {})};
}
export function identity(name, congregation) {
  const clean = value => value.toLowerCase().replace(/[àáâãäå]/g,'a').replace(/[èéêë]/g,'e').replace(/[ìíîï]/g,'i').replace(/[òóôõö]/g,'o').replace(/[ùúûü]/g,'u').replace(/ç/g,'c').replace(/ñ/g,'n').replace(/[ýÿ]/g,'y').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g, ' ');
  return `${clean(name)}|${clean(congregation)}`;
}
export function membership(player, team, destination = null) {
  const teams = [...player.teams];
  if (destination) {
    if (!teams.includes(team)) throw Error('O jogador não está no time de origem.');
    if (teams.includes(destination)) throw Error('O jogador já participa do time de destino.');
    return teams.map(t => t === team ? destination : t);
  }
  if (teams.includes(team)) throw Error('Este jogador já está neste time.');
  if (!player.goalkeeper && teams.length >= 2) throw Error('Este jogador já participa de dois times. Use a transferência durante a janela.');
  return [...teams, team];
}
export async function playerId(name, congregation) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity(name, congregation)));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}

const normalizedName = value => identity(value, '').slice(0,-1);
export function similarity(a, b) {
  a = normalizedName(a); b = normalizedName(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const words = value => value.split(' ').filter(w => !['de','da','do','das','dos','e'].includes(w));
  const left = words(a), right = words(b);
  const shared = left.filter(w => right.includes(w)).length;
  let row = Array.from({length:b.length + 1}, (_,i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1] === b[j-1] ? 0 : 1));
    row = next;
  }
  const edit = 1 - row[b.length] / Math.max(a.length,b.length);
  return Math.max(edit, shared >= 2 ? 2 * shared / (left.length + right.length) : 0);
}
export function playerSuggestions(players, name, congregation = '') {
  const query = normalizedName(name);
  if (query.length < 3) return [];
  return players.filter(p => !p.mergedInto).map(player => {
    const candidate = normalizedName(player.name);
    const score = candidate.includes(query) ? Math.max(.85, similarity(name,player.name)) : similarity(name,player.name);
    return {player,score,sameCongregation:!!congregation && normalizedName(congregation) === normalizedName(player.congregation)};
  }).filter(item => item.score >= .72).sort((a,b) => b.score - a.score || Number(b.sameCongregation) - Number(a.sameCongregation) || a.player.name.localeCompare(b.player.name,'pt-BR'));
}
export function reviewKey(a,b) { return [a,b].sort().join('_'); }
export function reviewMatches(review,source,target) {
  const [a,b] = [source,target].sort((a,b) => a.id.localeCompare(b.id));
  return review?.different === true && review.sourceId === a.id && review.targetId === b.id
    && review.sourceName === a.name && review.targetName === b.name
    && review.sourceCongregation === a.congregation && review.targetCongregation === b.congregation;
}
export function duplicatePairs(players,reviews = []) {
  const active = players.filter(isActivePlayer), pairs = [];
  for (let i = 0; i < active.length; i++) for (let j = i+1; j < active.length; j++) {
    const score = similarity(active[i].name,active[j].name);
    if (score >= .72) {
      const source = active[i],target = active[j];
      pairs.push({source,target,score,reviewed:reviews.some(review => reviewMatches(review,source,target))});
    }
  }
  return pairs.sort((a,b) => b.score-a.score);
}
export function mergedTeams(source, target) {
  const teams = [...new Set([...target.teams,...source.teams])];
  if (!target.goalkeeper && teams.length > 2) throw Error('Esses cadastros somam mais de dois times. Regularize as inscrições antes de unificar.');
  return teams;
}
