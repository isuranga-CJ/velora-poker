import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { sqliteStore, type SnapshotStore } from './storage.ts';
import { WebSocketServer, WebSocket } from 'ws';
import { act, active, newTable, seat, start, view } from '../game/engine.ts';
import type { Table, Move } from '../game/engine.ts';
type Account = {
    id: string;
    name: string;
    wallet: number;
    daily: string;
    receipts: string[];
};
type Room = {
    table: Table;
    password?: string;
    salt?: string;
};
type Ledger = {
    id: string;
    user: string;
    delta: number;
    reason: string;
    time: number;
};
type State = {
    accounts: Record<string, Account>;
    sessions: Record<string, {
        id: string;
        expires: number;
    }>;
    rooms: Record<string, Room>;
    ledger: Ledger[];
};
export async function createGameServer(opts: {
    database?: string;
    storage?: SnapshotStore;
    guest?: boolean;
    origins?: string[];
    supabaseUrl?: string;
    publishableKey?: string;
    autoStart?: boolean;
} = {}) {
    const storage = opts.storage || sqliteStore(opts.database || ':memory:');
    let state: State = (await storage.load()) as State || { accounts: {}, sessions: {}, rooms: { aurora: { table: newTable('aurora', 'Aurora Lounge', 6) }, meridian: { table: newTable('meridian', 'The Meridian', 9) }, duel: { table: newTable('duel', 'Heads-up Club', 2) } }, ledger: [] };
    Object.values(state.rooms).forEach(r => r.table.seats.forEach(p => p.connected = false));
    let faulted = false, closing = false;
    let pending = Promise.resolve();
    const exclusive = <T>(operation: () => Promise<T>): Promise<T> => {
        const task = pending.then(() => { if (faulted || closing)
            throw Error('Game service unavailable'); return operation(); });
        pending = task.then(() => { }, () => { });
        return task;
    };
    const save = async () => {
        const hands = Object.values(state.rooms).filter(r => r.table.phase === 'complete').map(r => ({ id: r.table.handId, tableId: r.table.id, result: view(r.table, 'spectator') }));
        try {
            await storage.save(state, state.ledger, hands);
        }
        catch (error) {
            faulted = true;
            for (const ws of clients.keys())
                ws.close(1011, 'Storage unavailable');
            throw Error('Durable storage unavailable; action was not acknowledged');
        }
    };
    const ledger = (a: Account, delta: number, reason: string) => { a.wallet += delta; state.ledger.push({ id: randomUUID(), user: a.id, delta, reason, time: Date.now() }); state.ledger = state.ledger.slice(-300); };
    const clients = new Map<WebSocket, {
        id?: string;
        room?: string;
        expires?: number;
        count: number;
        window: number;
        alive: boolean;
    }>();
    const online = (id: string) => [...clients.values()].some(c => c.id === id);
    const send = (ws: WebSocket, data: unknown) => {
        if (ws.readyState === WebSocket.OPEN) {
            if (ws.bufferedAmount > 1024 * 1024)
                ws.close(1013, 'Slow connection');
            else
                ws.send(JSON.stringify(data));
        }
    };
    const lobby = () => Object.values(state.rooms).filter(r => !r.password).map(r => ({ id: r.table.id, name: r.table.name, capacity: r.table.capacity, seated: r.table.seats.length, blinds: `${r.table.small} / ${r.table.big}`, phase: r.table.phase }));
    const broadcast = () => clients.forEach((c, ws) => {
        if (!c.id)
            return;
        send(ws, { type: 'state', user: (({ id, name, wallet, daily }) => ({ id, name, wallet, daily }))(state.accounts[c.id]), lobby: lobby(), table: c.room ? view(state.rooms[c.room].table, c.id) : null });
    });
    const rate = new Map<string, {
        n: number;
        at: number;
    }>();
    const http = createServer(async (req, res) => {
        const origin = req.headers.origin;
        if (origin && !(opts.origins || []).includes(origin)) {
            res.writeHead(403);
            return res.end('Origin not allowed');
        }
        if (origin)
            res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }
        if (req.url === '/ready') {
            res.writeHead(faulted ? 503 : 200);
            return res.end(JSON.stringify({ ready: !faulted, storage: storage.kind }));
        }
        if (req.url === '/health') {
            return res.end(JSON.stringify({ status: faulted ? 'unavailable' : 'ok', storage: storage.kind, service: 'velora-game', protocol: 1, auth: opts.guest ? 'development-guest' : 'supabase', tables: Object.keys(state.rooms).length, connections: clients.size, uptime: Math.floor(process.uptime()) }));
        }
        if (req.url === '/guest' && req.method === 'POST' && opts.guest) {
            const key = req.socket.remoteAddress || 'unknown';
            const bucket = rate.get(key) || { n: 0, at: Date.now() };
            if (Date.now() - bucket.at > 60000) {
                bucket.n = 0;
                bucket.at = Date.now();
            }
            rate.set(key, bucket);
            if (++bucket.n > 10) {
                res.writeHead(429);
                return res.end('{"error":"Try again later"}');
            }
            let body = '';
            try {
                for await (const chunk of req) {
                    body += chunk;
                    if (body.length > 2048)
                        throw Error('Request too large');
                }
                const name = String(JSON.parse(body).name || '').trim();
                if (!/^[\p{L}\p{N}_ -]{2,20}$/u.test(name))
                    throw Error('Name must be 2–20 letters or numbers');
                await exclusive(async () => {
                    const before = JSON.stringify(state);
                    const id = randomUUID(), token = randomBytes(32).toString('hex');
                    state.accounts[id] = { id, name, wallet: 10000, daily: '', receipts: [] };
                    state.sessions[createHash('sha256').update(token).digest('hex')] = { id, expires: Date.now() + 86400000 };
                    state.ledger.push({ id: randomUUID(), user: id, delta: 10000, reason: 'welcome', time: Date.now() });
                    try {
                        await save();
                    }
                    catch (error) {
                        state = JSON.parse(before);
                        throw error;
                    }
                    res.end(JSON.stringify({ token, id }));
                });
            }
            catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: (e as Error).message }));
            }
            return;
        }
        res.writeHead(404);
        res.end('{"error":"Not found"}');
    });
    const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
    http.on('upgrade', (req, socket, head) => {
        if (req.url !== '/ws' || (req.headers.origin && !(opts.origins || []).includes(req.headers.origin)) || clients.size >= 500) {
            socket.destroy();
            return;
        }
        wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    });
    wss.on('connection', ws => {
        const c = { count: 0, window: Date.now(), alive: true } as {
            id?: string;
            room?: string;
            expires?: number;
            count: number;
            window: number;
            alive: boolean;
        };
        clients.set(ws, c);
        const authTimer = setTimeout(() => {
            if (!c.id)
                ws.close(1008, 'Authenticate first');
        }, 10000);
        ws.on('pong', () => { c.alive = true; });
        ws.on('message', raw => {
            void exclusive(async () => {
                let snapshot: string | undefined;
                try {
                    if (Date.now() - c.window > 10000) {
                        c.window = Date.now();
                        c.count = 0;
                    }
                    if (++c.count > 80)
                        throw Error('Rate limit exceeded');
                    const m = JSON.parse(String(raw));
                    if (m.type === 'auth') {
                        snapshot = JSON.stringify(state);
                        if (c.id)
                            throw Error('Already authenticated');
                        if (typeof m.token !== 'string' || m.token.length > 4096)
                            throw Error('Invalid token');
                        let id: string | undefined;
                        if (opts.guest) {
                            const s = state.sessions[createHash('sha256').update(m.token).digest('hex')];
                            if (s && s.expires > Date.now()) {
                                id = s.id;
                                c.expires = s.expires;
                            }
                        }
                        else if (opts.supabaseUrl && opts.publishableKey) {
                            const response = await fetch(`${opts.supabaseUrl}/auth/v1/user`, { headers: { Authorization: `Bearer ${m.token}`, apikey: opts.publishableKey }, signal: AbortSignal.timeout(5000) });
                            if (response.ok) {
                                const user = await response.json() as {
                                    id: string;
                                    email_confirmed_at?: string;
                                };
                                if (user.email_confirmed_at) {
                                    const claims = JSON.parse(Buffer.from(m.token.split('.')[1], 'base64url').toString());
                                    if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now())
                                        throw Error('Authentication failed');
                                    c.expires = claims.exp * 1000;
                                    id = user.id;
                                    if (!state.accounts[id]) {
                                        state.accounts[id] = { id, name: `Player ${id.slice(0, 6)}`, wallet: 10000, daily: '', receipts: [] };
                                        state.ledger.push({ id: randomUUID(), user: id, delta: 10000, reason: 'welcome', time: Date.now() });
                                    }
                                }
                            }
                        }
                        if (!id)
                            throw Error('Authentication failed');
                        for (const [old, info] of clients)
                            if (info.id === id && old !== ws) {
                                info.id = undefined;
                                old.close(1000, 'Session replaced');
                            }
                        c.id = id;
                        clearTimeout(authTimer);
                        for (const r of Object.values(state.rooms)) {
                            const p = r.table.seats.find(p => p.id === id);
                            if (p) {
                                p.connected = true;
                                c.room = r.table.id;
                            }
                        }
                        await save();
                        send(ws, { type: 'authenticated', id });
                        broadcast();
                        return;
                    }
                    if (!c.id)
                        throw Error('Authenticate first');
                    if (!c.expires || Date.now() >= c.expires) {
                        ws.close(1008, 'Session expired');
                        throw Error('Authentication failed');
                    }
                    if (m.type === 'ping') {
                        send(ws, { type: 'pong', at: m.at });
                        return;
                    }
                    const a = state.accounts[c.id];
                    if (typeof m.id !== 'string' || m.id.length > 80 || m.id.length < 8)
                        throw Error('Action ID required');
                    if (a.receipts.includes(m.id)) {
                        send(ws, { type: 'ack', id: m.id, duplicate: true });
                        broadcast();
                        return;
                    }
                    snapshot = JSON.stringify(state);
                    if (m.type === 'join' || m.type === 'watch') {
                        const r = state.rooms[String(m.room)];
                        if (!r)
                            throw Error('Room not found');
                        if (r.password) {
                            const actual = scryptSync(String(m.password || '').slice(0, 128), r.salt!, 32);
                            if (!timingSafeEqual(actual, Buffer.from(r.password, 'hex')))
                                throw Error('Incorrect room password');
                        }
                        if (m.type === 'join') {
                            if (Object.values(state.rooms).some(x => x.table.seats.some(p => p.id === c.id)))
                                throw Error('Leave your current seat first');
                            const buy = Number(m.buyIn || 1000);
                            if (!Number.isSafeInteger(buy) || buy > a.wallet)
                                throw Error('Insufficient chips');
                            seat(r.table, c.id, a.name, buy);
                            ledger(a, -buy, 'table buy-in');
                        }
                        c.room = r.table.id;
                    }
                    else if (m.type === 'create') {
                        if (Object.keys(state.rooms).length >= 100)
                            throw Error('Room limit reached');
                        const name = String(m.name || 'Private table').slice(0, 30);
                        const password = String(m.password || '');
                        if (password.length < 8 || password.length > 128)
                            throw Error('Use an 8–128 character password');
                        const id = randomBytes(8).toString('hex'), salt = randomBytes(16).toString('hex');
                        state.rooms[id] = { table: newTable(id, name), salt, password: scryptSync(password, salt, 32).toString('hex') };
                        c.room = id;
                    }
                    else if (m.type === 'daily') {
                        const day = new Date().toISOString().slice(0, 10);
                        if (a.daily === day)
                            throw Error('Already claimed today');
                        a.daily = day;
                        ledger(a, 1000, 'daily reward');
                    }
                    else {
                        const r = c.room && state.rooms[c.room];
                        if (!r)
                            throw Error('Join a table first');
                        const t = r.table;
                        const p = t.seats.find(p => p.id === c.id);
                        if (m.type === 'leave') {
                            if (p) {
                                if (active(t))
                                    throw Error('Finish the current hand before leaving');
                                ledger(a, p.stack, 'table cash-out');
                                const index = t.seats.indexOf(p);
                                t.seats.splice(index, 1);
                                if (index <= t.button)
                                    t.button--;
                                t.version++;
                            }
                            c.room = undefined;
                        }
                        else {
                            if (!p)
                                throw Error('Spectators cannot play');
                            if (m.version !== t.version || m.handId !== t.handId)
                                throw Error('State changed; try again');
                            if (m.type === 'start')
                                start(t);
                            else if (m.type === 'action')
                                act(t, c.id, m.move as Move);
                            else
                                throw Error('Unknown message');
                        }
                    }
                    a.receipts.push(m.id);
                    a.receipts = a.receipts.slice(-2000);
                    await save();
                    send(ws, { type: 'ack', id: m.id });
                    broadcast();
                }
                catch (e) {
                    if (snapshot)
                        state = JSON.parse(snapshot);
                    send(ws, { type: 'error', message: (e as Error).message });
                }
            }).catch(() => ws.close(1011, 'Server error'));
        });
        ws.on('close', () => {
            clearTimeout(authTimer);
            clients.delete(ws);
            if (closing)
                return;
            void exclusive(async () => {
                if (c.id && !online(c.id))
                    Object.values(state.rooms).forEach(r => { const p = r.table.seats.find(p => p.id === c.id); if (p)
                        p.connected = false; });
                await save();
                broadcast();
            }).catch(() => { });
        });
    });
    const timer = setInterval(() => {
        void exclusive(async () => {
            let changed = false;
            const before = JSON.stringify(state);
            for (const r of Object.values(state.rooms)) {
                const t = r.table;
                if (active(t) && t.deadline <= Date.now()) {
                    const p = t.seats[t.turn];
                    if (p) {
                        act(t, p.id, { type: p.bet >= t.current ? 'check' : 'fold' });
                        changed = true;
                    }
                }
                else if (opts.autoStart !== false && !active(t) && t.seats.filter(p => p.connected && p.stack > 0).length >= 2) {
                    const latest = completed.get(t.id);
                    if (!latest)
                        completed.set(t.id, Date.now());
                    else if (Date.now() - latest > 7000) {
                        start(t);
                        completed.delete(t.id);
                        changed = true;
                    }
                }
                else
                    completed.delete(t.id);
            }
            if (changed) {
                try {
                    await save();
                }
                catch (error) {
                    state = JSON.parse(before);
                    throw error;
                }
                broadcast();
            }
        }).catch(() => { });
    }, 1000);
    const completed = new Map<string, number>();
    const heartbeat = setInterval(() => {
        clients.forEach((c, ws) => {
            if ((c.id && c.expires && c.expires <= Date.now()) || !c.alive) {
                ws.terminate();
                return;
            }
            c.alive = false;
            ws.ping();
        });
        for (const [ip, b] of rate)
            if (Date.now() - b.at > 120000)
                rate.delete(ip);
    }, 15000);
    try {
        await save();
    }
    catch (error) {
        clearInterval(timer);
        clearInterval(heartbeat);
        await storage.close();
        throw error;
    }
    return { http, wss, close: async () => {
            closing = true;
            clearInterval(timer);
            clearInterval(heartbeat);
            for (const ws of clients.keys())
                ws.terminate();
            await pending;
            await new Promise<void>(resolve => wss.close(() => resolve()));
            await new Promise<void>(resolve => http.close(() => resolve()));
            await storage.close();
        } };
}
