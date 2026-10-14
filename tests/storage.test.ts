import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { postgresSnapshotStore, type SqlConnection } from '../server/storage.ts';
async function database() { const db = new PGlite(); await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;'); await db.exec(await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8')); return db; }
function connection(db: PGlite): SqlConnection { return { async query(text, values) { const result = await db.query<Record<string, any>>(text, values); return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }; }, on() { }, async end() { } }; }
test('PostgreSQL storage atomically saves snapshots, audit and safe hand results', { timeout: 20000 }, async () => {
    const db = await database();
    try {
        const storage = postgresSnapshotStore(connection(db));
        assert.equal(await storage.load(), null);
        const entry = { id: randomUUID(), user: randomUUID(), delta: 1000, reason: 'daily reward', time: Date.now() };
        const hand = { id: randomUUID(), tableId: 'aurora', result: { board: ['As'], seats: [{ cards: [null, null] }] } };
        await storage.save({ wallet: 1000 }, [entry], [hand]);
        await storage.save({ wallet: 1000 }, [entry], [hand]);
        assert.equal((await db.query<{
            n: number;
        }>('SELECT count(*)::int AS n FROM poker_private.wallet_audit')).rows[0].n, 1);
        assert.equal((await db.query<{
            n: number;
        }>('SELECT count(*)::int AS n FROM poker_private.completed_hands')).rows[0].n, 1);
        const resumed = postgresSnapshotStore(connection(db));
        assert.deepEqual(await resumed.load(), { wallet: 1000 });
    }
    finally {
        await db.close();
    }
});
test('a new authoritative process fences a preceding server from committing', { timeout: 20000 }, async () => {
    const db = await database();
    try {
        const old = postgresSnapshotStore(connection(db));
        await old.load();
        await old.save({ wallet: 9000 }, [], []);
        const current = postgresSnapshotStore(connection(db));
        assert.deepEqual(await current.load(), { wallet: 9000 });
        await current.save({ wallet: 10000 }, [], []);
        await assert.rejects(old.save({ wallet: 0 }, [], []), /commit failed/);
        const result = await db.query<{
            data: unknown;
        }>('SELECT data FROM poker_private.runtime_state');
        assert.deepEqual(result.rows[0].data, { wallet: 10000 });
    }
    finally {
        await db.close();
    }
});
test('an audit error rolls back the snapshot update and disables further writes', { timeout: 20000 }, async () => {
    const db = await database();
    try {
        const storage = postgresSnapshotStore(connection(db));
        await storage.load();
        await storage.save({ wallet: 1000 }, [], []);
        await assert.rejects(storage.save({ wallet: 2000 }, [{ id: 'invalid-uuid', user: randomUUID(), delta: 1000, reason: 'invalid', time: Date.now() }], []), /commit failed/);
        const result = await db.query<{
            data: unknown;
        }>('SELECT data FROM poker_private.runtime_state');
        assert.deepEqual(result.rows[0].data, { wallet: 1000 });
        await assert.rejects(storage.save({ wallet: 3000 }, [], []), /unavailable/);
    }
    finally {
        await db.close();
    }
});
test('private runtime rows are denied to anon and authenticated database roles', { timeout: 20000 }, async () => {
    const db = await database();
    try {
        for (const role of ['anon', 'authenticated']) {
            await db.exec(`SET ROLE ${role}`);
            await assert.rejects(db.query('SELECT data FROM poker_private.runtime_state'), /permission denied/);
            await db.exec('RESET ROLE');
        }
        const result = await db.query<{
            relrowsecurity: boolean;
        }>("SELECT relrowsecurity FROM pg_class WHERE oid='poker_private.runtime_state'::regclass");
        assert.equal(result.rows[0].relrowsecurity, true);
    }
    finally {
        await db.close();
    }
});
