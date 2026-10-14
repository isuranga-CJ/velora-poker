import { createServer } from 'node:http';
export function provisioningServer(required: string[]) {
    const http = createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        const status = { service: 'velora-game', status: 'awaiting_configuration', ready: false, required };
        if (req.url === '/health') {
            res.writeHead(200);
            res.end(JSON.stringify(status));
            return;
        }
        if (req.url === '/ready') {
            res.writeHead(503);
            res.end(JSON.stringify(status));
            return;
        }
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Online play is not open yet' }));
    });
    http.on('upgrade', (_req, socket) => socket.destroy());
    return { http, close: () => new Promise<void>(resolve => http.close(() => resolve())) };
}
