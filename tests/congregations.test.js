import {test} from 'node:test';
import assert from 'node:assert/strict';
import {congregationOptions,standardCongregation,congregationSuggestions} from '../public/congregations.js';
test('lista congregações sem repetir caixa, acentos ou separadores e preserva a grafia existente',() => {
  const known = congregationOptions([{congregation:'Tirol - BH'},{congregation:'TIROL BH'},{congregation:' Belém '},{congregation:'belem'},{congregation:''}]);
  assert.deepEqual(known,['BELÉM','TIROL - BELO HORIZONTE']);
  assert.equal(standardCongregation('tirol bh',known),'TIROL - BELO HORIZONTE');
  assert.equal(standardCongregation('Nova congregação',known),'NOVA CONGREGAÇÃO');
});
test('sugere cidade abreviada e erro de digitação, sem trocar congregações diferentes automaticamente',() => {
  const known = ['Tirol - BH','Centro - Sabará'];
  assert.deepEqual(congregationSuggestions('Tirol Belo Horizonte',known),[]);
  assert.equal(congregationSuggestions('Tirol',known)[0],'TIROL - BELO HORIZONTE');
  assert.equal(standardCongregation('Tirol Belo Horizonte',known),'TIROL - BELO HORIZONTE');
  assert.deepEqual(congregationSuggestions('tirol bh',known),[]);
});
