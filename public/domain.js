export const TEAMS = ['BRANCO','PRETO','BLUES','COIOTES','VETOR NORTE','AMARELO','LARANJA','VERDE'];
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
  if (teams.length >= 2) throw Error('Este jogador já participa de dois times. Use a transferência durante a janela.');
  return [...teams, team];
}
export async function playerId(name, congregation) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity(name, congregation)));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}
