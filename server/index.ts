import { createGameServer } from './app.ts';
const guest = process.env.DEV_GUEST_AUTH === 'true';
if (!guest && (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY))
    throw Error('Set Supabase auth configuration, or explicitly enable DEV_GUEST_AUTH=true for local development.');
if (!guest && !process.env.ALLOWED_ORIGINS)
    throw Error('ALLOWED_ORIGINS is required');
const app = createGameServer({ database: process.env.DATABASE_PATH || 'velora.sqlite', guest, origins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','), supabaseUrl: process.env.SUPABASE_URL, publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY });
const port = Number(process.env.PORT || 8080);
app.http.listen(port, guest ? '127.0.0.1' : (process.env.HOST || '0.0.0.0'), () => console.log(JSON.stringify({ event: 'listening', port, auth: guest ? 'development-guest' : 'supabase' })));
for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => { app.close().then(() => process.exit(0)); });
