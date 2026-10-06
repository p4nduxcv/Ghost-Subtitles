import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createServer } from '../src/index.js';

function connect(port, query) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?${query}`);
    const inbox = [];
    const waiters = [];
    ws.on('message', (d) => {
      const msg = JSON.parse(d.toString());
      const i = waiters.findIndex((w) => w.pred(msg));
      if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
      else inbox.push(msg);
    });
    ws.next = (pred) => {
      const i = inbox.findIndex(pred);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((res) => waiters.push({ pred, resolve: res }));
    };
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

test('controller captions reach the display in the same room only', async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  const display = await connect(port, 'room=class&role=display');
  const other = await connect(port, 'room=other&role=display');
  const controller = await connect(port, 'room=class&role=controller');

  const initial = await display.next((m) => m.type === 'state');
  assert.deepEqual(initial.lines, []);

  controller.send(JSON.stringify({ type: 'final', id: 'u1', speaker: 'A', text: 'Hello there' }));
  const line = await display.next((m) => m.type === 'line');
  assert.equal(line.line.text, 'Hello there');

  controller.send(JSON.stringify({ type: 'fluency', level: 5 }));
  const fl = await display.next((m) => m.type === 'fluency');
  assert.equal(fl.level, 5);
  assert.equal(fl.compare, 1);

  // Displays cannot change state.
  display.send(JSON.stringify({ type: 'reset' }));
  // A late joiner gets the full transcript.
  const late = await connect(port, 'room=class&role=display');
  const snap = await late.next((m) => m.type === 'state');
  assert.equal(snap.lines.length, 1);
  assert.equal(snap.level, 5);

  // Other room saw nothing but its own state + presence.
  await new Promise((r) => setTimeout(r, 50));
  const otherSnap = await other.next((m) => m.type === 'state');
  assert.equal(otherSnap.lines.length, 0);

  for (const ws of [display, other, controller, late]) ws.close();
  await new Promise((r) => server.close(r));
});
