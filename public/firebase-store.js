import { TEAMS, membership, playerId } from './domain.js';
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
        if (action === 'setWindow') {
          if (profile.role !== 'admin') throw Error('Apenas a administração pode alterar a janela.');
          if (typeof data.open !== 'boolean') throw Error('Estado inválido.');
          tx.set(doc(db,'settings','transfers'), {open:data.open, updatedAt:serverTimestamp(), lastEvent:eventRef.id});
          tx.set(eventRef, {...event, kind:'window', open:data.open, name:'Janela de transferências', detail:data.open ? 'Aberta pela administração' : 'Fechada pela administração'});
          return;
        }
        const ref = doc(db, 'players', id);
        const previous = (await tx.get(ref)).data();
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
        tx.set(eventRef, {...event, kind:from ? 'transfer' : 'add', playerId:id, name:next.name, from, to, detail:from ? `${from} → ${to}` : `Inscrição em ${to}`});
      });
    } catch(e) {
      if (e.code === 'permission-denied') throw Error('Operação não autorizada. Confira seu time, a janela e as regras publicadas.');
      throw e;
    }
  };
}
