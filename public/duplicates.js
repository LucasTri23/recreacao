import {playerSuggestions,duplicatePairs,mergedTeams,playerStatus,isActivePlayer} from './domain.js';

export function setupDuplicates({element,getPlayers,isAdmin,openAdd,mutate,toast,teamName = id => id}) {
  const form = document.querySelector('#player-form');
  const name = form.elements.name, congregation = form.elements.congregation;
  const suggestions = element('div',null,'player-suggestions');
  suggestions.setAttribute('aria-live','polite');
  congregation.closest('label').after(suggestions);
  const acknowledgement = element('label',null,'duplicate-ack');
  const checkbox = element('input'); checkbox.type = 'checkbox';
  acknowledgement.append(checkbox,element('span','Conferi os cadastros acima e confirmo que é outra pessoa.'));
  suggestions.after(acknowledgement);
  let signature = '';
  function suggest() {
    const candidates = name.readOnly ? [] : playerSuggestions(getPlayers(),name.value,congregation.value);
    const nextSignature = JSON.stringify([name.value,congregation.value,candidates.map(({player}) => [player.id,player.teams])]);
    if (nextSignature !== signature) checkbox.checked = false;
    signature = nextSignature;
    suggestions.replaceChildren(); acknowledgement.hidden = !candidates.length;
    if (!candidates.length) return;
    suggestions.append(element('strong','Possível cadastro existente. É a mesma pessoa?'));
    for (const {player} of candidates) {
      const card = element('div',null,'duplicate-card');
      card.append(element('strong',player.name),element('p',`${player.congregation} · Times: ${player.teams.map(teamName).join(', ')}`));
      if (!isActivePlayer(player)) card.append(element('p',playerStatus(player) === 'deleted' ? 'Cadastro excluído: peça à administração para restaurá-lo.' : 'Jogador inativo: peça à administração para reativá-lo.'));
      const use = element('button','É a mesma pessoa · usar cadastro','row-action'); use.type = 'button';
      use.onclick = () => {
        if (!isActivePlayer(player)) return toast('Peça à administração para reativar ou restaurar este cadastro.');
        if (player.teams.length >= 2) return toast('Este irmão já participa de dois times. Não crie outro cadastro para inscrevê-lo novamente.');
        const dialog = form.closest('dialog'); dialog.close(); openAdd(player);
      };
      card.append(use);
      if (player.teams.length >= 2) card.append(element('p','Limite de dois times atingido.'));
      suggestions.append(card);
    }
  }
  name.addEventListener('input',suggest); congregation.addEventListener('input',suggest);
  const button = document.querySelector('#duplicates-link');
  function dialog(title) {
    const result = element('dialog',null,'duplicate-dialog');
    const heading = element('div',null,'dialog-title'), close = element('button','×','close');
    close.type = 'button'; close.setAttribute('aria-label','Fechar'); close.onclick = () => result.close();
    heading.append(element('h2',title),close); result.append(heading); document.body.append(result); return result;
  }
  const review = document.querySelector('#duplicates-page');
  const list = document.querySelector('#duplicates-list');
  const merge = dialog('Confirmar unificação');
  const mergeForm = element('form'); merge.append(mergeForm);
  let selectedPair = null;
  function prepareMerge(source,target) {
    selectedPair = {source,target}; mergeForm.replaceChildren();
    const label = element('label','Cadastro que será mantido');
    const select = element('select');
    for (const player of [target,source]) {
      const option = element('option',`${player.name} · ${player.congregation}`); option.value = player.id; select.append(option);
    }
    label.append(select);
    const preview = element('div',null,'duplicate-card'), ack = element('label',null,'duplicate-ack');
    const confirmed = element('input'); confirmed.type = 'checkbox'; confirmed.required = true;
    ack.append(confirmed,element('span','Conferi: os dois cadastros pertencem ao mesmo irmão.'));
    const error = element('p',null,'form-error'); error.setAttribute('role','alert');
    const save = element('button','Unificar cadastros','primary'); save.type = 'submit';
    function updatePreview() {
      confirmed.checked = false; preview.replaceChildren(); error.textContent = '';
      const keep = select.value === target.id ? target : source, archive = keep === target ? source : target;
      preview.append(element('p',`Manter: ${keep.name} · ${keep.congregation}`),element('p',`Unificar: ${archive.name} · ${archive.congregation}`));
      try { preview.append(element('strong',`Times após unificar: ${mergedTeams(archive,keep).map(teamName).join(', ')}`)); save.disabled = false; }
      catch(e) { error.textContent = e.message; save.disabled = true; }
      preview.append(element('p','O cadastro duplicado ficará arquivado. O histórico será preservado e novas inscrições pelo nome antigo usarão o cadastro mantido.'));
    }
    select.onchange = updatePreview;
    mergeForm.append(label,preview,ack,error,save); updatePreview();
    mergeForm.onsubmit = async event => {
      event.preventDefault(); if (!confirmed.checked || !isAdmin()) return;
      save.disabled = true; select.disabled = true;
      try {
        await mutate('mergePlayers',{sourceId:select.value === target.id ? source.id : target.id,targetId:select.value});
        merge.close(); toast('Cadastros unificados. O histórico foi preservado.');
      } catch(e) { error.textContent = e.message; }
      finally { save.disabled = false; select.disabled = false; }
    };
    if (!merge.open) merge.showModal();
  }
  function renderReview() {
    const pairs = duplicatePairs(getPlayers()); list.replaceChildren();
    if (!pairs.length) list.append(element('p','Nenhuma possível duplicidade encontrada.'));
    for (const {source,target} of pairs) {
      const card = element('div',null,'duplicate-card');
      for (const player of [source,target]) card.append(element('strong',player.name),element('p',`${player.congregation} · Times: ${player.teams.map(teamName).join(', ')}`));
      const inspect = element('button','Conferir e unificar','row-action'); inspect.onclick = () => prepareMerge(source,target); card.append(inspect); list.append(card);
    }
  }
  return {
    refresh() {
      button.hidden = !isAdmin();
      document.querySelector('#duplicates-restricted').hidden = isAdmin();
      if (!isAdmin()) { list.replaceChildren(); merge.close(); }
      else if (!review.hidden) renderReview();
      if (merge.open && selectedPair && [selectedPair.source,selectedPair.target].some(p => !getPlayers().some(current => current.id === p.id))) merge.close();
      if (form.closest('dialog').open) suggest();
    },
    suggest,
    validate() {
      suggest();
      if (!acknowledgement.hidden && !checkbox.checked) throw Error('Confira os possíveis cadastros existentes. Se for outra pessoa, marque a confirmação antes de cadastrar.');
    }
  };
}
