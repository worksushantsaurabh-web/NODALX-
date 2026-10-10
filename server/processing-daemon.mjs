import {randomUUID} from 'node:crypto';
import {runProcessingOnce} from './processing-worker.mjs';

function pause(milliseconds, signal) {
  return new Promise(resolve => {
    if (signal.aborted) {resolve(); return;}
    const done = () => {clearTimeout(timer); signal.removeEventListener('abort', done); resolve();};
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener('abort', done, {once: true});
  });
}

export async function runProcessingDaemon({client, processor, signal, onStatus = () => {}, pollMs = 2000, heartbeatMs = 15000, cooldownMs = 60000}) {
  if (!signal || typeof processor !== 'function' || !Number.isInteger(pollMs) || pollMs < 10 || pollMs > 10000 ||
    !Number.isInteger(heartbeatMs) || heartbeatMs < 10 || heartbeatMs > 20000 ||
    !Number.isInteger(cooldownMs) || cooldownMs < 10) throw new Error('Invalid supervised worker configuration.');
  const workerId = randomUUID();
  const heartbeatStop = new AbortController();
  let databaseReady = false;
  let pausedUntil = 0;
  let heartbeatTail = Promise.resolve();
  const heartbeat = async ready => {
    const result = await client.rpc('processing_worker_heartbeat', {worker_id: workerId, is_ready: ready});
    databaseReady = !result.error;
    return databaseReady;
  };
  const pulse = () => {
    heartbeatTail = heartbeatTail.then(() => heartbeat(!signal.aborted && Date.now() >= pausedUntil)).catch(() => {databaseReady = false;});
    return heartbeatTail;
  };
  await pulse();
  const heartbeats = (async () => {
    while (!heartbeatStop.signal.aborted) {
      await pause(heartbeatMs, heartbeatStop.signal);
      if (!heartbeatStop.signal.aborted) await pulse();
    }
  })();
  try {
    onStatus('worker_started');
    while (!signal.aborted) {
      if (databaseReady && Date.now() >= pausedUntil) {
        try {
          const result = await runProcessingOnce({client, processor, signal});
          if (result.status !== 'idle') onStatus(result.status);
          if (result.status === 'failed' || result.status === 'lease_lost') {
            pausedUntil = Date.now() + cooldownMs;
            await pulse();
          }
        } catch {
          if (!signal.aborted) {
            pausedUntil = Date.now() + cooldownMs;
            onStatus('worker_unavailable');
            await pulse();
          }
        }
      }
      await pause(pollMs, signal);
    }
  } finally {
    heartbeatStop.abort();
    await heartbeats;
    try {await heartbeat(false);} catch {}
    onStatus('worker_stopped');
  }
}

export function cloudWorkerConfiguration(environment) {
  if (environment.PROCESSING_ENVIRONMENT !== 'staging' && environment.PROCESSING_ENVIRONMENT !== 'production') {
    throw new Error('An explicit staging or production environment is required.');
  }
  if (environment.DATA_BACKEND === 'rds') {
    let url;
    try {url = new URL(environment.RDS_DATABASE_URL);} catch {throw new Error('Approved RDS worker credentials are required.');}
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password ||
      environment.ALLOW_PROCESSING_NETWORK !== 'true') {
      throw new Error('Approved RDS worker credentials are required.');
    }
    return {url: null, key: null};
  }
  const url = new URL(environment.SUPABASE_URL);
  if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) || url.port ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    !environment.SUPABASE_SERVICE_ROLE_KEY || environment.ALLOW_PROCESSING_NETWORK !== 'true') {
    throw new Error('Approved cloud Supabase and server-only worker credentials are required.');
  }
  return {url: url.origin, key: environment.SUPABASE_SERVICE_ROLE_KEY};
}
