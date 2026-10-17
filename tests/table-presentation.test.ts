import test from 'node:test';
import assert from 'node:assert/strict';
import { bestVisibleFive, collectedBets, latestAction, winnerHandLabel } from '../lib/table-presentation.ts';
import { newTable, seat, start, view, type TableView } from '../game/engine.ts';
import { portraitPositions } from '../lib/table-layout.ts';

test('portrait seats put the viewer below the board with opponents on the side rails', () => {
  for (const capacity of [2, 5, 6, 9]) {
    const coords = portraitPositions(capacity);
    assert.equal(coords.length, capacity);
    assert.equal(new Set(coords.map(c => c.join(','))).size, capacity);
    assert.equal(coords[0][0], 50);
    assert.ok(coords[0][1] >= 80);
    for (const [x, y] of coords.slice(1)) {
      assert.ok(x <= 16 || x >= 84);
      assert.ok(y >= 30 && y <= 75);
    }
  }
});

test('best-five highlights use kickers and never invent hidden cards', () => {
  assert.deepEqual(new Set(bestVisibleFive(['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '2h'])), new Set(['As', 'Ks', 'Qs', 'Js', 'Ts']));
  assert.deepEqual(new Set(bestVisibleFive(['Ah', 'Ad', 'Ks', 'Qh', 'Jc', '2d', '3h'])), new Set(['Ah', 'Ad', 'Ks', 'Qh', 'Jc']));
  assert.deepEqual(bestVisibleFive([null, null, 'As', 'Kh', 'Qd']), []);
  assert.deepEqual(bestVisibleFive(['As', 'As', 'Qh', 'Jc', 'Ts']), []);
  // A board-only best hand is valid even when both private cards are hidden.
  assert.equal(bestVisibleFive([null, null, 'As', 'Ks', 'Qs', 'Js', 'Ts']).length, 5);
});

function snapshot() {
  const t = newTable('presentation', 'Test');
  seat(t, 'a', 'Alice', 1000); seat(t, 'b', 'Bob', 1000); start(t);
  return structuredClone(view(t, 'a'));
}
test('chip collection occurs only across a street change in the same hand', () => {
  const before = snapshot();
  const after: TableView = { ...before, phase: 'flop', board: ['As', 'Kd', 'Jh'] };
  assert.deepEqual(new Set(collectedBets(before, after)), new Set(['a', 'b']));
  assert.deepEqual(collectedBets(null, after), []);
  assert.deepEqual(collectedBets(after, after), []);
  assert.deepEqual(collectedBets(before, { ...after, handId: 'another-hand' }), []);
  assert.deepEqual(collectedBets(before, { ...after, id: 'another-table' }), []);
  assert.deepEqual(collectedBets(before, { ...after, phase: 'complete' }), []);
});
test('public action labels handle names containing punctuation without HTML', () => {
  const t = snapshot();
  t.history = ['A: B: raise 200'];
  assert.deepEqual(latestAction(t), { name: 'A: B', move: 'raise', label: 'RAISE 200' });
  t.history = ['Bob: check'];
  assert.equal(latestAction(t)?.label, 'CHECK');
  t.history = ['Hand started'];
  assert.equal(latestAction(t), null);
});

test('winner rank uses revealed cards, distinguishes folds, and clears next hand', () => {
  const t = snapshot();
  t.phase = 'complete'; t.payouts = { a: 200 };
  t.board = ['Ts', 'Js', 'Qs', '2d', '3h'];
  t.seats[0].cards = ['As', 'Ks'];
  assert.equal(winnerHandLabel(t, 'a'), 'ROYAL FLUSH');
  t.board = ['Ts', 'Js', 'Qs', '2s', '3h'];
  t.seats[0].cards = ['8s', 'Ks'];
  assert.equal(winnerHandLabel(t, 'a'), 'FLUSH');
  t.seats[0].cards = [null, null];
  assert.equal(winnerHandLabel(t, 'a'), 'HAND NOT SHOWN');
  t.seats[1].folded = true;
  assert.equal(winnerHandLabel(t, 'a'), 'WON BY FOLD');
  assert.equal(winnerHandLabel(t, 'b'), null);
  t.phase = 'preflop';
  assert.equal(winnerHandLabel(t, 'a'), null);
});
