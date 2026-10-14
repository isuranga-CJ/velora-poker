import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
export type AuditEntry = {
    id: string;
    user: string;
    delta: number;
    reason: string;
    time: number;
};
export type StoredHand = {
    id: string;
    tableId: string;
    result: unknown;
};
export interface SnapshotStore {
    kind: 'sqlite' | 'postgres';
    load(): Promise<unknown | null>;
    save(state: unknown, audit: AuditEntry[], hands: StoredHand[]): Promise<void>;
    close(): Promise<void>;
}
export function sqliteStore(path = ':memory:'): SnapshotStore {
    const db = new DatabaseSync(path);
    db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,delta INTEGER NOT NULL,reason TEXT NOT NULL,time INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS hand_history(id TEXT PRIMARY KEY,table_id TEXT NOT NULL,result TEXT NOT NULL,completed_at INTEGER NOT NULL);`);
    return {
        kind: 'sqlite',
        async load() { const row = db.prepare('SELECT data FROM snapshots WHERE id=1').get() as {
            data: string;
        } | undefined; return row ? JSON.parse(row.data) : null; },
        async save(state, audit, hands) {
            db.exec('BEGIN IMMEDIATE');
            try {
                db.prepare('INSERT INTO snapshots VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(state));
                const insert = db.prepare('INSERT OR IGNORE INTO audit VALUES(?,?,?,?,?)');
                for (const a of audit)
                    insert.run(a.id, a.user, a.delta, a.reason, a.time);
                const hand = db.prepare('INSERT OR IGNORE INTO hand_history VALUES(?,?,?,?)');
                for (const h of hands)
                    hand.run(h.id, h.tableId, JSON.stringify(h.result), Date.now());
                db.exec('COMMIT');
            }
            catch (error) {
                db.exec('ROLLBACK');
                throw error;
            }
        },
        async close() { db.close(); }
    };
}
// Deliberately uses one checked-out client for each complete transaction.
// A new process claims ownership; the preceding process is fenced from writes.
export async function postgresStore(connectionString: string): Promise<SnapshotStore> {
    const url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol))
        throw Error('Invalid database protocol');
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const sslMode = url.searchParams.get('sslmode');
    if (!local && sslMode && !['verify-full', 'verify-ca'].includes(sslMode))
        throw Error('Use verified database TLS; do not disable certificate checks');
    const client = new pg.Client({ connectionString, ssl: local ? undefined : { rejectUnauthorized: true }, connectionTimeoutMillis: 10000, statement_timeout: 10000, application_name: 'velora-game' });
    await client.connect();
    return postgresSnapshotStore(client);
}
export type SqlConnection = {
    query: (text: string, values?: unknown[]) => Promise<{
        rows: Record<string, any>[];
        rowCount: number | null;
    }>;
    on: (event: 'error', handler: (error: Error) => void) => unknown;
    end: () => Promise<void>;
};
export function postgresSnapshotStore(client: SqlConnection): SnapshotStore {
    const owner = randomUUID();
    let revision = 0;
    let initialized = false;
    let failed = false;
    client.on('error', () => { failed = true; });
    return {
        kind: 'postgres',
        async load() {
            try {
                await client.query('BEGIN');
                await client.query('INSERT INTO poker_private.runtime_state(id,owner_id,revision,data) VALUES(1,$1,0,NULL) ON CONFLICT(id) DO NOTHING', [owner]);
                const result = await client.query('UPDATE poker_private.runtime_state SET owner_id=$1,updated_at=now() WHERE id=1 RETURNING revision,data', [owner]);
                revision = Number(result.rows[0].revision);
                const data = result.rows[0].data;
                await client.query('COMMIT');
                initialized = true;
                return data;
            }
            catch (error) {
                await client.query('ROLLBACK').catch(() => { });
                await client.end().catch(() => { });
                throw Error('Database schema or ownership initialization failed');
            }
        },
        async save(state, audit, hands) {
            if (!initialized || failed)
                throw Error('Database is unavailable');
            try {
                await client.query('BEGIN');
                const update = await client.query('UPDATE poker_private.runtime_state SET data=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=1 AND owner_id=$2 AND revision=$3 RETURNING revision', [JSON.stringify(state), owner, revision]);
                if (update.rowCount !== 1)
                    throw Error('This server no longer owns the game state');
                if (audit.length)
                    await client.query("INSERT INTO poker_private.wallet_audit(id,user_id,delta,reason,created_at) SELECT x.id::uuid,x.user_id::uuid,x.delta::bigint,x.reason,to_timestamp(x.time/1000.0) FROM jsonb_to_recordset($1::jsonb) AS x(id text,user_id text,delta bigint,reason text,time bigint) ON CONFLICT(id) DO NOTHING", [JSON.stringify(audit.map(a => ({ ...a, user_id: a.user })))]);
                if (hands.length)
                    await client.query("INSERT INTO poker_private.completed_hands(id,table_id,result) SELECT x.id::uuid,x.table_id,x.result FROM jsonb_to_recordset($1::jsonb) AS x(id text,table_id text,result jsonb) ON CONFLICT(id) DO NOTHING", [JSON.stringify(hands.map(h => ({ ...h, table_id: h.tableId })))]);
                await client.query('COMMIT');
                revision = Number(update.rows[0].revision);
            }
            catch (error) {
                failed = true;
                await client.query('ROLLBACK').catch(() => { });
                throw Error('Durable storage commit failed; reconnect after service recovery');
            }
        },
        async close() { await client.end(); }
    };
}
export async function applySchema(connectionString: string) {
    const url = new URL(connectionString);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    const mode = url.searchParams.get('sslmode');
    if (!local && mode && !['verify-full', 'verify-ca'].includes(mode))
        throw Error('Verified TLS is required');
    const client = new pg.Client({ connectionString, ssl: local ? undefined : { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
    await client.connect();
    try {
        await client.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    }
    finally {
        await client.end();
    }
}
