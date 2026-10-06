import {createClient} from '@supabase/supabase-js';
import {readLocalSupabaseConfig} from './local-supabase.mjs';
import {createHttpProcessor, runProcessingOnce} from '../server/processing-worker.mjs';

if (process.env.ALLOW_PROCESSING_NETWORK !== 'true') {
  console.error('Network processing is disabled. Configure and approve a processor before enabling it.');
  process.exit(1);
}
let processor;
try {
  processor = createHttpProcessor({endpoint: process.env.PROCESSING_ENDPOINT,
    allowedHost: process.env.PROCESSING_ALLOWED_HOST, token: process.env.PROCESSING_TOKEN});
} catch {
  console.error('Processing requires an approved HTTPS endpoint, exact allowed host and private token.');
  process.exit(1);
}
const config = readLocalSupabaseConfig();
const client = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false},
  global: {fetch: (input, init) => fetch(input, {...init, signal: AbortSignal.timeout(10000)})}});
try {
  const result = await runProcessingOnce({client, processor});
  console.log(JSON.stringify({status: result.status}));
} catch {
  console.error('Local worker failed safely; uncommitted work remains recoverable.');
  process.exitCode = 1;
}
