import {test} from 'node:test';
import assert from 'node:assert/strict';
import {currentPage} from '../public/pages.js';
test('configuração da rodada e acessos possuem endereços separados da consulta pública', () => {
  for (const page of ['gerenciar-rodada','gerenciar-acessos','dia-de-jogo']) assert.equal(currentPage('#/'+page),page);
  assert.equal(currentPage('#/inexistente'),'times');
});
