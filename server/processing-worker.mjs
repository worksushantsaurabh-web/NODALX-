import {validateNodalxV3Packet} from './nodalx-v3-result.mjs';

const textFields = new Set(['intent', 'urgency', 'category', 'summary', 'suggested_action']);

export function validateProcessingOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) throw new Error('Invalid processing output.');
  for (const [key, field] of Object.entries(value)) {
    if (key === 'fit_score') {
      if (!Number.isFinite(field) || field < 0 || field > 100) throw new Error('Invalid processing score.');
    } else if (key === 'analysis_packet') {
      validateNodalxV3Packet(field);
    } else if (!textFields.has(key) || typeof field !== 'string' || field.length > 4000) {
      throw new Error('Invalid processing output field.');
    }
  }
  return value;
}

export async function runProcessingOnce({client, processor, timeoutMs = 90000, signal}) {
  if (typeof processor !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 90000) throw new Error('A bounded processor is required.');
  if (signal?.aborted) return {status: 'stopped'};
  const claimed = await client.rpc('claim_processing_job');
  if (claimed.error) throw new Error('Processing claim unavailable.');
  if (!claimed.data) return {status: 'idle'};
  const job = claimed.data;
  if (signal?.aborted) throw new Error('Worker interrupted; the durable lease will recover.');
  let output = null;
  let timer;
  const controller = new AbortController();
  let interrupt;
  try {
    if (job.attempt > 3) throw new Error('Retry limit reached.');
    output = validateProcessingOutput(await Promise.race([
      processor(job.input, {idempotencyKey: job.id, signal: controller.signal}),
      new Promise((resolve, reject) => {timer = setTimeout(() => {controller.abort(); reject(new Error('Processing timed out.'));}, timeoutMs);}),
      new Promise((resolve, reject) => {interrupt = () => {controller.abort(); reject(new Error('Worker interrupted.'));}; signal?.addEventListener('abort', interrupt, {once: true}); if (signal?.aborted) interrupt();}),
    ]));
  } catch {output = null;}
  finally {clearTimeout(timer); controller.abort(); if (interrupt) signal?.removeEventListener('abort', interrupt);}
  if (signal?.aborted) throw new Error('Worker interrupted; the durable lease will recover.');
  const settled = await client.rpc('finish_processing_job', {owned_workspace: job.workspaceId, record_job: job.id, token: job.leaseToken, output});
  if (settled.error) throw new Error('Settlement unavailable; the durable lease will recover.');
  return {id: job.id, status: settled.data ? output ? 'completed' : 'failed' : 'lease_lost'};
}

export function createHttpProcessor({endpoint, allowedHost, token, fetchImplementation = fetch}) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.hostname !== allowedHost || url.username || url.password ||
    url.search || url.hash || !token || /[\r\n]/.test(token)) throw new Error('Approved HTTPS processing configuration is required.');
  return async (input, {idempotencyKey, signal}) => {
    const response = await fetchImplementation(url, {method: 'POST', redirect: 'error', signal,
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': idempotencyKey}, body: JSON.stringify(input)});
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Processor unavailable.');
    return validateProcessingOutput(await readProcessingJson(response));
  };
}

export async function readProcessingJson(response) {
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        bytes += item.value.length;
        if (bytes > 32768) throw new Error('Processor response exceeded limit.');
        chunks.push(item.value);
      }
    } finally {await reader.cancel();}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
