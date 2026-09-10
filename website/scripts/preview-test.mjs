// Use Astro's programmatic preview so agent environments do not detach the CLI.
import { preview } from 'astro';
import { fileURLToPath } from 'node:url';
const server = await preview({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 4321 } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.stop(); process.exit(0); });
