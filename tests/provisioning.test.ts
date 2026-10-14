import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { provisioningServer } from '../server/provisioning.ts';
test('unconfigured hosted service exposes readiness failure and denies game/account endpoints', async () => { const app = provisioningServer(['DATABASE_URL', 'SUPABASE_URL']); app.http.listen(0, '127.0.0.1'); await once(app.http, 'listening'); const base = `http://127.0.0.1:${(app.http.address() as {
    port: number;
}).port}`; try {
    const health = await fetch(base + '/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json() as {
        ready: boolean;
    }).ready, false);
    assert.equal((await fetch(base + '/ready')).status, 503);
    assert.equal((await fetch(base + '/guest', { method: 'POST' })).status, 503);
    assert.equal((await fetch(base + '/ws')).status, 503);
}
finally {
    await app.close();
} });
