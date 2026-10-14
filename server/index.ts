import { createGameServer } from './app.ts';
import { postgresStore } from './storage.ts';
import { provisioningServer } from './provisioning.ts';
const guest = process.env.DEV_GUEST_AUTH === 'true';
if (guest && process.env.NODE_ENV === 'production')
    throw Error('Development guest authentication is disabled in production');
const required = guest ? [] : ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'ALLOWED_ORIGINS', 'DATABASE_URL'].filter(name => !process.env[name]);
let mode='provisioning';
let app: {
    http: ReturnType<typeof provisioningServer>['http'];
    close: () => Promise<void>;
};
if (required.length) {
    app = provisioningServer(required);
}
else {
    try {
        app = await createGameServer({
            database: guest ? (process.env.DATABASE_PATH || 'velora.sqlite') : undefined,
            storage: guest ? undefined : await postgresStore(process.env.DATABASE_URL!),
            guest, origins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
            supabaseUrl: process.env.SUPABASE_URL, publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY
        });
        mode=guest?'development':'configured';
    }
    catch (error) {
        console.error(JSON.stringify({ event: 'game_initialization_failed', message: 'Database initialization failed. Verify schema, verified TLS, and platform secrets.' }));
        app = provisioningServer(['database_connection_or_schema']);
    }
}
const port = Number(process.env.PORT || 8080);
app.http.listen(port, guest ? '127.0.0.1' : (process.env.HOST || '0.0.0.0'), () => console.log(JSON.stringify({ event: 'listening', port, mode })));
for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => { app.close().then(() => process.exit(0)); });
