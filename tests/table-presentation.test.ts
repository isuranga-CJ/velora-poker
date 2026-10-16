import test from 'node:test';
import assert from 'node:assert/strict';
import { bestVisibleFive, collectedBets, latestAction } from '../lib/table-presentation.ts';
import { newTable, seat, start, view, type TableView } from '../game/engine.ts';

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
