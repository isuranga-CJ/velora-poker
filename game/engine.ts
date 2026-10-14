import { randomInt, randomUUID } from 'node:crypto';
export type Card = string;
export type Player = {
    id: string;
    name: string;
    stack: number;
    bet: number;
    total: number;
    cards: Card[];
    folded: boolean;
    acted: boolean;
    actedAt: number;
    connected: boolean;
};
export type Move = {
    type: 'fold' | 'check' | 'call' | 'raise';
    amount?: number;
};
export type Table = {
    id: string;
    name: string;
    seats: Player[];
    capacity: number;
    small: number;
    big: number;
    button: number;
    turn: number;
    phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'complete';
    board: Card[];
    deck: Card[];
    current: number;
    minRaise: number;
    handId: string;
    version: number;
    deadline: number;
    payouts: Record<string, number>;
    history: string[];
};
export const ranks = '23456789TJQKA';
export function shuffledDeck(): Card[] { const d = [...'cdhs'].flatMap(s => [...ranks].map(r => r + s)); for (let i = d.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
} return d; }
export function score5(cards: Card[]): number {
    const r = cards.map(c => ranks.indexOf(c[0]) + 2).sort((a, b) => b - a);
    const counts = new Map<number, number>();
    r.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    const g = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const flush = cards.every(c => c[1] === cards[0][1]);
    const unique = [...new Set(r)];
    const straight = unique.length === 5 && (r[0] - r[4] === 4 ? r[0] : r.join(',') === '14,5,4,3,2' ? 5 : 0);
    let v: number[];
    if (flush && straight)
        v = [8, Number(straight)];
    else if (g[0][1] === 4)
        v = [7, g[0][0], g[1][0]];
    else if (g[0][1] === 3 && g[1][1] === 2)
        v = [6, g[0][0], g[1][0]];
    else if (flush)
        v = [5, ...r];
    else if (straight)
        v = [4, Number(straight)];
    else if (g[0][1] === 3)
        v = [3, ...g.map(x => x[0])];
    else if (g[0][1] === 2 && g[1][1] === 2)
        v = [2, ...g.map(x => x[0])];
    else if (g[0][1] === 2)
        v = [1, ...g.map(x => x[0])];
    else
        v = [0, ...r];
    while (v.length < 6)
        v.push(0);
    return v.reduce((n, x) => n * 15 + x, 0);
}
export function evaluate(cards: Card[]): number { if (cards.length < 5 || cards.length > 7 || new Set(cards).size !== cards.length || cards.some(c => !/^([2-9TJQKA])[cdhs]$/.test(c)))
    throw Error('Invalid evaluation cards'); let best = 0; for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
        for (let c = b + 1; c < cards.length - 2; c++)
            for (let d = c + 1; d < cards.length - 1; d++)
                for (let e = d + 1; e < cards.length; e++)
                    best = Math.max(best, score5([cards[a], cards[b], cards[c], cards[d], cards[e]])); return best; }
export function newTable(id: string, name: string, capacity = 6): Table { return { id, name, capacity, seats: [], small: 10, big: 20, button: -1, turn: -1, phase: 'waiting', board: [], deck: [], current: 0, minRaise: 20, handId: '', version: 0, deadline: 0, payouts: {}, history: [] }; }
export const active = (t: Table) => !['waiting', 'complete'].includes(t.phase);
const next = (t: Table, i: number, predicate: (p: Player) => boolean) => { for (let n = 1; n <= t.seats.length; n++) {
    const j = (i + n) % t.seats.length;
    if (predicate(t.seats[j]))
        return j;
} return -1; };
function pay(p: Player, n: number) { const v = Math.min(p.stack, n); p.stack -= v; p.bet += v; p.total += v; }
export function seat(t: Table, id: string, name: string, buyIn: number) { if (active(t))
    throw Error('Wait until this hand finishes'); if (t.seats.some(p => p.id === id))
    throw Error('Already seated'); if (t.seats.length >= t.capacity)
    throw Error('Table full'); if (!Number.isSafeInteger(buyIn) || buyIn < 400 || buyIn > 2000)
    throw Error('Buy-in must be 400–2,000'); t.seats.push({ id, name, stack: buyIn, bet: 0, total: 0, cards: [], folded: false, acted: false, actedAt: -1, connected: true }); t.version++; }
export function start(t: Table) {
    if (active(t))
        throw Error('Hand already running');
    if (t.seats.filter(p => p.stack > 0 && p.connected).length < 2)
        throw Error('Two connected players with chips are needed');
    t.seats.forEach(p => { p.cards = []; p.bet = 0; p.total = 0; p.folded = p.stack === 0 || !p.connected; p.acted = false; p.actedAt = -1; });
    t.button = next(t, t.button, p => !p.folded);
    t.deck = shuffledDeck();
    t.board = [];
    t.phase = 'preflop';
    t.handId = randomUUID();
    t.payouts = {};
    t.history = [];
    t.minRaise = t.big;
    t.current = t.big;
    for (let round = 0; round < 2; round++) {
        let i = t.button;
        for (let k = 0; k < t.seats.filter(p => !p.folded).length; k++) {
            i = next(t, i, p => !p.folded);
            t.seats[i].cards.push(t.deck.pop()!);
        }
    }
    const heads = t.seats.filter(p => !p.folded).length === 2;
    const sb = heads ? t.button : next(t, t.button, p => !p.folded), bb = next(t, sb, p => !p.folded);
    pay(t.seats[sb], t.small);
    pay(t.seats[bb], t.big);
    if (t.seats.filter(p => !p.folded && p.stack > 0).length <= 1)
        t.current = Math.max(...t.seats.map(p => p.bet));
    t.turn = next(t, bb, p => !p.folded && p.stack > 0);
    t.version++;
    advance(t);
}
export function legal(t: Table, id: string) { const p = t.seats[t.turn]; if (!active(t) || !p || p.id !== id)
    return null; const call = Math.min(p.stack, Math.max(0, t.current - p.bet)); const max = p.bet + p.stack; const rights = p.actedAt < 0 || t.current - p.actedAt >= t.minRaise; const opponent = t.seats.some(q => q.id !== id && !q.folded && q.stack > 0); return { call, min: t.current + t.minRaise, max, canRaise: rights && opponent && max > t.current }; }
export function act(t: Table, id: string, m: Move) {
    const l = legal(t, id);
    if (!l)
        throw Error('Not your turn');
    const p = t.seats[t.turn];
    if (m.type === 'fold')
        p.folded = true;
    else if (m.type === 'check') {
        if (l.call)
            throw Error('Cannot check facing a bet');
    }
    else if (m.type === 'call')
        pay(p, l.call);
    else if (m.type === 'raise') {
        const amount = m.amount;
        if (!l.canRaise || !Number.isSafeInteger(amount) || amount! <= t.current || amount! > l.max)
            throw Error('Invalid raise');
        if (amount! < l.min && amount !== l.max)
            throw Error('Raise below minimum');
        const increase = amount! - t.current;
        pay(p, amount! - p.bet);
        if (increase >= t.minRaise)
            t.minRaise = increase;
        t.current = amount!;
    }
    else
        throw Error('Unknown action');
    p.acted = true;
    p.actedAt = t.current;
    t.history.push(`${p.name}: ${m.type}${m.amount ? ' ' + m.amount : ''}`);
    t.version++;
    advance(t);
}
export function settle(t: Table) {
    t.payouts = {};
    const live = t.seats.filter(p => !p.folded);
    if (live.length === 1)
        t.payouts[live[0].id] = t.seats.reduce((n, p) => n + p.total, 0);
    else {
        const levels = [...new Set(t.seats.map(p => p.total).filter(Boolean))].sort((a, b) => a - b);
        let prev = 0;
        for (const level of levels) {
            const contributors = t.seats.filter(p => p.total >= level);
            const pot = (level - prev) * contributors.length;
            prev = level;
            const eligible = contributors.filter(p => !p.folded);
            if (!eligible.length)
                throw Error('Invalid pot without eligible player');
            const scores = eligible.map(p => evaluate([...p.cards, ...t.board]));
            const best = Math.max(...scores);
            const winners = eligible.filter((_, i) => scores[i] === best).sort((a, b) => ((t.seats.indexOf(a) - t.button - 1 + t.seats.length) % t.seats.length) - ((t.seats.indexOf(b) - t.button - 1 + t.seats.length) % t.seats.length));
            winners.forEach((p, i) => { t.payouts[p.id] = (t.payouts[p.id] || 0) + Math.floor(pot / winners.length) + (i < pot % winners.length ? 1 : 0); });
        }
    }
    t.seats.forEach(p => { p.stack += t.payouts[p.id] || 0; p.bet = 0; p.total = 0; });
    t.phase = 'complete';
    t.turn = -1;
    t.deadline = 0;
    t.version++;
}
function advance(t: Table) {
    if (t.seats.filter(p => !p.folded).length === 1) {
        settle(t);
        return;
    }
    const funded = t.seats.filter(p => !p.folded && p.stack > 0);
    const pending = (p: Player) => !p.folded && p.stack > 0 && (!p.acted || p.bet < t.current);
    if (funded.length <= 1 && (!funded.length || funded[0].bet >= t.current)) {
        while (t.board.length < 5) {
            t.deck.pop();
            t.board.push(...t.deck.splice(-Math.min(t.board.length === 0 ? 3 : 1, 5 - t.board.length)));
        }
        settle(t);
        return;
    }
    const first = t.phase === 'preflop' && t.history.length === 0 ? t.turn : -1;
    if (t.seats.some(pending)) {
        t.turn = first >= 0 && pending(t.seats[first]) ? first : next(t, t.turn, pending);
        t.deadline = Date.now() + 30000;
        return;
    }
    if (t.phase === 'river') {
        settle(t);
        return;
    }
    t.deck.pop();
    t.board.push(...t.deck.splice(-(t.phase === 'preflop' ? 3 : 1)));
    t.phase = t.phase === 'preflop' ? 'flop' : t.phase === 'flop' ? 'turn' : 'river';
    t.current = 0;
    t.minRaise = t.big;
    t.seats.forEach(p => { p.bet = 0; p.acted = false; p.actedAt = -1; });
    t.turn = next(t, t.button, p => !p.folded && p.stack > 0);
    t.deadline = Date.now() + 30000;
}
export function view(t: Table, id: string) { const showdown = t.phase === 'complete' && t.seats.filter(p => !p.folded).length > 1; return { id: t.id, name: t.name, capacity: t.capacity, small: t.small, big: t.big, button: t.button, turn: t.turn, phase: t.phase, board: t.board, handId: t.handId, version: t.version, deadline: t.deadline, pot: t.seats.reduce((n, p) => n + p.total, 0), payouts: t.payouts, history: t.history.slice(-20), legal: legal(t, id), seats: t.seats.map(p => ({ id: p.id, name: p.name, stack: p.stack, bet: p.bet, folded: p.folded, connected: p.connected, cards: p.id === id || showdown && !p.folded ? p.cards : p.cards.map(() => null) })) }; }
export type TableView = ReturnType<typeof view>;
