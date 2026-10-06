import {createClient} from '@supabase/supabase-js';
import {createHttpProcessor} from '../server/processing-worker.mjs';
import {cloudWorkerConfiguration, runProcessingDaemon} from '../server/processing-daemon.mjs';
import {createGeminiProcessor} from '../server/gemini-processor.mjs';

let configuration;
let processor;
try {
  configuration = cloudWorkerConfiguration(process.env);
  if (process.env.PROCESSING_PROVIDER === 'gemini') {
    if (process.env.PROCESSING_ENVIRONMENT === 'production' &&
      (process.env.GEMINI_DATA_APPROVAL !== 'approved-customer' || process.env.GEMINI_PAID_PROJECT_APPROVED !== 'true')) {
      throw new Error('Customer-data privacy and paid-project approval are required.');
    }
    processor = createGeminiProcessor({apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL,
      dataApproval: process.env.GEMINI_DATA_APPROVAL});
  } else if (process.env.PROCESSING_PROVIDER === 'approved-http') {
    processor = createHttpProcessor({endpoint: process.env.PROCESSING_ENDPOINT,
      allowedHost: process.env.PROCESSING_ALLOWED_HOST, token: process.env.PROCESSING_TOKEN});
  } else {throw new Error('Provider adapter is not approved.');}
} catch {
  console.error('Worker startup blocked: approved environment, provider adapter and private credentials are required.');
  process.exit(1);
}
const client = createClient(configuration.url, configuration.key, {auth: {persistSession: false, autoRefreshToken: false},
  global: {fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(10000)})}});
const stop = new AbortController();
process.once('SIGINT', () => stop.abort());
process.once('SIGTERM', () => stop.abort());
try {
  await runProcessingDaemon({client, processor, signal: stop.signal, onStatus: status => console.log(JSON.stringify({status}))});
} catch {
  console.error('Worker stopped unexpectedly; durable leases remain recoverable.');
  process.exitCode = 1;
}
