export function goalkeeperToggle(element,checked = false) {
  const label = element('label',null,'goalkeeper-toggle'), input = element('input'); input.type = 'checkbox'; input.name = 'goalkeeper'; input.checked = checked;
  const content = element('span',null,'goalkeeper-toggle-content');
  content.append(element('strong','🧤 Ele é GOLEIRO?'),element('span','Goleiros podem participar de quantos times precisarem.'));
  label.append(input,content); return label;
}
