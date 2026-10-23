export function publicTeamPlayer(player) {
  const active = !player.mergedInto && (player.status || 'active') === 'active';
  return {name:active ? player.name : '',teams:active ? [...(player.teams || [])] : [],active};
}
export function setupPublicTeams({element,getPlayers,teamName}) {
  const dialog = element('dialog'); dialog.className = 'public-team-dialog';
  const heading = element('div',null,'dialog-title'), title = element('h2'), close = element('button','×','close');
  close.type = 'button'; close.setAttribute('aria-label','Fechar'); close.onclick = () => dialog.close();
  heading.append(title,close);
  const search = element('input'); search.type = 'search'; search.placeholder = 'Buscar jogador'; search.setAttribute('aria-label','Buscar jogador no time');
  const count = element('p'), list = element('ol'); list.className = 'public-team-list';
  dialog.append(heading,element('p','Consulta dos jogadores vinculados ao time. Apenas visualização.'),search,count,list);
  document.body.append(dialog);
  let selected = null;
  const clean = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function refresh() {
    if (!selected) return;
    title.textContent = teamName(selected);
    const players = getPlayers().filter(p => p.active && p.teams.includes(selected));
    const matches = players.filter(p => clean(p.name).includes(clean(search.value))).sort((a,b) => a.name.localeCompare(b.name,'pt-BR'));
    count.textContent = `${players.length} jogador(es) vinculado(s)`;
    list.replaceChildren(...matches.map(p => element('li',p.name.toLocaleUpperCase('pt-BR'))));
    if (!matches.length) list.append(element('li',players.length ? 'Nenhum jogador encontrado.' : 'Nenhum jogador vinculado a este time.'));
  }
  search.oninput = refresh;
  return {open(id) { selected = id; search.value = ''; refresh(); dialog.showModal(); },refresh,close:() => dialog.close()};
}
