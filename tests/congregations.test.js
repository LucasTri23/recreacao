import {test} from 'node:test';
import assert from 'node:assert/strict';
import {congregationOptions,standardCongregation,congregationSuggestions} from '../public/congregations.js';
test('lista congregações sem repetir caixa, acentos ou separadores e preserva a grafia existente',() => {
  const known = congregationOptions([{congregation:'Tirol - BH'},{congregation:'TIROL BH'},{congregation:' Belém '},{congregation:'belem'},{congregation:''}]);
  assert.deepEqual(known,['Belém','Tirol - BH']);
  assert.equal(standardCongregation('tirol bh',known),'Tirol - BH');
  assert.equal(standardCongregation('Nova congregação',known),'Nova congregação');
});
test('sugere cidade abreviada e erro de digitação, sem trocar congregações diferentes automaticamente',() => {
  const known = ['Tirol - BH','Centro - Sabará'];
  assert.equal(congregationSuggestions('Tirol Belo Horizonte',known)[0],'Tirol - BH');
  assert.equal(congregationSuggestions('Tirol',known)[0],'Tirol - BH');
  assert.equal(standardCongregation('Tirol Belo Horizonte',known),'Tirol Belo Horizonte');
  assert.deepEqual(congregationSuggestions('tirol bh',known),[]);
});
