import {gameWeekDetails,canSubmitSquad,weekStart,gameEntryIssue} from './game-day.js';
import {DEFAULT_TEAMS} from './teams.js';

export function createGameApi(sdk,db,auth,now = Date.now) {
  const {doc,collection,runTransaction,serverTimestamp} = sdk;
  return async (action,data) => {
    if (!auth.currentUser) throw Error('Entre com sua conta.');
    const uid = auth.currentUser.uid, eventRef = doc(collection(db,'events'));
    const profileRef = doc(db,'users',uid), teamsRef = doc(db,'settings','teams');
    const actor = profile => ({actor:uid,actorName:profile.displayName ?? profile.email ?? 'Diretor',at:serverTimestamp()});
    const get = async (tx,ref) => (await tx.get(ref)).data();
    try {
      if (action === 'saveGameWeek') return await runTransaction(db,async tx => {
        const profile = await get(tx,profileRef);
        if (profile?.role !== 'admin') throw Error('Apenas a administração pode programar a semana.');
        const teams = (await get(tx,teamsRef))?.items || DEFAULT_TEAMS;
        const week = gameWeekDetails(data,teams), ref = doc(db,'gameWeeks',week.weekId);
        const previous = (await tx.get(ref)).data();
        const removed = (previous?.teams || []).filter(id => !week.teams.includes(id));
        const removedSquads = [];
        for (const teamId of removed) {
          const squad = doc(db,'gameSquads',`${week.weekId}_${teamId}`);
          if ((await tx.get(squad)).data()) removedSquads.push(squad);
        }
        for (const squad of removedSquads) tx.delete(squad);
        tx.set(ref,{...week,teamNames:Object.fromEntries(week.teams.map(id => [id,teams[id].name])),updatedAt:serverTimestamp(),lastEvent:eventRef.id});
        tx.set(eventRef,{...actor(profile),kind:'gameWeek',weekId:week.weekId,teams:week.teams,name:'Dia de jogo',detail:`Programação do jogo de ${week.gameDate}. Envio até quinta-feira ${week.cutoff}. Semana ${week.status === 'open' ? 'aberta' : 'fechada'}.${removed.length ? ' Jogos excluídos dos times: '+removed.map(id => previous.teamNames?.[id] || teams[id]?.name || id).join(', ')+'.' : ''}`});
      });
      if (action !== 'submitGameSquad') throw Error('Operação inválida.');
      if (weekStart(data.weekId) !== data.weekId || typeof data.teamId !== 'string' || !data.teamId || data.teamId.includes('/')) throw Error('Semana ou time inválido.');
      const selected = data.entries || (Array.isArray(data.playerIds) ? data.playerIds.map(playerId => ({playerId,rawName:''})) : null);
      if (!Array.isArray(selected) || selected.length < 1 || selected.length > 50) throw Error('Escolha de 1 a 50 nomes.');
      const ids = selected.map(entry => entry.playerId).filter(Boolean);
      if (new Set(ids).size !== ids.length || !selected.every(entry => typeof entry.playerId === 'string' && (!entry.playerId || /^[a-f0-9]{64}$/.test(entry.playerId)) && typeof entry.rawName === 'string' && entry.rawName.length <= 160 && (entry.playerId || entry.rawName.trim()))) throw Error('Informe nomes válidos e não repita jogadores.');
      const weekRef = doc(db,'gameWeeks',data.weekId), squadId = `${data.weekId}_${data.teamId}`, squadRef = doc(db,'gameSquads',squadId), draftRef = doc(db,'gameDrafts',eventRef.id);
      async function context(tx) {
        const profile = await get(tx,profileRef), week = await get(tx,weekRef), teams = (await get(tx,teamsRef))?.items || DEFAULT_TEAMS;
        if (!canSubmitSquad(profile,week,data.teamId,teams,now())) throw Error('Envio bloqueado. Confira o time, a programação e o prazo de quinta-feira. Após o prazo, somente o administrador pode corrigir.');
        return {profile,week,teams};
      }
      const baseDraft = await runTransaction(db,async tx => {
        await context(tx);
        const old = await get(tx,squadRef); const base = old?.draftId || '';
        tx.set(draftRef,{weekId:data.weekId,teamId:data.teamId,squadId,actor:uid,createdAt:serverTimestamp(),baseDraft:base});
        return base;
      });
      // Each staged player is checked in a small transaction to respect Firestore's rule-read limits.
      // Nothing becomes the official list until the final squad pointer is committed.
      let done = 0;
      const saved = [];
      for (let offset = 0; offset < selected.length; offset += 5) {
        const results = await Promise.allSettled(selected.slice(offset,offset+5).map((entry,index) => runTransaction(db,async tx => {
          await context(tx);
          const player = entry.playerId ? await get(tx,doc(db,'players',entry.playerId)) : null;
          const position = offset+index, issue = gameEntryIssue(player,data.teamId);
          const rawName = entry.rawName.trim() || player?.name || 'Nome não identificado';
          const row = {draftId:eventRef.id,weekId:data.weekId,teamId:data.teamId,position,rawName,playerId:player ? entry.playerId : '',name:player?.name || rawName,issue,actor:uid,updatedAt:serverTimestamp()};
          tx.set(doc(db,'gameEntries',`${eventRef.id}_${position}`),row);
          return row;
        })));
        const failure = results.find(result => result.status === 'rejected'); if (failure) throw failure.reason;
        saved.push(...results.map(result => result.value));
        done += results.length; data.onProgress?.(done,selected.length);
      }
      await runTransaction(db,async tx => {
        const {profile,teams} = await context(tx), old = await get(tx,squadRef);
        if ((old?.draftId || '') !== baseDraft) throw Error('Outra escalação foi enviada durante esta conferência. Atualize e confira antes de substituir.');
        for (const entry of saved.filter(entry => entry.playerId)) {
          const current = await get(tx,doc(db,'players',entry.playerId));
          if (gameEntryIssue(current,data.teamId) !== entry.issue || current?.name !== entry.name) throw Error('Um cadastro mudou durante o envio. Envie novamente para publicar os avisos atualizados.');
        }
        tx.set(squadRef,{weekId:data.weekId,teamId:data.teamId,draftId:eventRef.id,submittedBy:uid,updatedAt:serverTimestamp(),lastEvent:eventRef.id});
        const warnings = saved.filter(entry => entry.issue !== 'ok').length;
        tx.set(eventRef,{...actor(profile),kind:'gameSquad',weekId:data.weekId,teamId:data.teamId,draftId:eventRef.id,name:teams[data.teamId].name,detail:`Escalação de ${teams[data.teamId].name} enviada para a semana ${data.weekId}: ${saved.length} nomes, ${warnings} pendências sinalizadas.`});
      });
    } catch(error) {
      if (error.code === 'permission-denied') throw Error('O banco recusou a escalação. Confira a programação, seu time e o prazo de quinta-feira.');
      throw error;
    }
  };
}
