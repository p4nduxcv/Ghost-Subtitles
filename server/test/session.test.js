import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, applyMessage, MAX_LINES, FLUENT } from '../src/session.js';

test('interim then final turns into one line and clears interim', () => {
  const s = createSession();
  applyMessage(s, { type: 'interim', id: 'u1', speaker: 'B', text: 'could you' });
  assert.equal(s.interim.text, 'could you');
  const out = applyMessage(s, { type: 'final', id: 'u1', speaker: 'B', text: '  Could you send it?  ' });
  assert.equal(out.type, 'line');
  assert.equal(s.lines.length, 1);
  assert.equal(s.lines[0].text, 'Could you send it?');
  assert.equal(s.lines[0].speaker, 'B');
  assert.equal(s.interim, null);
});

test('rejects bad ids, empty text and unknown types', () => {
  const s = createSession();
  assert.equal(applyMessage(s, { type: 'interim', id: '../x', text: 'hi' }), null);
  assert.equal(applyMessage(s, { type: 'interim', id: 'ok', text: '   ' }), null);
  assert.equal(applyMessage(s, { type: 'nope' }), null);
  assert.equal(applyMessage(s, null), null);
});

test('unknown speaker falls back to A and text is capped', () => {
  const s = createSession();
  applyMessage(s, { type: 'final', id: 'x', speaker: 'Z', text: 'a'.repeat(2000) });
  assert.equal(s.lines[0].speaker, 'A');
  assert.equal(s.lines[0].text.length, 500);
});

test('keeps only the most recent lines', () => {
  const s = createSession();
  for (let i = 0; i < MAX_LINES + 5; i++) applyMessage(s, { type: 'final', id: `l${i}`, text: `line ${i}` });
  assert.equal(s.lines.length, MAX_LINES);
  assert.equal(s.lines[0].text, 'line 5');
});

test('fluency remembers the last non-fluent level for the reveal', () => {
  const s = createSession();
  applyMessage(s, { type: 'fluency', level: 0 });
  const out = applyMessage(s, { type: 'fluency', level: FLUENT });
  assert.deepEqual(out, { type: 'fluency', level: FLUENT, compare: 0 });
  assert.equal(applyMessage(s, { type: 'fluency', level: 9 }), null);
  assert.equal(applyMessage(s, { type: 'fluency', level: 1.5 }), null);
});

test('reset clears transcript but keeps fluency', () => {
  const s = createSession();
  applyMessage(s, { type: 'fluency', level: 3 });
  applyMessage(s, { type: 'final', id: 'a', text: 'hello' });
  applyMessage(s, { type: 'reset' });
  assert.equal(s.lines.length, 0);
  assert.equal(s.level, 3);
});
