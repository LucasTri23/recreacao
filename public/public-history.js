import {publicTeamPlayer} from './public-team-roster.js';
export const PUBLIC_MOVEMENT_KINDS = ['add','transfer'];
export function publicMovement(event) {
  return {kind:event.kind || 'legacy',name:event.name || '',at:event.at,from:event.from || '',to:event.to || '',teams:event.teams || []};
}
export function publicMovementDetail(event,teams = {}) {
  const name = id => teams[id]?.name || id;
  if (event.kind === 'add') return `Inscrição registrada em ${name(event.to)}.`;
  if (event.kind === 'transfer') return `${name(event.from)} → ${name(event.to)}.`;
  return ({edit:'Cadastro atualizado.',status:'Situação do jogador atualizada.',merge:'Cadastros unificados.',duplicateReview:'Revisão de duplicidade registrada.',team:'Registro de time atualizado.',window:'Janela de transferências atualizada.',gameWeek:'Programação de jogos atualizada.',gameSquad:'Escalação publicada.'})[event.kind] || 'Movimentação registrada.';
}
export function withPublicHistory(sdk,db) {
  return {...sdk,runTransaction:(database,callback,...options) => sdk.runTransaction(database,tx => callback(new Proxy(tx,{
    get(target,key) {
      if (key === 'set') return (ref,data,...args) => {
        target.set(ref,data,...args);
        if (/^events\/[^/]+$/.test(ref.path) && PUBLIC_MOVEMENT_KINDS.includes(data.kind)) target.set(sdk.doc(db,'publicEvents',ref.id || ref.path.split('/')[1]),publicMovement(data));
        if (/^players\/[^/]+$/.test(ref.path)) target.set(sdk.doc(db,'publicTeamPlayers',ref.id || ref.path.split('/')[1]),publicTeamPlayer(data));
        return target;
      };
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    }
  })),...options)};
}
