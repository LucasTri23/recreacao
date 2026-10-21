import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {setupNotifications} from '../public/notifications.js';
test('notificação some em cinco segundos e cada nova mensagem reinicia o prazo',t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const {document} = parseHTML('<html><body><div id="mode-notice"></div><div id="toast" role="status"></div></body></html>');
  const toast = setupNotifications(document), box = document.querySelector('#toast'); t.after(toast.dispose);
  toast('Salvo'); t.mock.timers.tick(4999); assert.equal(box.style.display,'block');
  toast('Atualizado'); t.mock.timers.tick(1); assert.equal(box.style.display,'block');
  assert.equal(box.textContent,'Atualizado'); t.mock.timers.tick(4999); assert.equal(box.style.display,'none');
  assert.equal(box.getAttribute('aria-live'),'polite');
});
