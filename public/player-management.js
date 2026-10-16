import {playerName} from './domain.js';
import {playerStatus,playerDetails,playerSuggestions} from './domain.js';

export function setupPlayerManagement({element,isAdmin,getPlayers,mutate,toast,teamName = id => id}) {
  const dialog = element('dialog'); dialog.id = 'manage-player-dialog';
  const heading = element('div',null,'dialog-title'), title = element('h2'), close = element('button','×','close');
  close.type = 'button'; close.setAttribute('aria-label','Fechar'); close.onclick = () => dialog.close();
  heading.append(title,close);
  const form = element('form'); dialog.append(heading,form); document.body.append(dialog);
  function open(player, action) {
    if (!isAdmin()) return;
    form.replaceChildren(); form.oninput = null;
    const edit = action === 'edit', deleting = action === 'deleted';
    title.textContent = edit ? 'Editar jogador' : deleting ? 'Excluir jogador' : action === 'inactive' ? 'Inativar jogador' : playerStatus(player) === 'deleted' ? 'Restaurar jogador' : 'Ativar jogador';
    form.append(element('p',`${playerName(player.name)} · ${playerName(player.congregation)} · Times: ${player.teams.map(teamName).join(', ')}`));
    if (edit) {
      for (const [key,label] of [['name','Nome completo'],['congregation','Congregação']]) {
        const field = element('label',label), input = element('input');
        input.name = key; input.value = player[key]; input.required = true; input.maxLength = 120; input.minLength = key === 'name' ? 3 : 2;
        field.append(input); form.append(field);
      }
      form.append(element('p','Os times e a situação serão preservados. Para juntar dois cadastros existentes, use Duplicidades.'));
      const suggestions = element('p'); suggestions.setAttribute('aria-live','polite');
      const suggest = () => {
        const matches = playerSuggestions(getPlayers().filter(p => p.id !== player.id),form.elements.name.value,form.elements.congregation.value);
        suggestions.textContent = matches.length ? `Confira possíveis cadastros existentes: ${matches.map(({player:p}) => `${playerName(p.name)} (${playerName(p.congregation)})`).join('; ')}.` : '';
      };
      form.oninput = suggest;
      form.append(suggestions);
    } else {
      form.append(element('p',deleting ? 'O jogador sairá da relação principal. O histórico e os times ficam preservados, e você poderá restaurá-lo pelo filtro Excluídos.' : action === 'inactive' ? 'O jogador ficará fora das listas de participantes ativos e não poderá receber novas inscrições até ser reativado. Os times serão preservados.' : 'O jogador voltará à relação de participantes ativos, com os mesmos times e o limite de duas equipes.'));
      const label = element('label',null,'duplicate-ack'), confirm = element('input'); confirm.type = 'checkbox'; confirm.required = true;
      label.append(confirm,element('span',`Confirmo a ação para ${playerName(player.name)}.`)); form.append(label);
    }
    const error = element('p',null,'form-error'); error.setAttribute('role','alert');
    const save = element('button',edit ? 'Salvar alterações' : title.textContent,'primary submit'); save.type = 'submit';
    form.append(error,save);
    form.onsubmit = async event => {
      event.preventDefault(); if (!isAdmin()) return;
      save.disabled = true; error.textContent = '';
      try {
        if (edit) await mutate('editPlayer',{id:player.id,...playerDetails(Object.fromEntries(new FormData(form)))});
        else await mutate('setPlayerStatus',{id:player.id,status:action});
        dialog.close(); toast(edit ? 'Jogador atualizado.' : 'Situação do jogador atualizada.');
      } catch(e) { error.textContent = e.message; }
      finally { save.disabled = false; }
    };
    if (!dialog.open) dialog.showModal();
  }
  return {
    actions(player) {
      const buttons = [];
      for (const [label,action] of playerStatus(player) === 'deleted' ? [['Restaurar','active']] : [['Editar','edit'],[playerStatus(player) === 'inactive' ? 'Ativar' : 'Inativar',playerStatus(player) === 'inactive' ? 'active' : 'inactive'],['Excluir','deleted']]) {
        const button = element('button',label,'row-action'); button.onclick = () => open(player,action); buttons.push(button);
      }
      return buttons;
    },
    refresh() { if (!isAdmin()) dialog.close(); }
  };
}
