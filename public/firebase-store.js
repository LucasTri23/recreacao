import { TEAMS, membership, playerId, mergedTeams } from './domain.js';
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
        if (action === 'mergePlayers') {
          if (profile.role !== 'admin') throw Error('Apenas a administração pode unificar cadastros.');
          if (![data.sourceId,data.targetId].every(id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id)) || data.sourceId === data.targetId) throw Error('Escolha dois cadastros diferentes.');
          const sourceRef = doc(db,'players',data.sourceId), targetRef = doc(db,'players',data.targetId);
          const source = (await tx.get(sourceRef)).data(), target = (await tx.get(targetRef)).data();
          if (!source || !target || source.mergedInto || target.mergedInto) throw Error('Cadastro alterado ou já unificado. Atualize a revisão.');
          const teams = mergedTeams(source,target);
          tx.set(sourceRef,{...source,teams:[],mergedInto:data.targetId,updatedAt:serverTimestamp(),lastEvent:eventRef.id});
          tx.set(targetRef,{...target,teams,updatedAt:serverTimestamp(),lastEvent:eventRef.id});
          tx.set(eventRef,{...event,kind:'merge',sourceId:data.sourceId,targetId:data.targetId,name:target.name,sourceName:source.name,sourceCongregation:source.congregation,targetCongregation:target.congregation,sourceTeams:source.teams,targetTeams:target.teams,teams,detail:`Cadastro de ${source.name} (${source.congregation}) unificado com ${target.name} (${target.congregation}). Times: ${teams.join(', ')}.`});
          return;
        }
        if (action === 'assignDirector') {
          if (profile.role !== 'admin') throw Error('Apenas a administração pode vincular acessos.');
          if (typeof data.uid !== 'string' || !data.uid || data.uid.includes('/') || data.uid === uid) throw Error('Conta inválida.');
          if (data.team !== '' && !TEAMS.includes(data.team)) throw Error('Time inválido.');
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
        let next, from = '', to;
        if (action === 'addPlayer') {
          const name = data.name.trim().replace(/\s+/g,' '), congregation = data.congregation.trim().replace(/\s+/g,' ');
          if (name.length < 3 || name.length > 120 || congregation.length < 2 || congregation.length > 120 || /[|]/.test(name + congregation)) throw Error('Informe nome completo e congregação válidos (até 120 caracteres, sem |).');
          to = data.team;
          if (!TEAMS.includes(to) || !allowed(to)) throw Error('Você só pode cadastrar no seu próprio time.');
          next = {...(previous || {name, congregation}), teams:membership(previous || {teams:[]}, to)};
        } else if (action === 'transferPlayer') {
          const window = (await tx.get(doc(db,'settings','transfers'))).data();
          if (!window?.open) throw Error('A janela de transferências está fechada.');
          if (!previous) throw Error('Jogador não encontrado.');
          from = data.from; to = data.to;
          if (!allowed(from) || !TEAMS.includes(to)) throw Error('Você só pode transferir jogadores do seu próprio time.');
          next = {...previous, teams:membership(previous, from, to)};
        } else throw Error('Operação inválida.');
        tx.set(ref, {...next, updatedAt:serverTimestamp(), lastEvent:eventRef.id});
        tx.set(eventRef, {...event, kind:from ? 'transfer' : 'add', playerId:resolvedId, name:next.name, from, to, detail:from ? `${from} → ${to}` : `Inscrição em ${to}`});
      });
    } catch(e) {
      if (e.code === 'permission-denied') throw Error('Operação não autorizada. Confira seu time, a janela e as regras publicadas.');
      throw e;
    }
  };
}
