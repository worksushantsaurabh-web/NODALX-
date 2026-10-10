import {intakeConfiguration, INTAKE_TIMEOUT_MS} from '../server/contact.mjs';
import {intakeRouterConfiguration} from '../server/intake-router.mjs';

const migrated = ['make-supabase','supabase-direct'].includes(process.env.INTAKE_PROVIDER);
const supported = !process.env.INTAKE_PROVIDER || ['apps-script','make-supabase','supabase-direct'].includes(process.env.INTAKE_PROVIDER);
const configuration = migrated ? intakeRouterConfiguration() : intakeConfiguration();
console.log(JSON.stringify({configured: configuration.ready, missing: configuration.missing, validEndpoint: configuration.validEndpoint}));
if (!configuration.ready || !supported) process.exitCode = 1;
else if (migrated && process.argv.includes('--upstream-health')) {
  console.log(JSON.stringify({consumerEnabled: configuration.consumerEnabled, liveProbePerformed: false,
    notice: 'Configuration is not live readiness. Run the separately approved synthetic website/Supabase/dashboard rehearsal.'}));
  process.exitCode = 1;
}
else if (process.argv.includes('--upstream-health')) {
  configuration.endpoint.searchParams.set('secret', process.env.APPS_SCRIPT_INTAKE_SECRET);
  configuration.endpoint.searchParams.set('action', 'health');
  try {
    const response = await fetch(configuration.endpoint, {signal: AbortSignal.timeout(INTAKE_TIMEOUT_MS)});
    const health = await response.json();
    const healthy = response.ok && health?.success === true && health?.sheetAccessible === true;
    console.log(JSON.stringify({upstreamHealthy: healthy}));
    if (!healthy) process.exitCode = 1;
  } catch {
    console.error('Upstream health could not be confirmed. Check deployment access and matching script properties.');
    process.exitCode = 1;
  }
}
