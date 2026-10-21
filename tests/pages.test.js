import {test} from 'node:test';
import assert from 'node:assert/strict';
import {currentPage,PUBLIC_PAGES} from '../public/pages.js';
test('visitantes consultam somente times, jogos e movimentações',() => {
  assert.deepEqual(PUBLIC_PAGES,['times','dia-de-jogo','movimentacoes']);
  for (const page of ['jogadores','gerenciar-acessos','gerenciar-rodada','duplicidades']) assert.equal(PUBLIC_PAGES.includes(page),false);
});
test('configuração da rodada e acessos possuem endereços separados da consulta pública', () => {
  for (const page of ['gerenciar-rodada','gerenciar-acessos','dia-de-jogo']) assert.equal(currentPage('#/'+page),page);
  assert.equal(currentPage('#/inexistente'),'times');
});
