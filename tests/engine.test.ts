import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, newTable, seat, start, act, view, active, settle, shuffledDeck, legal } from '../game/engine.ts';
const table = (n = 2) => { const t = newTable('test', 'Test', 9); for (let i = 0; i < n; i++)
    seat(t, `p${i}`, `Player ${i}`, 1000); return t; };
test('hand categories and wheel order', () => { const hands = ['As Ks Qs Js Ts', 'Ac Ad Ah As 2s', 'Ac Ad Ah Ks Kd', 'As Js 8s 6s 2s', '9c 8d 7h 6s 5c', 'Ac Ad Ah Ks Qd', 'Ac Ad Kh Ks Qd', 'Ac Ad Kh Qs Jd', 'Ac Kd Jh 9s 7d'].map(s => evaluate(s.split(' '))); for (let i = 0; i < hands.length - 1; i++)
    assert.ok(hands[i] > hands[i + 1]); assert.ok(evaluate('6c 5d 4h 3s 2c'.split(' ')) > evaluate('Ac 5d 4h 3s 2c'.split(' '))); assert.equal(evaluate('Ac Ad Ah Ks Kd Qc 2d'.split(' ')), hands[2]); });
test('shuffle produces a unique 52-card permutation', () => { for (let i = 0; i < 50; i++)
    assert.equal(new Set(shuffledDeck()).size, 52); });
test('heads-up button is small blind and acts first preflop, last postflop', () => { const t = table(); start(t); assert.equal(t.button, 0); assert.equal(t.seats[0].bet, 10); assert.equal(t.seats[1].bet, 20); assert.equal(t.turn, 0); act(t, 'p0', { type: 'call' }); act(t, 'p1', { type: 'check' }); assert.equal(t.phase, 'flop'); assert.equal(t.turn, 1); });
test('cannot act out of turn or check facing bet, invalid raises do not mutate', () => { const t = table(); start(t); const before = JSON.stringify(t); assert.throws(() => act(t, 'p1', { type: 'fold' })); assert.throws(() => act(t, 'p0', { type: 'check' })); assert.throws(() => act(t, 'p0', { type: 'raise', amount: 21 })); assert.throws(() => act(t, 'p0', { type: 'raise', amount: NaN })); assert.equal(JSON.stringify(t), before); });
test('full hand through showdown conserves chips and rotates dealer', () => { const t = table(6); start(t); let moves = 0; while (active(t)) {
    assert.ok(moves++ < 100);
    const p = t.seats[t.turn];
    act(t, p.id, { type: p.bet < t.current ? 'call' : 'check' });
} assert.equal(t.board.length, 5); assert.equal(t.seats.reduce((n, p) => n + p.stack, 0), 6000); assert.equal(Object.values(t.payouts).reduce((a, b) => a + b, 0), 120); start(t); assert.equal(t.button, 1); });
test('private cards and deck never enter spectator state; folded cards stay hidden', () => { const t = table(3); start(t); const v = view(t, 'spectator'); assert.ok(!('deck' in v)); assert.ok(v.seats.every(p => p.cards.every(c => c === null))); assert.equal(view(t, 'p0').seats[0].cards.filter(Boolean).length, 2); act(t, t.seats[t.turn].id, { type: 'fold' }); while (active(t))
    act(t, t.seats[t.turn].id, { type: legal(t, t.seats[t.turn].id)!.call ? 'call' : 'check' }); assert.ok(view(t, 'spectator').seats.find(p => p.folded)!.cards.every(c => c === null)); });
test('three all-ins create side pots and refund unmatched top contribution', () => { const t = table(3); t.board = '2c 3d 7h 8s 9c'.split(' '); t.seats[0].cards = ['Ac', 'Ad']; t.seats[1].cards = ['Kc', 'Kd']; t.seats[2].cards = ['Qc', 'Qd']; [100, 200, 300].forEach((n, i) => { t.seats[i].total = n; t.seats[i].stack = 1000 - n; }); settle(t); assert.deepEqual(t.payouts, { p0: 300, p1: 200, p2: 100 }); assert.equal(t.seats.reduce((s, p) => s + p.stack, 0), 3000); });
test('split pots award odd chips clockwise from dealer', () => { const t = table(3); t.button = 0; t.board = 'As Ks Qs Js Ts'.split(' '); t.seats.forEach((p, i) => { p.cards = [`${i + 2}c`, `${i + 2}d`]; p.total = 5; p.stack -= 5; }); t.seats[2].folded = true; settle(t); assert.deepEqual(t.payouts, { p1: 8, p0: 7 }); });
test('short all-in does not reopen a prior bettor; cumulative full raise does', () => { const t = table(3); start(t); act(t, 'p0', { type: 'raise', amount: 100 }); t.seats[1].stack = 110; act(t, 'p1', { type: 'raise', amount: 120 }); act(t, 'p2', { type: 'call' }); assert.equal(legal(t, 'p0')!.canRaise, false); act(t, 'p0', { type: 'call' }); assert.equal(t.phase, 'flop'); });
test('all-in runout completes without asking players with no chips', () => { const t = table(); start(t); act(t, 'p0', { type: 'raise', amount: 1000 }); act(t, 'p1', { type: 'call' }); assert.equal(t.phase, 'complete'); assert.equal(t.board.length, 5); assert.equal(t.seats.reduce((n, p) => n + p.stack, 0), 2000); });
test('fold awards pot without revealing the winner cards', () => { const t = table(); start(t); act(t, 'p0', { type: 'fold' }); assert.equal(t.seats[1].stack, 1010); assert.ok(view(t, 'spectator').seats.every(p => p.cards.every(c => c === null))); });
test('200 simulated variable-action hands preserve chip accounting', () => { for (let n = 0; n < 200; n++) {
    const t = table(2 + n % 8);
    start(t);
    let steps = 0;
    while (active(t)) {
        assert.ok(steps++ < 200);
        const id = t.seats[t.turn].id, l = legal(t, id)!;
        if ((n + steps) % 13 === 0)
            act(t, id, { type: 'fold' });
        else if (l.canRaise && (n + steps) % 7 === 0)
            act(t, id, { type: 'raise', amount: l.max });
        else
            act(t, id, { type: l.call ? 'call' : 'check' });
        assert.ok(t.seats.every(p => p.stack >= 0));
        assert.equal(t.seats.reduce((s, p) => s + p.stack + p.total, 0), t.seats.length * 1000);
    }
} });
test('a short big blind cannot force the sole funded player to call a fictional bet', () => { const t = table(); t.seats[1].stack = 5; start(t); assert.equal(t.phase, 'complete'); assert.equal(t.seats.reduce((s, p) => s + p.stack, 0), 1005); });
test('multiple short all-ins cumulatively reopen raising', () => { const t = table(4); start(t); act(t, 'p3', { type: 'raise', amount: 100 }); act(t, 'p0', { type: 'call' }); t.seats[1].stack = 140; act(t, 'p1', { type: 'raise', amount: 150 }); t.seats[2].stack = 180; act(t, 'p2', { type: 'raise', amount: 200 }); assert.equal(t.turn, 3); assert.equal(legal(t, 'p3')!.canRaise, true); assert.equal(t.minRaise, 80); });
