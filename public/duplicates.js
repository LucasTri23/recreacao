import {playerSuggestions,duplicatePairs,mergedTeams,playerStatus,isActivePlayer} from './domain.js';

export function setupDuplicates({element,getPlayers,getReviews = () => [],isAdmin,openAdd,mutate,toast,teamName = id => id}) {
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
  const reviewFilter = element('select'); reviewFilter.setAttribute('aria-label','Filtrar revisões de duplicidade');
  for (const [value,label] of [['pending','Pendentes'],['completed','Pessoas diferentes · concluídas']]) { const option = element('option',label); option.value = value; reviewFilter.append(option); }
  const filters = element('div',null,'filters'); filters.append(reviewFilter); list.before(filters); reviewFilter.onchange = renderReview;
  const decision = dialog('Confirmar pessoas diferentes'), decisionForm = element('form'); decision.append(decisionForm);
  function prepareDecision(source,target) {
    decisionForm.replaceChildren();
    for (const player of [source,target]) decisionForm.append(element('strong',player.name),element('p',`${player.congregation} · ${player.teams.map(teamName).join(', ')}`));
    const ack = element('label',null,'duplicate-ack'), confirm = element('input'); confirm.type = 'checkbox'; confirm.required = true;
    ack.append(confirm,element('span','Conferi e confirmo que são duas pessoas diferentes. Este par sairá das revisões pendentes.'));
    const error = element('p',null,'form-error'); error.setAttribute('role','alert');
    const save = element('button','Salvar revisão','primary submit'); save.type = 'submit'; decisionForm.append(ack,error,save);
    decisionForm.onsubmit = async event => {
      event.preventDefault(); if (!confirm.checked || !isAdmin()) return;
      save.disabled = true; error.textContent = '';
      try { await mutate('reviewDuplicates',{sourceId:source.id,targetId:target.id,different:true}); decision.close(); toast('Revisão concluída. Você pode reabrir pelo filtro de concluídas.'); }
      catch(e) { error.textContent = e.message; }
      finally { save.disabled = false; }
    };
    decision.showModal();
  }
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
    const pairs = duplicatePairs(getPlayers(),getReviews()).filter(pair => pair.reviewed === (reviewFilter.value === 'completed')); list.replaceChildren();
    if (!pairs.length) list.append(element('p',reviewFilter.value === 'completed' ? 'Nenhuma revisão concluída para os cadastros atuais.' : 'Nenhuma possível duplicidade pendente.'));
    for (const {source,target,reviewed} of pairs) {
      const card = element('div',null,'duplicate-card');
      for (const player of [source,target]) card.append(element('strong',player.name),element('p',`${player.congregation} · Times: ${player.teams.map(teamName).join(', ')}`));
      if (reviewed) {
        card.append(element('p','Revisado: são pessoas diferentes.'));
        const reopen = element('button','Reabrir revisão','row-action'), feedback = element('p',null,'form-error'); feedback.setAttribute('role','status');
        reopen.onclick = async () => { reopen.disabled = true; try { await mutate('reviewDuplicates',{sourceId:source.id,targetId:target.id,different:false}); toast('Revisão reaberta.'); } catch(e) { feedback.textContent = e.message; } finally { reopen.disabled = false; } };
        card.append(reopen,feedback);
      } else {
        const inspect = element('button','Conferir e unificar','row-action'); inspect.onclick = () => prepareMerge(source,target);
        const different = element('button','São pessoas diferentes','row-action'); different.onclick = () => prepareDecision(source,target); card.append(inspect,different);
      }
      list.append(card);
    }
  }
  return {
    refresh() {
      button.hidden = !isAdmin();
      filters.hidden = !isAdmin();
      document.querySelector('#duplicates-restricted').hidden = isAdmin();
      if (!isAdmin()) { list.replaceChildren(); merge.close(); decision.close(); }
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
