import {intakeConfiguration} from '../server/contact.mjs';

const configuration = intakeConfiguration();
console.log(JSON.stringify({configured: configuration.ready, missing: configuration.missing, validEndpoint: configuration.validEndpoint}));
if (!configuration.ready) process.exitCode = 1;
else if (process.argv.includes('--upstream-health')) {
  configuration.endpoint.searchParams.set('secret', process.env.APPS_SCRIPT_INTAKE_SECRET);
  configuration.endpoint.searchParams.set('action', 'health');
  try {
    const response = await fetch(configuration.endpoint, {signal: AbortSignal.timeout(15000)});
    const health = await response.json();
    const healthy = response.ok && health?.success === true && health?.sheetAccessible === true;
    console.log(JSON.stringify({upstreamHealthy: healthy}));
    if (!healthy) process.exitCode = 1;
  } catch {
    console.error('Upstream health could not be confirmed. Check deployment access and matching script properties.');
    process.exitCode = 1;
  }
}
