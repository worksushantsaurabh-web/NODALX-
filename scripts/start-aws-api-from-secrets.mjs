import {loadAwsApiSecret} from './load-aws-api-secret.mjs';

try {
  Object.assign(process.env, loadAwsApiSecret());
  await import('./start-aws-api.mjs');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
