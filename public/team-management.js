import {TEAM_COLORS} from './teams.js';
import {isActivePlayer} from './domain.js';

export function setupTeamManagement({element,isAdmin,getTeams,getPlayers,getUsers,mutate,toast}) {
  const link = element('a','⚙ Gerenciar times'); link.href = '#/gerenciar-times'; link.dataset.nav = 'gerenciar-times'; link.hidden = true;
  document.querySelector('nav').append(link);
  const page = element('section',null,'page-section'); page.dataset.page = 'gerenciar-times'; page.hidden = true;
  const heading = element('div',null,'section-heading'), intro = element('div'), title = element('h2','Gerenciar times'); title.tabIndex = -1;
  intro.append(title,element('p','Crie times e personalize nome, cor e emblema. Os vínculos e o histórico são preservados.'));
  const create = element('button','＋ Criar time','primary'); create.onclick = () => open(); heading.append(intro,create);
  const restricted = element('p','Esta página é exclusiva da administração.','notice');
  const filter = element('select'); filter.setAttribute('aria-label','Filtrar situação dos times');
  for (const [value,label] of [['active','Ativos'],['inactive','Inativos'],['deleted','Excluídos'],['all','Todos os times']]) { const option = element('option',label); option.value = value; filter.append(option); }
  filter.onchange = render;
  const filters = element('div',null,'filters'); filters.append(filter);
  const list = element('div',null,'team-management-grid'); page.append(heading,restricted,filters,list);
  document.querySelector('footer').before(page);
  const dialog = element('dialog'), dialogHeading = element('div',null,'dialog-title'), dialogTitle = element('h2'), close = element('button','×','close');
  close.type = 'button'; close.setAttribute('aria-label','Fechar'); close.onclick = () => dialog.close();
  dialogHeading.append(dialogTitle,close); const form = element('form'); dialog.append(dialogHeading,form); document.body.append(dialog);
  function usage(id) {
    return {players:getPlayers().filter(p => p.teams.includes(id)).length,active:getPlayers().filter(p => isActivePlayer(p) && p.teams.includes(id)).length,directors:getUsers().filter(u => u.role === 'director' && u.team === id).length};
  }
  function open(id = null,status = null) {
    if (!isAdmin()) return;
    const team = id ? getTeams()[id] : null;
    const labels = {active:team?.status === 'deleted' ? 'Restaurar time' : 'Ativar time',inactive:'Inativar time',deleted:'Excluir time'};
    dialogTitle.textContent = status ? labels[status] : id ? 'Editar time' : 'Criar time'; form.replaceChildren();
    if (!status) {
      const nameLabel = element('label','Nome do time'), name = element('input'); name.name = 'name'; name.required = true; name.minLength = 2; name.maxLength = 60; name.value = team?.name || ''; nameLabel.append(name);
      const colorLabel = element('label','Cor'), color = element('select'); color.name = 'color';
      for (const [value,entry] of Object.entries(TEAM_COLORS)) { const option = element('option',`${entry.badge} ${entry.label}`); option.value = value; color.append(option); }
      color.value = team?.color || 'blue'; colorLabel.append(color);
      const badgeLabel = element('label','Emblema (emoji, letra ou seta)'), badge = element('input'); badge.name = 'badge'; badge.required = true; badge.maxLength = 12; badge.value = team?.badge || TEAM_COLORS[color.value].badge; badgeLabel.append(badge);
      color.onchange = () => { badge.value = TEAM_COLORS[color.value].badge; };
      form.append(nameLabel,colorLabel,badgeLabel,element('p','Você pode manter um emblema próprio, como C ou ↑, depois de escolher a cor.'));
    } else {
      const counts = usage(id);
      form.append(element('p',`${team.name} · ${counts.players} jogadores vinculados (${counts.active} ativos) · ${counts.directors} diretores.`));
      form.append(element('p',status === 'active' ? 'O time voltará a aceitar inscrições, transferências de entrada e novos diretores.' : 'O time ficará fora da lista principal e não aceitará novas inscrições ou diretores. Os jogadores e diretores atuais continuarão vinculados. Transferências de saída seguem disponíveis durante a janela. Você poderá restaurar o time.'));
      const ack = element('label',null,'duplicate-ack'), confirm = element('input'); confirm.type = 'checkbox'; confirm.required = true; ack.append(confirm,element('span',`Confirmo a alteração para ${team.name}.`)); form.append(ack);
    }
    const error = element('p',null,'form-error'); error.setAttribute('role','alert'); const save = element('button',status ? labels[status] : 'Salvar time','primary submit'); save.type = 'submit'; form.append(error,save);
    form.onsubmit = async event => {
      event.preventDefault(); if (!isAdmin()) return;
      save.disabled = true; error.textContent = '';
      try {
        await mutate(status ? 'setTeamStatus' : id ? 'editTeam' : 'createTeam',status ? {id,status} : {id:id || `team_${crypto.randomUUID()}`,...Object.fromEntries(new FormData(form))});
        dialog.close(); toast('Time atualizado.');
      } catch(e) { error.textContent = e.message; }
      finally { save.disabled = false; }
    };
    if (!dialog.open) dialog.showModal();
  }
  function render() {
    link.hidden = !isAdmin(); create.hidden = !isAdmin(); filters.hidden = !isAdmin(); restricted.hidden = isAdmin(); list.replaceChildren();
    if (!isAdmin()) { dialog.close(); return; }
    if (page.hidden) return;
    const teams = Object.entries(getTeams()).filter(([,team]) => filter.value === 'all' || team.status === filter.value);
    if (!teams.length) list.append(element('p','Nenhum time nesta situação.'));
    for (const [id,team] of teams) {
      const card = element('article',null,'duplicate-card');
      const counts = usage(id), status = {active:'Ativo',inactive:'Inativo',deleted:'Excluído'}[team.status];
      card.append(element('h3',`${team.badge} ${team.name}`),element('p',`${status} · ${counts.players} jogadores vinculados (${counts.active} ativos) · ${counts.directors} diretores`));
      const controls = element('div',null,'team-controls');
      for (const [label,action] of team.status === 'deleted' ? [['Restaurar','active']] : [['Editar',null],[team.status === 'active' ? 'Inativar' : 'Ativar',team.status === 'active' ? 'inactive' : 'active'],['Excluir','deleted']]) {
        const button = element('button',label,'row-action'); button.onclick = () => open(id,action); controls.append(button);
      }
      card.append(controls); list.append(card);
    }
  }
  return {refresh:render};
}
