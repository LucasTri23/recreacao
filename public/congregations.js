import {identity,similarity,playerName} from './domain.js';
const key = value => identity(String(value || ''),'').slice(0,-1).replace(/[^a-z0-9]+/g,' ').trim();
const expanded = value => key(value).replace(/\bbh\b/g,'belo horizonte');
export function congregationOptions(players) {
  const unique = new Map();
  for (const p of players) {
    const name = playerName(p.congregation).trim().replace(/\s+/g,' ');
    if (name && !unique.has(key(name))) unique.set(key(name),name);
  }
  return [...unique.values()].sort((a,b) => a.localeCompare(b,'pt-BR'));
}
export function standardCongregation(value,known) {
  return playerName(known.find(name => key(name) === key(value)) || value).trim().replace(/\s+/g,' ');
}
export function congregationSuggestions(value,known) {
  const query = expanded(value);
  if (query.length < 2 || known.some(name => key(name) === key(value))) return [];
  return known.map(name => {
    const candidate = expanded(name);
    return {name,score:candidate.includes(query) || query.includes(candidate) ? 1 : similarity(query,candidate)};
  }).filter(item => item.score >= .6).sort((a,b) => b.score-a.score).slice(0,5).map(item => playerName(item.name));
}
export function setupCongregations({element,getPlayers}) {
  document.addEventListener('focusin',show);
  document.addEventListener('input',show);
  function show(event) {
    const input = event.target;
    if (!input.matches('input[name=congregation]') || input.readOnly) return;
    input.setAttribute('list','congregations');
    const label = input.closest('label');
    let suggestions = label.querySelector('.congregation-suggestions');
    if (!suggestions) { suggestions = element('div',null,'congregation-suggestions'); suggestions.setAttribute('aria-label','Congregações já cadastradas'); label.append(suggestions); }
    suggestions.replaceChildren();
    const matches = congregationSuggestions(input.value,congregationOptions(getPlayers()));
    if (!matches.length) return;
    suggestions.append(element('small','Já existe uma congregação parecida. É a mesma?'));
    for (const match of matches) {
      const button = element('button',`Usar ${match}`,'row-action'); button.type = 'button';
      button.onclick = () => { input.value = match; input.dispatchEvent(new Event('input',{bubbles:true})); input.focus(); };
      suggestions.append(button);
    }
  }
}
