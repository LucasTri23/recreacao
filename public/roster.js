import {isActivePlayer,playerName} from './domain.js';

export function rosterData(players,teams,selected = '') {
  const ids = selected ? Object.hasOwn(teams,selected) ? [selected] : [] : Object.keys(teams).filter(id => teams[id].status === 'active');
  return ids.map(id => ({id,name:teams[id].name,status:teams[id].status,players:players.filter(p => isActivePlayer(p) && p.teams.includes(id)).sort((a,b) => a.name.localeCompare(b.name,'pt-BR')).map(p => ({name:playerName(p.name),congregation:p.congregation,teams:p.teams.map(t => teams[t]?.name || t)}))})).sort((a,b) => a.name.localeCompare(b.name,'pt-BR'));
}
export function rosterCsv(roster,date = new Date()) {
  const cell = value => {
    let text = String(value);
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g,'""')}"`;
  };
  const stamp = date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  const rows = [['Time','Situação do time','Jogador','Congregação','Times do jogador','Gerado em (Brasília)']];
  const labels = {active:'Ativo',inactive:'Inativo',deleted:'Excluído'};
  for (const team of roster) {
    if (!team.players.length) rows.push([team.name,labels[team.status],'Sem jogadores ativos','','',stamp]);
    for (const p of team.players) rows.push([team.name,labels[team.status],p.name,p.congregation,p.teams.join(', '),stamp]);
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n');
}
const escape = value => String(value).replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function rosterBody(roster,date) {
  const stamp = date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  return `<h1>Relação dos times · Recreação</h1><p>Gerada em ${escape(stamp)} (Brasília). Apenas jogadores ativos. Confira atualizações antes do evento.</p>${roster.length ? roster.map(team => `<section class="roster-team"><h2>${escape(team.name)} · ${team.players.length} jogadores${team.status === 'active' ? '' : ' · Time inativo/excluído'}</h2><table><thead><tr><th>Nº</th><th>Jogador</th><th>Congregação</th><th>Times do jogador</th><th>Conferido</th></tr></thead><tbody>${team.players.map((p,i) => `<tr><td>${i+1}</td><td>${escape(p.name)}</td><td>${escape(p.congregation)}</td><td>${escape(p.teams.join(', '))}</td><td>☐</td></tr>`).join('')}</tbody></table>${team.players.length ? '' : '<p>Sem jogadores ativos neste time.</p>'}</section>`).join('') : '<p>Nenhum time disponível.</p>'}`;
}
export const rosterStyles = `body{font:14px Arial,sans-serif;color:#17251d;background:white;margin:24px}h1{font-size:24px}h2{font-size:18px;margin-top:28px}p{line-height:1.6}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:9px;text-align:left;overflow-wrap:anywhere}th{background:#eee}tr{break-inside:avoid}.roster-team{break-before:page}.roster-team:first-of-type{break-before:auto}thead{display:table-header-group}@page{size:A4 landscape;margin:12mm}@media print{.print-button{display:none}body{margin:0}}`;
export function rosterHtml(roster,date = new Date()) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relação dos times · Recreação</title><style>${rosterStyles}</style></head><body><button class="print-button" onclick="window.print()">Imprimir / salvar PDF</button>${rosterBody(roster,date)}</body></html>`;
}
export function setupRoster({element,getPlayers,getTeams,canExport,toast}) {
  const dialog = element('dialog'); const form = element('div'), title = element('div',null,'dialog-title'), close = element('button','×','close'); close.setAttribute('aria-label','Fechar'); close.onclick = () => dialog.close();
  title.append(element('h2','Exportar relação dos times'),close);
  const label = element('label','Time'), select = element('select'); label.append(select);
  const notice = element('p','Escolha um time ou todos os times ativos. São incluídos apenas jogadores ativos, em ordem alfabética. A relação offline pode ser aberta sem internet.');
  const summary = element('p'); summary.setAttribute('role','status');
  function getRoster() { if (!canExport()) throw Error('Aguarde o carregamento dos times e jogadores com uma conta autorizada.'); return rosterData(getPlayers(),getTeams(),select.value); }
  function download(content,type,extension) {
    const url = URL.createObjectURL(new Blob([content],{type})), link = element('a'); link.href = url; link.download = `recreacao-relacao-${new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})}.${extension}`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  const buttons = element('div',null,'export-controls');
  for (const [text,action] of [['Baixar CSV',() => download(rosterCsv(getRoster()),'text/csv;charset=utf-8','csv')],['Baixar relação offline',() => download(rosterHtml(getRoster()),'text/html;charset=utf-8','html')],['Imprimir / salvar PDF',() => {
    const frame = element('iframe'); frame.title = 'Impressão da relação'; frame.className = 'roster-frame';
    frame.onload = () => { frame.contentWindow.addEventListener('afterprint',() => frame.remove(),{once:true}); frame.contentWindow.focus(); frame.contentWindow.print(); };
    frame.srcdoc = rosterHtml(getRoster()); document.body.append(frame); setTimeout(() => frame.remove(),300000);
  }]]) {
    const button = element('button',text,'primary'); button.onclick = () => { try { action(); } catch(e) { toast(e.message); } }; buttons.append(button);
  }
  form.append(notice,label,summary,buttons); dialog.append(title,form); document.body.append(dialog);
  const triggers = [];
  for (const parent of ['#times .section-heading','#jogadores .section-heading']) {
    const button = element('button','Exportar / imprimir','row-action'); document.querySelector(parent).append(button); triggers.push(button);
    button.onclick = () => {
      select.replaceChildren(); const all = element('option','Todos os times ativos'); all.value = ''; select.append(all);
      for (const [id,team] of Object.entries(getTeams())) { const option = element('option',team.name + (team.status === 'active' ? '' : ' · inativo/excluído')); option.value = id; select.append(option); }
      select.value = document.querySelector('#team-filter').value || ''; updateSummary(); dialog.showModal();
    };
  }
  function updateSummary() { try { const roster = getRoster(); summary.textContent = `${roster.length} times · ${roster.reduce((n,t) => n+t.players.length,0)} inscrições de jogadores ativos.`; } catch(e) { summary.textContent = e.message; } }
  select.onchange = updateSummary;
  return {refresh() { triggers.forEach(button => button.disabled = !canExport()); if (!canExport()) { dialog.close(); document.querySelectorAll('.roster-frame').forEach(frame => frame.remove()); } else if (dialog.open) updateSummary(); }};
}
