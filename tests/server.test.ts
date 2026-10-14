import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/app.ts';
type Message = {
    type: string;
    [key: string]: any;
};
async function client(base: string, token: string) { const ws = new WebSocket(base.replace('http', 'ws') + '/ws'); let current: Message | undefined; const inbox: Message[] = []; ws.on('message', r => { const m = JSON.parse(String(r)); inbox.push(m); if (m.type === 'state')
    current = m; }); await once(ws, 'open'); const wait = async (predicate: (m: Message) => boolean) => { for (let n = 0; n < 300; n++) {
    const i = inbox.findIndex(predicate);
    if (i >= 0)
        return inbox.splice(i, 1)[0];
    await new Promise(r => setTimeout(r, 5));
} throw Error('Message timeout: ' + JSON.stringify(inbox)); }; const send = (m: object) => ws.send(JSON.stringify(m)); send({ type: 'auth', token }); await wait(m => m.type === 'authenticated'); await wait(m => m.type === 'state'); return { ws, wait, send, get state() { return current!; }, async command(m: Record<string, unknown>) { const id = randomUUID(); send({ ...m, id }); const r = await wait(r => r.type === 'ack' && r.id === id || r.type === 'error'); await new Promise(r => setTimeout(r, 10)); return r; } }; }
async function guest(base: string, name: string) { const r = await fetch(base + '/guest', { method: 'POST', body: JSON.stringify({ name }) }); assert.equal(r.status, 200); return await r.json() as {
    token: string;
    id: string;
}; }
test('real WebSocket clients: auth, duplicate buy-in, full hand, privacy, reconnect, wallet and private room gates', { timeout: 20000 }, async () => {
    const app = createGameServer({ guest: true, autoStart: false });
    app.http.listen(0, '127.0.0.1');
    await once(app.http, 'listening');
    const base = `http://127.0.0.1:${(app.http.address() as any).port}`;
    const clients: Awaited<ReturnType<typeof client>>[] = [];
    try {
        const [ga, gb, gc] = await Promise.all(['Alice', 'Bob', 'Observer'].map(n => guest(base, n)));
        const [a, b, c] = await Promise.all([ga, gb, gc].map(g => client(base, g.token)));
        clients.push(a, b, c);
        const unauthorized = new WebSocket(base.replace('http', 'ws') + '/ws');
        await once(unauthorized, 'open');
        unauthorized.send(JSON.stringify({ type: 'join', room: 'aurora', id: randomUUID() }));
        const [response] = await once(unauthorized, 'message');
        assert.match(String(response), /Authenticate first/);
        unauthorized.close();
        const badOrigin = await fetch(base + '/health', { headers: { Origin: 'https://evil.example' } });
        assert.equal(badOrigin.status, 403);
        assert.equal((await a.command({ type: 'join', room: 'aurora', buyIn: 1000 })).type, 'ack');
        assert.equal(a.state.user.wallet, 9000);
        assert.equal((await b.command({ type: 'join', room: 'aurora', buyIn: 1000 })).type, 'ack');
        await c.command({ type: 'watch', room: 'aurora' });
        const dupe = randomUUID();
        a.send({ type: 'daily', id: dupe });
        await a.wait(m => m.type === 'ack' && m.id === dupe);
        a.send({ type: 'daily', id: dupe });
        assert.equal((await a.wait(m => m.type === 'ack' && m.duplicate)).duplicate, true);
        await new Promise(r => setTimeout(r, 20));
        assert.equal(a.state.user.wallet, 10000);
        assert.equal((await a.command({ type: 'daily' })).type, 'error');
        let t = a.state.table;
        await a.command({ type: 'start', version: t.version, handId: t.handId });
        await new Promise(r => setTimeout(r, 20));
        assert.ok(c.state.table.seats.every((p: any) => p.cards.every((card: any) => card === null)));
        assert.equal(a.state.table.seats.find((p: any) => p.id === gb.id).cards[0], null);
        assert.equal((await c.command({ type: 'action', move: { type: 'fold' }, version: c.state.table.version, handId: c.state.table.handId })).type, 'error');
        let n = 0;
        while (a.state.table.phase !== 'complete') {
            assert.ok(n++ < 50);
            t = a.state.table;
            const actor = t.seats[t.turn].id === ga.id ? a : b;
            const l = actor.state.table.legal;
            const result = await actor.command({ type: 'action', move: { type: l.call ? 'call' : 'check' }, version: t.version, handId: t.handId });
            assert.equal(result.type, 'ack', JSON.stringify(result));
        }
        assert.equal(a.state.table.board.length, 5);
        assert.equal(a.state.table.seats.reduce((s: number, p: any) => s + p.stack, 0), 2000);
        const old = a.state.table;
        assert.equal((await a.command({ type: 'action', move: { type: 'raise', amount: 9999 }, version: 0, handId: old.handId })).type, 'error');
        a.ws.close();
        await once(a.ws, 'close');
        const resumed = await client(base, ga.token);
        clients.push(resumed);
        assert.equal(resumed.state.table.handId, old.handId);
        assert.equal(resumed.state.user.wallet, 10000);
        await resumed.command({ type: 'leave' });
        await b.command({ type: 'leave' });
        assert.equal(resumed.state.user.wallet + b.state.user.wallet, 21000);
        await resumed.command({ type: 'create', name: 'Friends', password: 'secret-club-2026' });
        const privateId = resumed.state.table.id;
        assert.ok(!resumed.state.lobby.some((r: any) => r.id === privateId));
        assert.equal((await c.command({ type: 'watch', room: privateId, password: 'wrong' })).type, 'error');
        assert.equal((await c.command({ type: 'watch', room: privateId, password: 'secret-club-2026' })).type, 'ack');
    }
    finally {
        clients.forEach(c => c.ws.terminate());
        await new Promise(r => setTimeout(r, 20));
        await app.close();
    }
});
test('durable snapshot restores sessions, table state, wallet and duplicate receipts', { timeout: 10000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'velora-'));
    const path = join(dir, 'game.sqlite');
    let app = createGameServer({ database: path, guest: true, autoStart: false });
    let live: Awaited<ReturnType<typeof client>> | undefined;
    const listen = async () => { app.http.listen(0, '127.0.0.1'); await once(app.http, 'listening'); return `http://127.0.0.1:${(app.http.address() as any).port}`; };
    try {
        let base = await listen();
        const g = await guest(base, 'Persistent');
        live = await client(base, g.token);
        await live.command({ type: 'join', room: 'aurora', buyIn: 1000 });
        live.ws.terminate();
        await new Promise(r => setTimeout(r, 10));
        await app.close();
        app = createGameServer({ database: path, guest: true, autoStart: false });
        base = await listen();
        live = await client(base, g.token);
        assert.equal(live.state.user.wallet, 9000);
        assert.equal(live.state.table.seats[0].stack, 1000);
        assert.equal(live.state.table.seats[0].connected, true);
    }
    finally {
        live?.ws.terminate();
        await new Promise(r => setTimeout(r, 10));
        await app.close();
        rmSync(dir, { recursive: true });
    }
});
