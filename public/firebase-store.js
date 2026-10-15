import { membership, playerId, mergedTeams, playerDetails, isActivePlayer, playerStatus } from './domain.js';
import {DEFAULT_TEAMS,changeTeam,teamActive} from './teams.js';
export async function ensureAccessProfile(sdk, db, user) {
  const ref = sdk.doc(db, 'users', user.uid);
  let existingProfile = null;
  try { await sdk.runTransaction(db, async tx => {
    const previous = (await tx.get(ref)).data();
    existingProfile = previous || null;
    if (previous) {
      const email = user.email || '';
      const displayName = (user.displayName || 'Novo diretor').slice(0,120);
      if (previous.email !== email || previous.displayName !== displayName) tx.set(ref, {...previous,email,displayName});
      return;
    }
    tx.set(ref, {role:'pending', team:'', displayName:(user.displayName || 'Novo diretor').slice(0,120), email:user.email || '', createdAt:sdk.serverTimestamp()});
  }); } catch (error) {
    // Regras antigas podem permitir ler o acesso, mas impedir atualizar o e-mail.
    // Essa atualização opcional não deve bloquear uma conta já autorizada.
    if (error.code === 'permission-denied' && existingProfile) return {metadataSyncPending:true};
    throw error;
  }
}
export function createFirebaseApi(sdk, db, auth) {
  const { doc, collection, runTransaction, serverTimestamp } = sdk;
  return async (action, data) => {
    if (!auth.currentUser) throw Error('Entre com sua conta.');
    const uid = auth.currentUser.uid;
    const eventRef = doc(collection(db, 'events'));
    const id = action === 'addPlayer' ? await playerId(data.name, data.congregation) : data.id;
    try {
      return await runTransaction(db, async tx => {
        const profile = (await tx.get(doc(db, 'users', uid))).data();
        if (!['admin','director'].includes(profile?.role)) throw Error('Conta sem autorização.');
        const allowed = team => profile.role === 'admin' || profile.team === team;
        const event = { actor:uid, at:serverTimestamp() };
        let teams = DEFAULT_TEAMS;
        if (['createTeam','editTeam','setTeamStatus','addPlayer','transferPlayer','assignDirector','mergePlayers'].includes(action)) teams = (await tx.get(doc(db,'settings','teams'))).data()?.items || DEFAULT_TEAMS;
        if (['createTeam','editTeam','setTeamStatus'].includes(action)) {
          if (profile.role !== 'admin') throw Error('Apenas a administração pode gerenciar times.');
          const change = changeTeam(teams,action,data);
          tx.set(doc(db,'settings','teams'),{items:change.items,updatedAt:serverTimestamp(),lastEvent:eventRef.id});
          const verb = {createTeam:'Time criado',editTeam:'Time editado',setTeamStatus:'Situação do time alterada'}[action];
          tx.set(eventRef,{...event,kind:'team',action,teamId:data.id,previous:change.previous,next:change.next,name:change.next.name,detail:`${verb}: ${change.next.name}. Situação: ${change.next.status === 'active' ? 'ativo' : change.next.status === 'inactive' ? 'inativo' : 'excluído'}.`});
          return;
        }
        if (action === 'mergePlayers') {
          if (profile.role !== 'admin') throw Error('Apenas a administração pode unificar cadastros.');
          if (![data.sourceId,data.targetId].every(id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id)) || data.sourceId === data.targetId) throw Error('Escolha dois cadastros diferentes.');
          const sourceRef = doc(db,'players',data.sourceId), targetRef = doc(db,'players',data.targetId);
          const source = (await tx.get(sourceRef)).data(), target = (await tx.get(targetRef)).data();
          if (!source || !target || !isActivePlayer(source) || !isActivePlayer(target)) throw Error('Cadastro inativo, alterado ou já unificado. Atualize a revisão.');
          const union = mergedTeams(source,target);
          tx.set(sourceRef,{...source,teams:[],mergedInto:data.targetId,updatedAt:serverTimestamp(),lastEvent:eventRef.id});
          tx.set(targetRef,{...target,teams:union,updatedAt:serverTimestamp(),lastEvent:eventRef.id});
          tx.set(eventRef,{...event,kind:'merge',sourceId:data.sourceId,targetId:data.targetId,name:target.name,sourceName:source.name,sourceCongregation:source.congregation,targetCongregation:target.congregation,sourceTeams:source.teams,targetTeams:target.teams,teams:union,detail:`Cadastro de ${source.name} (${source.congregation}) unificado com ${target.name} (${target.congregation}). Times: ${union.map(id => teams[id]?.name || id).join(', ')}.`});
          return;
        }
        if (action === 'assignDirector') {
          if (profile.role !== 'admin') throw Error('Apenas a administração pode vincular acessos.');
          if (typeof data.uid !== 'string' || !data.uid || data.uid.includes('/') || data.uid === uid) throw Error('Conta inválida.');
          if (data.team !== '' && !teamActive(teams,data.team)) throw Error('Time inválido, inativo ou excluído.');
          const ref = doc(db,'users',data.uid);
          const target = (await tx.get(ref)).data();
          if (!target) throw Error('A pessoa precisa entrar no site uma vez.');
          if (target.role === 'admin') throw Error('Esta conta é de administração.');
          tx.set(ref, {...target, role:data.team ? 'director' : 'pending', team:data.team, updatedAt:serverTimestamp()});
          return;
        }
        if (action === 'setWindow') {
          if (profile.role !== 'admin') throw Error('Apenas a administração pode alterar a janela.');
          if (typeof data.open !== 'boolean') throw Error('Estado inválido.');
          tx.set(doc(db,'settings','transfers'), {open:data.open, updatedAt:serverTimestamp(), lastEvent:eventRef.id});
          tx.set(eventRef, {...event, kind:'window', open:data.open, name:'Janela de transferências', detail:data.open ? 'Aberta pela administração' : 'Fechada pela administração'});
          return;
        }
        let ref = doc(db, 'players', id);
        let previous = (await tx.get(ref)).data();
        let resolvedId = id;
        if (action === 'addPlayer') {
          const visited = new Set();
          while (previous?.mergedInto) {
            if (visited.has(resolvedId) || visited.size >= 20) throw Error('Vínculo de cadastro inválido. Procure a administração.');
            visited.add(resolvedId); resolvedId = previous.mergedInto;
            ref = doc(db,'players',resolvedId); previous = (await tx.get(ref)).data();
            if (!previous) throw Error('Cadastro unificado não encontrado. Procure a administração.');
          }
        } else if (previous?.mergedInto) throw Error('Este cadastro foi unificado. Atualize a lista.');
        if (['editPlayer','setPlayerStatus'].includes(action)) {
          if (profile.role !== 'admin') throw Error('Apenas a administração pode gerenciar jogadores.');
          if (!previous) throw Error('Jogador não encontrado.');
          if (action === 'setPlayerStatus') {
            if (!['active','inactive','deleted'].includes(data.status)) throw Error('Situação inválida.');
            if (playerStatus(previous) === data.status) throw Error('O jogador já está nessa situação.');
            const labels = {active:'Ativado',inactive:'Inativado',deleted:'Excluído da relação'};
            tx.set(ref,{...previous,status:data.status,updatedAt:serverTimestamp(),lastEvent:eventRef.id});
            tx.set(eventRef,{...event,kind:'status',playerId:id,name:previous.name,previousStatus:playerStatus(previous),status:data.status,detail:`${labels[data.status]} pela administração. Congregação: ${previous.congregation}.`});
          } else {
            if (playerStatus(previous) === 'deleted') throw Error('Restaure o jogador antes de editar.');
            const details = playerDetails(data), targetId = await playerId(details.name,details.congregation);
            const targetRef = doc(db,'players',targetId);
            if (targetId !== id && (await tx.get(targetRef)).data()) throw Error('Já existe um cadastro com esse nome e congregação. Confira a lista e use a revisão de duplicidades.');
            tx.set(targetRef,{...previous,...details,updatedAt:serverTimestamp(),lastEvent:eventRef.id});
            if (targetId !== id) tx.set(ref,{...previous,teams:[],mergedInto:targetId,updatedAt:serverTimestamp(),lastEvent:eventRef.id});
            tx.set(eventRef,{...event,kind:'edit',playerId:targetId,sourceId:id,name:details.name,congregation:details.congregation,previousName:previous.name,previousCongregation:previous.congregation,detail:`Cadastro editado: ${previous.name} (${previous.congregation}) → ${details.name} (${details.congregation}).`});
          }
          return;
        }
        if (previous && !isActivePlayer(previous)) throw Error('Este jogador está inativo ou excluído. Peça à administração para reativá-lo.');
        let next, from = '', to;
        if (action === 'addPlayer') {
          const {name,congregation} = playerDetails(data);
          to = data.team;
          if (!allowed(to)) throw Error('Você só pode cadastrar no seu próprio time.');
          if (!teamActive(teams,to)) throw Error('Time inválido, inativo ou excluído.');
          next = {...(previous || {name, congregation}), teams:membership(previous || {teams:[]}, to)};
        } else if (action === 'transferPlayer') {
          const window = (await tx.get(doc(db,'settings','transfers'))).data();
          if (!window?.open) throw Error('A janela de transferências está fechada.');
          if (!previous) throw Error('Jogador não encontrado.');
          from = data.from; to = data.to;
          if (!allowed(from)) throw Error('Você só pode transferir jogadores do seu próprio time.');
          if (!teamActive(teams,to)) throw Error('Time de destino inválido, inativo ou excluído.');
          next = {...previous, teams:membership(previous, from, to)};
        } else throw Error('Operação inválida.');
        tx.set(ref, {...next, updatedAt:serverTimestamp(), lastEvent:eventRef.id});
        tx.set(eventRef, {...event, kind:from ? 'transfer' : 'add', playerId:resolvedId, name:next.name, from, to, detail:from ? `${teams[from].name} → ${teams[to].name}` : `Inscrição em ${teams[to].name}`});
      });
    } catch(e) {
      if (e.code === 'permission-denied') throw Error('Operação não autorizada. Confira seu time, a janela e as regras publicadas.');
      throw e;
    }
  };
}
