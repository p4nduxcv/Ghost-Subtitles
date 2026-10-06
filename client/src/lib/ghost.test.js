import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, FLUENT, isKept, ghostLine, transcriptStats } from './ghost.js';

const corpus = `Could you send me the report before tomorrow's meeting so we can go through it?
Sure, I still need to update the budget figures, but I'll have it ready by tonight.
Great. Did Maria confirm whether the client is joining us in person or online?
She said online, so we should test the screen sharing first thing in the morning.
Good idea. Let's meet ten minutes early and run through the slides together.
I think the new design works better on phones, but the desktop layout needs more space.
We could ask the team what they want before we decide anything about the launch date.`;

const lines = [];
for (let r = 0; r < 40; r++) corpus.split('\n').forEach((text, i) => lines.push({ id: `r${r}-${i}`, text }));

test('share of kept words is close to each level', () => {
  for (let lv = 0; lv < FLUENT; lv++) {
    const { total, caught } = transcriptStats(lines, lv, lv);
    const share = caught / total;
    assert.ok(Math.abs(share - LEVELS[lv].keep) < 0.06, `${LEVELS[lv].label}: kept ${share.toFixed(3)}`);
  }
});

test('a higher level always keeps a superset of words', () => {
  for (const line of lines.slice(0, 50)) {
    line.text.split(' ').forEach((w, i) => {
      for (let lv = 1; lv < LEVELS.length; lv++) {
        for (const p of [0.2, 0.5, 0.8]) {
          if (isKept(line.id, i, w, LEVELS[lv - 1].keep, p)) assert.ok(isKept(line.id, i, w, LEVELS[lv].keep, p));
        }
      }
    });
  }
});

test('common words survive more often than rare ones', () => {
  let the = 0, theKept = 0, rare = 0, rareKept = 0;
  for (const line of lines) {
    line.text.split(' ').forEach((w, i) => {
      if (w === 'the') { the++; if (isKept(line.id, i, w, 0.5)) theKept++; }
      if (w === 'budget') { rare++; if (isKept(line.id, i, w, 0.5)) rareKept++; }
    });
  }
  assert.ok(theKept / the > rareKept / rare);
});

test('fluent shows every word and highlights the ones missed earlier', () => {
  const line = { id: 'x', text: 'Could you send me the report before tomorrow’s meeting?' };
  const lost = ghostLine(line, 0, 0);
  const fluent = ghostLine(line, FLUENT, 0);
  assert.equal(fluent.tokens.length, 9);
  const missed = fluent.tokens.filter((t) => t.kind === 'missed').length;
  assert.equal(missed, lost.total - lost.caught);
});

test('ellipsis gaps collapse, ghost gaps keep every word', () => {
  const line = { id: 'y', text: 'one two three four five six seven eight nine ten eleven twelve' };
  const ell = ghostLine(line, 0, 0, 'ellipsis');
  for (let i = 1; i < ell.tokens.length; i++) {
    assert.ok(!(ell.tokens[i].kind === 'gap' && ell.tokens[i - 1].kind === 'gap'));
  }
  assert.equal(ghostLine(line, 0, 0, 'ghost').tokens.length, 12);
});
