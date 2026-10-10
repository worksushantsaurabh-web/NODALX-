if (!process.env.RDS_DATABASE_URL) {
  console.error('Configure RDS_DATABASE_URL in root .env.rds.local before starting RDS development.');
  process.exit(1);
}
process.env.DATA_BACKEND = 'rds';
await import('./dev-cloud.mjs');
