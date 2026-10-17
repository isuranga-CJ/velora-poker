import { act, active, newTable, seat, start, view } from '../game/engine';
import type { Table, Move } from '../game/engine';
import { newCup, registerCup, unregisterCup, beginCup, settleCup, dealCup, cupView, type Cup } from '../game/tournament';
type Env = {
    POKER: DurableObjectNamespace;
    ALLOWED_ORIGINS: string;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
};
type Account = {
    id: string;
    name: string;
    wallet: number;
    daily: string;
    receipts: string[];
};
type Room = {
    table: Table;
    salt?: string;
    password?: string;
    nextAt?: number;
    cup?: Cup;
};
type Audit = {
    id: string;
    user: string;
    delta: number;
    reason: string;
    time: number;
};
type World = {
    accounts: Record<string, Account>;
    rooms: Record<string, Room>;
    audit: Audit[];
};
type Session = {
    id?: string;
    room?: string;
    expires: number;
    accepted: number;
    count: number;
    window: number;
};
const json = (value: unknown, status = 200, headers: HeadersInit = {}) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const configured = (env: Env) => !!env.SUPABASE_URL && !!env.SUPABASE_PUBLISHABLE_KEY && !!env.ALLOWED_ORIGINS;
async function passwordHash(password: string, salt: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']); const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256); return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, '0')).join(''); }
function equal(a: string, b: string) { let difference = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return difference === 0; }
export default {
    async fetch(request: Request, env: Env) {
        const origin = request.headers.get('Origin');
        const allowed = (env.ALLOWED_ORIGINS || '').split(',');
        if (origin && !allowed.includes(origin))
            return json({ error: 'Origin not allowed' }, 403);
        const headers: Record<string, string> = { 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,OPTIONS' };
        if (origin)
            headers['Access-Control-Allow-Origin'] = origin;
        if (request.method === 'OPTIONS')
            return new Response(null, { status: 204, headers });
        const path = new URL(request.url).pathname;
        if (path === '/health')
            return json({ service: 'velora-cloudflare', ready: configured(env), storage: 'durable-object-sqlite', features: ['friends-cup-v1'] }, 200, headers);
        if (path === '/ready')
            return json({ ready: configured(env) }, configured(env) ? 200 : 503, headers);
        if (!configured(env))
            return json({ error: 'Account configuration is pending' }, 503, headers);
        if (path !== '/ws' || request.method !== 'GET')
            return json({ error: 'Not found' }, 404, headers);
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
            return json({ error: 'WebSocket upgrade required' }, 426, headers);
        return env.POKER.get(env.POKER.idFromName('velora-private-beta-v1')).fetch(request);
    }
} satisfies ExportedHandler<Env>;
// One authoritative world for the limited private beta. All wallet and table
// updates commit in the same durable SQLite transaction. This is not a regional
// sharding design; paid production can retain the separate Node/Postgres path.
export class PokerWorld {
    private state: World;
    private tail = Promise.resolve();
    private failed = false;
    constructor(private ctx: DurableObjectState, private env: Env) {
        ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS world(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL)');
        ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,delta INTEGER NOT NULL,reason TEXT NOT NULL,time INTEGER NOT NULL)');
        ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS hands(id TEXT PRIMARY KEY,table_id TEXT NOT NULL,result TEXT NOT NULL,time INTEGER NOT NULL)');
        const rows = ctx.storage.sql.exec<{
            data: string;
        }>('SELECT data FROM world WHERE id=1').toArray();
        this.state = rows.length ? JSON.parse(rows[0].data) : { accounts: {}, rooms: { aurora: { table: newTable('aurora', 'Aurora Lounge', 6) }, meridian: { table: newTable('meridian', 'The Meridian', 9) }, duel: { table: newTable('duel', 'Heads-up Club', 2) } }, audit: [] };
        // Restored sockets carry only the player/room metadata, never tokens or cards.
        const connected = new Set(ctx.getWebSockets().map(ws => this.session(ws).id).filter(Boolean));
        for (const room of Object.values(this.state.rooms))
            for (const p of room.table.seats)
                p.connected = connected.has(p.id);
        ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    }
    private session(ws: WebSocket): Session { return ws.deserializeAttachment() || { expires: 0, accepted: Date.now(), count: 0, window: Date.now() }; }
    private serial<T>(operation: () => Promise<T>): Promise<T> { const task = this.tail.then(operation); this.tail = task.then(() => { }, () => { }); return task; }
    private send(ws: WebSocket, value: unknown) { try {
        ws.send(JSON.stringify(value));
    }
    catch { /* closed sockets are cleaned by the close callback */ } }
    private room(id: unknown) { if (typeof id !== 'string' || !Object.hasOwn(this.state.rooms, id))
        throw Error('Room not found'); return this.state.rooms[id]; }
    private persist() {
        try {
            this.ctx.storage.transactionSync(() => {
                this.ctx.storage.sql.exec('INSERT INTO world(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', JSON.stringify(this.state));
                for (const a of this.state.audit)
                    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO audit VALUES(?,?,?,?,?)', a.id, a.user, a.delta, a.reason, a.time);
                for (const r of Object.values(this.state.rooms))
                    if (r.table.phase === 'complete')
                        this.ctx.storage.sql.exec('INSERT OR IGNORE INTO hands VALUES(?,?,?,?)', r.table.handId, r.table.id, JSON.stringify(view(r.table, 'spectator')), Date.now());
            });
        }
        catch (error) {
            this.failed = true;
            for (const ws of this.ctx.getWebSockets())
                ws.close(1011, 'Storage unavailable');
            throw Error('Durable storage unavailable; action was not acknowledged');
        }
    }
    private pay(a: Account, delta: number, reason: string) { if (!Number.isSafeInteger(a.wallet + delta) || a.wallet + delta < 0)
        throw Error('Invalid chip balance'); a.wallet += delta; this.state.audit.push({ id: crypto.randomUUID(), user: a.id, delta, reason, time: Date.now() }); this.state.audit = this.state.audit.slice(-300); }
    private online() { return new Set(this.ctx.getWebSockets().map(ws => this.session(ws)).filter(s => s.id && s.expires > Date.now()).map(s => s.id!)); }
    private reserved(id: string, except?: string) {
        return Object.values(this.state.rooms).some(r => r.table.id !== except && (r.cup
            ? (r.cup.status === 'registration' && r.cup.entries.some(p => p.id === id)) || (r.cup.status === 'running' && r.table.seats.some(p => p.id === id && p.stack + p.total > 0))
            : r.table.seats.some(p => p.id === id)));
    }
    private broadcast() {
        const lobby = Object.values(this.state.rooms).filter(r => !r.password && !r.cup).map(r => ({ id: r.table.id, name: r.table.name, capacity: r.table.capacity, seated: r.table.seats.length, blinds: `${r.table.small} / ${r.table.big}`, phase: r.table.phase }));
        const tournaments = Object.values(this.state.rooms).filter(r => r.cup).map(r => cupView(r.cup!,r.table,this.online()));
        for (const ws of this.ctx.getWebSockets()) {
            const c = this.session(ws);
            if (!c.id || c.expires <= Date.now())
                continue;
            const a = this.state.accounts[c.id];
            if (!a)
                continue;
            this.send(ws, { type: 'state', user: { id: a.id, name: a.name, wallet: a.wallet, daily: a.daily }, lobby, tournaments, tournament: c.room ? tournaments.find(t => t.id === c.room) ?? null : null, table: c.room ? view(this.room(c.room).table, c.id) : null });
        }
    }
    private async schedule() {
        const now = Date.now();
        const times: number[] = [];
        for (const ws of this.ctx.getWebSockets()) {
            const c = this.session(ws);
            times.push(c.id ? c.expires : c.accepted + 10000);
        }
        for (const r of Object.values(this.state.rooms)) {
            if (r.cup) settleCup(r.cup,r.table,now);
            if (r.cup && r.cup.status !== 'running') { delete r.nextAt; continue; }
            if (active(r.table))
                times.push(r.table.deadline);
            else if (r.table.seats.filter(p => (p.connected || r.cup) && p.stack > 0).length >= 2) {
                r.nextAt ??= now + 7000;
                times.push(r.nextAt);
            }
            else
                delete r.nextAt;
        }
        if (times.length)
            await this.ctx.storage.setAlarm(Math.max(now + 50, Math.min(...times)));
        else
            await this.ctx.storage.deleteAlarm();
    }
    async fetch(_request: Request) {
        return this.serial(async () => {
            if (this.failed)
                return json({ error: 'Storage unavailable' }, 503);
            if (this.ctx.getWebSockets().length >= 40)
                return json({ error: 'Private beta connection limit reached' }, 503);
            const pair = new WebSocketPair();
            const client = pair[0], server = pair[1];
            this.ctx.acceptWebSocket(server);
            server.serializeAttachment({ expires: 0, accepted: Date.now(), count: 0, window: Date.now() } satisfies Session);
            await this.schedule();
            return new Response(null, { status: 101, webSocket: client });
        });
    }
    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
        return this.serial(async () => {
            const before = JSON.stringify(this.state);
            const previous = this.session(ws);
            const c = { ...previous };
            try {
                if (this.failed)
                    throw Error('Storage unavailable');
                if (typeof message !== 'string' || new TextEncoder().encode(message).length > 8192) {
                    ws.close(1009, 'Message too large');
                    return;
                }
                if (Date.now() - c.window > 10000) {
                    c.window = Date.now();
                    c.count = 0;
                }
                if (++c.count > 80) {
                    ws.close(1008, 'Rate limit exceeded');
                    return;
                }
                ws.serializeAttachment(c);
                const m = JSON.parse(message);
                if (m.type === 'auth') {
                    if (c.id)
                        throw Error('Already authenticated');
                    if (typeof m.token !== 'string' || m.token.length > 4096)
                        throw Error('Authentication failed');
                    const response = await fetch(`${this.env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${m.token}`, apikey: this.env.SUPABASE_PUBLISHABLE_KEY! }, signal: AbortSignal.timeout(5000) });
                    if (!response.ok)
                        throw Error('Authentication failed');
                    const user = await response.json() as {
                        id: string;
                        email_confirmed_at?: string;
                    };
                    const claims = JSON.parse(atob(m.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                    if (!user.email_confirmed_at || !/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(user.id) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now())
                        throw Error('Authentication failed');
                    c.id = user.id;
                    c.expires = claims.exp * 1000;
                    if (!this.state.accounts[user.id]) {
                        if (Object.keys(this.state.accounts).length >= 200)
                            throw Error('Private beta account limit reached');
                        const a = { id: user.id, name: `Player ${user.id.slice(0, 6)}`, wallet: 0, daily: '', receipts: [] };
                        this.state.accounts[user.id] = a;
                        this.pay(a, 10000, 'welcome');
                    }
                    for (const r of Object.values(this.state.rooms)) {
                        const p = r.table.seats.find(p => p.id === user.id);
                        if (p) p.connected = true;
                        if ((!r.cup && p) || (r.cup?.status === 'registration' && r.cup.entries.some(p => p.id === user.id)) || (r.cup?.status === 'running' && p && p.stack + p.total > 0)) c.room = r.table.id;
                    }
                    this.persist();
                    for (const old of this.ctx.getWebSockets())
                        if (old !== ws && this.session(old).id === c.id) {
                            const oldInfo = this.session(old);
                            delete oldInfo.id;
                            old.serializeAttachment(oldInfo);
                            old.close(1000, 'Session replaced');
                        }
                    ws.serializeAttachment(c);
                    this.send(ws, { type: 'authenticated', id: c.id });
                    this.broadcast();
                    await this.schedule();
                    return;
                }
                if (!c.id)
                    throw Error('Authenticate first');
                if (c.expires <= Date.now()) {
                    ws.close(1008, 'Session expired');
                    return;
                }
                if (m.type === 'ping') {
                    this.send(ws, { type: 'pong', at: typeof m.at === 'number' ? m.at : 0 });
                    return;
                }
                if (typeof m.id !== 'string' || m.id.length < 8 || m.id.length > 80)
                    throw Error('Action ID required');
                const a = this.state.accounts[c.id];
                if (a.receipts.includes(m.id)) {
                    this.send(ws, { type: 'ack', id: m.id, duplicate: true });
                    this.broadcast();
                    return;
                }
                if (m.type === 'cup-create') {
                    if (Object.keys(this.state.rooms).length >= 25) throw Error('Private beta room limit reached');
                    if (Object.values(this.state.rooms).some(r => r.cup && r.cup.owner === c.id && ['registration','running'].includes(r.cup.status))) throw Error('Finish or cancel your current Cup first');
                    const title = typeof m.name === 'string' ? m.name.trim() : '';
                    if (title.length < 3 || title.length > 30 || /[\x00-\x1f]/.test(title)) throw Error('Use a Cup name of 3–30 characters');
                    const id = crypto.randomUUID();
                    this.state.rooms[id] = {table:newTable(id,title,6),cup:newCup(c.id)};
                    // Creating an event does not take a playing seat.
                }
                else if (['cup-register','cup-unregister','cup-start','cup-cancel'].includes(m.type)) {
                    const r = this.room(m.room), cup = r.cup;
                    if (!cup) throw Error('Tournament not found');
                    if (m.type === 'cup-register') {
                        if (this.reserved(c.id)) throw Error('Leave your current seat or registration first');
                        registerCup(cup,c.id,a.name); c.room = r.table.id;
                    } else if (m.type === 'cup-unregister') {
                        unregisterCup(cup,c.id); if (c.room === r.table.id) delete c.room;
                    } else if (m.type === 'cup-start') {
                        for (const e of cup.entries) if (this.reserved(e.id,r.table.id)) throw Error('A registered player has another seat');
                        beginCup(cup,r.table,c.id,this.online());
                        if (cup.entries.some(e => e.id === c.id)) c.room = r.table.id;
                    } else {
                        if (c.id !== cup.owner) throw Error('Only the host can cancel this Cup');
                        if (cup.status !== 'registration') throw Error('Only an unstarted Cup can be cancelled');
                        cup.status = 'cancelled'; cup.finishedAt = Date.now();
                    }
                    this.state.audit.push({id:crypto.randomUUID(),user:c.id,delta:0,reason:m.type+':'+r.table.id,time:Date.now()});
                    this.state.audit = this.state.audit.slice(-300);
                }
                else if (m.type === 'join' || m.type === 'watch') {
                    const r = this.room(m.room);
                    if (r.password && !equal(await passwordHash(String(m.password || '').slice(0, 128), r.salt!), r.password))
                        throw Error('Incorrect room password');
                    if (m.type === 'join') {
                        if (r.cup) throw Error('Use tournament registration to join this Cup');
                        if (this.reserved(c.id))
                            throw Error('Leave your current seat first');
                        const buy = Number(m.buyIn ?? 1000);
                        if (!Number.isSafeInteger(buy) || buy > a.wallet)
                            throw Error('Insufficient chips');
                        seat(r.table, c.id, a.name, buy);
                        this.pay(a, -buy, 'table buy-in');
                    }
                    if (m.type === 'watch' && Object.values(this.state.rooms).some(x => x.table.id !== r.table.id && x.cup?.status === 'running' && x.table.seats.some(p => p.id === c.id && p.stack+p.total > 0))) throw Error('Return to your tournament table while still playing');
                    c.room = r.table.id;
                }
                else if (m.type === 'create') {
                    if (Object.values(this.state.rooms).some(r => r.cup?.status === 'running' && r.table.seats.some(p => p.id === c.id && p.stack+p.total > 0))) throw Error('Finish your tournament before opening another table');
                    if (Object.keys(this.state.rooms).length >= 25)
                        throw Error('Private beta room limit reached');
                    const password = String(m.password || '');
                    if (password.length < 8 || password.length > 128)
                        throw Error('Use an 8–128 character password');
                    const id = crypto.randomUUID(), salt = crypto.randomUUID();
                    this.state.rooms[id] = { table: newTable(id, String(m.name || 'Private table').slice(0, 30)), salt, password: await passwordHash(password, salt) };
                    c.room = id;
                }
                else if (m.type === 'daily') {
                    const day = new Date().toISOString().slice(0, 10);
                    if (a.daily === day)
                        throw Error('Already claimed today');
                    a.daily = day;
                    this.pay(a, 1000, 'daily reward');
                }
                else {
                    const room = this.room(c.room), t = room.table, p = t.seats.find(p => p.id === c.id);
                    if (m.type === 'leave') {
                        if (room.cup) {
                            if (room.cup.status === 'running' && p && p.stack+p.total > 0) throw Error('Your tournament seat is reserved until elimination');
                            if (room.cup.status === 'registration' && room.cup.entries.some(e => e.id === c.id)) unregisterCup(room.cup,c.id);
                            delete c.room;
                        }
                        else if (p) {
                            if (active(t))
                                throw Error('Finish the current hand before leaving');
                            this.pay(a, p.stack, 'table chip return');
                            const i = t.seats.indexOf(p);
                            t.seats.splice(i, 1);
                            if (i <= t.button)
                                t.button--;
                            t.version++;
                        }
                        delete c.room;
                    }
                    else {
                        if (!p)
                            throw Error('Spectators cannot play');
                        if (m.version !== t.version || m.handId !== t.handId)
                            throw Error('State changed; try again');
                        if (m.type === 'start') {
                            if (room.cup) throw Error('Tournament hands are dealt automatically');
                            start(t);
                            delete this.room(c.room).nextAt;
                        }
                        else if (m.type === 'action')
                            act(t, c.id, m.move as Move);
                        else
                            throw Error('Unknown message');
                    }
                }
                a.receipts.push(m.id);
                a.receipts = a.receipts.slice(-2000);
                await this.schedule();
                this.persist();
                if (m.type === 'cup-start') {
                    const r = this.room(m.room);
                    for (const other of this.ctx.getWebSockets()) {
                        const info = this.session(other);
                        if (r.cup!.entries.some(e => e.id === info.id)) { info.room = r.table.id; other.serializeAttachment(info); }
                    }
                }
                ws.serializeAttachment(c);
                this.send(ws, { type: 'ack', id: m.id });
                this.broadcast();
            }
            catch (error) {
                this.state = JSON.parse(before);
                ws.serializeAttachment(previous);
                this.send(ws, { type: 'error', message: error instanceof Error ? error.message : 'Invalid request' });
            }
        });
    }
    async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean) {
        return this.serial(async () => {
            const c = this.session(ws);
            try {
                ws.close(code, reason);
            }
            catch { }
            if (c.id && !this.ctx.getWebSockets().some(other => other !== ws && this.session(other).id === c.id && this.session(other).expires > Date.now()))
                for (const r of Object.values(this.state.rooms)) {
                    const p = r.table.seats.find(p => p.id === c.id);
                    if (p)
                        p.connected = false;
                }
            if (!this.failed) {
                await this.schedule();
                this.persist();
                this.broadcast();
            }
        });
    }
    async webSocketError(ws: WebSocket) { await this.webSocketClose(ws, 1011, 'Connection error', false); }
    async alarm() {
        return this.serial(async () => {
            if (this.failed)
                return;
            const before = JSON.stringify(this.state);
            try {
                const now = Date.now();
                for (const ws of this.ctx.getWebSockets()) {
                    const c = this.session(ws);
                    if ((c.id && c.expires <= now) || (!c.id && c.accepted + 10000 <= now))
                        ws.close(1008, 'Session expired');
                }
                for (const r of Object.values(this.state.rooms)) {
                    const t = r.table;
                    if (active(t) && t.deadline <= now) {
                        const p = t.seats[t.turn];
                        if (p)
                            act(t, p.id, { type: p.bet >= t.current ? 'check' : 'fold' });
                    }
                    else if (!active(t) && r.nextAt && r.nextAt <= now && t.seats.filter(p => (p.connected || r.cup) && p.stack > 0).length >= 2) {
                        if (r.cup) dealCup(r.cup,t,now); else start(t);
                        delete r.nextAt;
                    }
                }
                await this.schedule();
                this.persist();
                this.broadcast();
            }
            catch (error) {
                this.state = JSON.parse(before);
                throw error;
            }
        });
    }
}
