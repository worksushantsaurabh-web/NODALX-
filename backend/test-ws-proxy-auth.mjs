/**
 * Manual verification for the /ws-proxy authorization gate.
 * Run: node test-ws-proxy-auth.mjs   (from the backend directory)
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';

const TARGET =
  'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';
const PORT = 5051;
const BASE = `ws://127.0.0.1:${PORT}`;

const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, API_BACKEND_PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const log = [];
child.stdout.on('data', (d) => log.push(String(d)));
child.stderr.on('data', (d) => log.push(String(d)));

/**
 * Attempt an upgrade and report how the server refused it.
 */
function attempt(label, { origin, protocols }) {
  return new Promise((resolve) => {
    const ws = protocols
      ? new WebSocket(`${BASE}/ws-proxy?target=${encodeURIComponent(TARGET)}`, protocols, {
          headers: origin ? { Origin: origin } : {},
        })
      : new WebSocket(`${BASE}/ws-proxy?target=${encodeURIComponent(TARGET)}`, {
          headers: origin ? { Origin: origin } : {},
        });

    let settled = false;
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      resolve(`${outcome.padEnd(6)} ${label}`);
    };

    ws.on('unexpected-response', (_req, res) => finish(`HTTP ${res.statusCode}`));
    ws.on('open', () => {
      ws.close();
      finish('OPENED');
    });
    ws.on('error', (err) => finish(`closed: ${err.message.split('\n')[0]}`));
    setTimeout(() => {
      ws.terminate();
      finish('TIMEOUT');
    }, 4000);
  });
}

await delay(2500);

const results = [];
results.push(await attempt('no origin, no token', {}));
results.push(await attempt('evil origin + forged token', {
  origin: 'https://attacker.example',
  protocols: ['nodalx-proxy', 'nodalx.token.forged'],
}));
results.push(await attempt('allowed origin, no token', { origin: 'http://localhost:5173' }));
results.push(await attempt('allowed origin, garbage token', {
  origin: 'http://localhost:5173',
  protocols: ['nodalx-proxy', 'nodalx.token.not-a-real-jwt'],
}));

console.log('\n--- /ws-proxy authorization results ---');
for (const r of results) console.log(' ', r);

const failed = results.some((r) => !r.startsWith('HTTP 403'));
console.log(failed ? '\nFAIL: expected HTTP 403 for every attempt' : '\nPASS: every unauthenticated upgrade returned HTTP 403');

child.kill('SIGKILL');
process.exit(failed ? 1 : 0);
