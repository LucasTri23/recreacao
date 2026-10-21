export const CITIES = ['Belo Horizonte','Baldim','Betim','Caeté','Capim Branco','Confins','Contagem','Conselheiro Lafaiete','Esmeraldas','Florestal','Ibirité','Igarapé','Itaguara','Itatiaiuçu','Jaboticatubas','Juatuba','Lagoa Santa','Mário Campos','Mateus Leme','Matozinhos','Nova Lima','Nova União','Pedro Leopoldo','Raposos','Ribeirão das Neves','Rio Acima','Rio Manso','Sabará','Santa Luzia','São Joaquim de Bicas','São José da Lapa','Sarzedo','Sete Lagoas','Taquaraçu de Minas','Vespasiano'];
const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export function cityName(value) { return CITIES.find(city => key(city) === key(value)) || (key(value) === 'bh' ? 'Belo Horizonte' : ''); }
export function splitCongregation(value) {
  const text = String(value || '').trim(), match = text.match(/^(.*\S)\s*[-–—]\s*(.+)$/);
  const city = match && cityName(match[2]);
  if (!city) return {congregation:text,city:''};
  let congregation = match[1].trim(), previous;
  while ((previous = congregation.match(/^(.*\S)\s*[-–—]\s*(.+)$/)) && cityName(previous[2]) === city) congregation = previous[1].trim();
  return {congregation,city};
}
export function normalizeRepeatedCity(value) {
  const text = String(value || '').trim(), match = text.match(/^(.*\S)\s*[-–—]\s*(.+)$/), parts = splitCongregation(text);
  return parts.city && key(match[1]) !== key(parts.congregation) ? `${parts.congregation} - ${parts.city}` : text;
}
export function cityCongregation(value,city,known = []) {
  if (!CITIES.includes(city)) throw Error('Escolha uma cidade da lista.');
  const parts = splitCongregation(value), congregation = parts.congregation;
  if (congregation.length < 2) throw Error('Informe o nome da congregação.');
  if (parts.city && parts.city !== city) throw Error('A cidade no texto da congregação é diferente da cidade selecionada.');
  const existing = known.find(item => { const p = splitCongregation(item); return p.city === city && key(p.congregation) === key(congregation); });
  const combined = normalizeRepeatedCity(existing || `${congregation} - ${city}`).replace(/\bBH\s*$/i,'BELO HORIZONTE').toLocaleUpperCase('pt-BR').trim().replace(/\s+/g,' ');
  if (combined.length > 120) throw Error('Congregação e cidade devem somar até 120 caracteres.');
  return {congregation:combined,city};
}
export function citySelect(element,value = '') {
  const label = element('label','Cidade'), select = element('select'); select.name = 'city'; select.required = true;
  const empty = element('option','Selecione a cidade'); empty.value = ''; select.append(empty);
  for (const city of CITIES) { const option = element('option',city); option.value = city; select.append(option); }
  select.value = value; label.append(select); return label;
}
