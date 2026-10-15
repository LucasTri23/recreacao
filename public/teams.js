import {TEAMS,identity} from './domain.js';
export const TEAM_COLORS = {
  white:{label:'Branco',badge:'⚪',color:'#c5c9b8',soft:'#f0f1e9',ink:'#424d36'},
  black:{label:'Preto',badge:'⚫',color:'#343c39',soft:'#e9ece8',ink:'#303a32'},
  blue:{label:'Azul',badge:'🔵',color:'#648dc5',soft:'#ebf1fa',ink:'#355a8b'},
  brown:{label:'Marrom',badge:'🟤',color:'#a18270',soft:'#f4ede7',ink:'#6b4e3d'},
  olive:{label:'Verde oliva',badge:'🟢',color:'#899b86',soft:'#ebf0e7',ink:'#45603e'},
  yellow:{label:'Amarelo',badge:'🟡',color:'#d4b94e',soft:'#faf5dc',ink:'#655516'},
  orange:{label:'Laranja',badge:'🟠',color:'#d99459',soft:'#fcf0e2',ink:'#805020'},
  green:{label:'Verde',badge:'🟢',color:'#71a08b',soft:'#eaf3ec',ink:'#356047'},
  red:{label:'Vermelho',badge:'🔴',color:'#d46a65',soft:'#fbecea',ink:'#843d36'},
  purple:{label:'Roxo',badge:'🟣',color:'#a17cc7',soft:'#f2ecfa',ink:'#694591'}
};
const colors = ['white','black','blue','brown','olive','yellow','orange','green'];
export const DEFAULT_TEAMS = Object.fromEntries(TEAMS.map((id,i) => [id,{name:id,color:colors[i],badge:id === 'COIOTES' ? 'C' : id === 'VETOR NORTE' ? '↑' : TEAM_COLORS[colors[i]].badge,status:'active'}]));
export function teamDetails(data) {
  const name = String(data.name || '').trim().replace(/\s+/g,' ').toUpperCase();
  const badge = String(data.badge || '').trim();
  if (name.length < 2 || name.length > 60 || /[|]/.test(name)) throw Error('Informe um nome de time entre 2 e 60 caracteres, sem |.');
  if (!Object.hasOwn(TEAM_COLORS,data.color)) throw Error('Escolha uma cor válida.');
  if (!badge || badge.length > 12) throw Error('Informe um emblema de até 12 caracteres.');
  return {name,color:data.color,badge};
}
export function changeTeam(items,action,data) {
  if (typeof data.id !== 'string' || !data.id || data.id.length > 100 || /[/|]/.test(data.id) || ['__proto__','constructor','prototype'].includes(data.id)) throw Error('Time inválido.');
  const previous = Object.hasOwn(items,data.id) ? items[data.id] : null;
  let next;
  if (action === 'createTeam' || action === 'editTeam') {
    if (action === 'createTeam' && previous) throw Error('Este time já existe.');
    if (action === 'editTeam' && (!previous || previous.status === 'deleted')) throw Error('Time não encontrado ou excluído. Restaure antes de editar.');
    const details = teamDetails(data);
    if (Object.entries(items).some(([id,team]) => id !== data.id && identity(team.name,'') === identity(details.name,''))) throw Error('Já existe um time com esse nome. Confira também os inativos e excluídos.');
    next = {...details,status:previous?.status || 'active'};
  } else if (action === 'setTeamStatus') {
    if (!previous) throw Error('Time não encontrado.');
    if (!['active','inactive','deleted'].includes(data.status)) throw Error('Situação inválida.');
    if (previous.status === data.status) throw Error('O time já está nessa situação.');
    next = {...previous,status:data.status};
  } else throw Error('Operação inválida.');
  return {previous,next,items:{...items,[data.id]:next}};
}
export const teamActive = (items,id) => Object.hasOwn(items,id) && items[id].status === 'active';
