import assert from 'node:assert/strict';
import test from 'node:test';
import { startBackend } from './server.js';

test('Desktop-Backend bindet lokal und schuetzt API und Oberflaeche', async () => {
  const server = await startBackend({ accessToken: 'test-token' });
  try {
    assert.equal(server.address().address, '127.0.0.1');
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base)).status, 403);
    assert.equal((await fetch(`${base}/api/svws/meta/login`, { method: 'POST' })).status, 403);
    const response = await fetch(`${base}/api/svws/meta/login`, {
      method: 'POST',
      headers: { 'x-sfm-desktop-token': 'test-token', 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).title, 'Fehlende Login-Daten');
  } finally {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
});

test('Web-Backend bleibt ohne Desktop-Token nutzbar', async () => {
  const server = await startBackend();
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/svws/meta/login`, { method: 'POST' });
    assert.equal(response.status, 400);
  } finally {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
});
