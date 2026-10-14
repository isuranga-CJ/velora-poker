import { applySchema } from './storage.ts';
if (!process.env.DATABASE_URL)
    throw Error('DATABASE_URL is required');
await applySchema(process.env.DATABASE_URL);
console.log(JSON.stringify({ event: 'schema_applied', schema: 'poker_private' }));
