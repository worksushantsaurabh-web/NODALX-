import {readFileSync} from 'node:fs';
import pg from 'pg';

const tables = new Set([
  'api_keys', 'artifacts', 'billing_bindings', 'connector_credentials', 'connectors',
  'feedback', 'flows', 'identity_bindings', 'import_recipes', 'import_runs',
  'inquiries', 'inquiry_events', 'job_events', 'job_rows', 'jobs',
  'notification_settings', 'outbound_emails', 'outbox', 'profiles',
  'review_exceptions', 'sheet_connections', 'subscriptions', 'usage_periods',
  'usage_reservations', 'webhook_receipts', 'workspace_settings', 'workspaces',
]);
const functions = new Set([
  'bootstrap_workspace', 'submit_own_feedback', 'update_own_profile',
  'processing_available', 'processing_readiness', 'enqueue_own_analysis',
  'own_workspace_overview', 'update_own_criteria', 'update_own_inquiry',
  'claim_processing_job', 'finish_processing_job', 'reserve_outbound_email_service',
  'ingest_source_inquiry', 'stage_source_inquiry', 'claim_intake_delivery',
  'complete_intake_delivery', 'retry_intake_delivery', 'claim_make_processing_job',
  'processing_worker_heartbeat',
]);
const identifier = /^[a-z_][a-z0-9_]*$/;
const ca = readFileSync(new URL('../certs/rds-us-east-1-bundle.pem', import.meta.url), 'utf8');
let sharedPool;

function safeIdentifier(value) {
  if (!identifier.test(value)) throw new Error('Invalid database identifier');
  return `"${value}"`;
}

function poolFor(environment) {
  if (sharedPool) return sharedPool;
  const raw = environment.RDS_DATABASE_URL;
  if (!raw) throw new Error('RDS_DATABASE_URL is required for RDS data access');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password) {
    throw new Error('Invalid RDS connection URL');
  }
  url.pathname = '/nodalx_app';
  url.searchParams.delete('sslmode');
  sharedPool = new pg.Pool({connectionString: url.toString(), ssl: {ca, rejectUnauthorized: true},
    max: 4, idleTimeoutMillis: 30000, connectionTimeoutMillis: 7000, allowExitOnIdle: true});
  return sharedPool;
}

function normalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}

async function execute(pool, role, userId, statement, params = []) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(role === 'authenticated' ? 'SET LOCAL ROLE authenticated' : 'SET LOCAL ROLE service_role');
    if (role === 'authenticated') await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await client.query(statement, params);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

class TableRequest {
  constructor(pool, role, userId, table) {
    if (!tables.has(table)) throw new Error('Unsupported data table');
    this.pool = pool;
    this.role = role;
    this.userId = userId;
    this.table = safeIdentifier(table);
    this.mode = 'select';
    this.columns = '*';
    this.filters = [];
    this.sort = [];
    this.values = [];
    this.limitValue = null;
    this.cardinality = 'many';
    this.countOnly = false;
  }

  select(columns = '*', options = {}) {
    if (columns !== '*') {
      const names = columns.split(',').map(value => value.trim());
      if (!names.length || names.some(value => !identifier.test(value))) throw new Error('Unsupported selection');
      this.columns = names.map(safeIdentifier).join(', ');
    }
    this.countOnly = options.count === 'exact' && options.head === true;
    return this;
  }

  eq(column, value) {
    this.filters.push({kind: 'eq', column: safeIdentifier(column), value});
    return this;
  }

  in(column, values) {
    if (!Array.isArray(values)) throw new Error('Invalid filter values');
    this.filters.push({kind: 'in', column: safeIdentifier(column), value: values});
    return this;
  }

  or(value) {
    const match = /^created_at\.lt\.(.+),and\(created_at\.eq\.(.+),id\.lt\.([A-Za-z0-9_-]+)\)$/.exec(value);
    if (!match || match[1] !== match[2]) throw new Error('Unsupported cursor filter');
    this.filters.push({kind: 'cursor', createdAt: match[1], id: match[3]});
    return this;
  }

  order(column, options = {}) {
    this.sort.push(`${safeIdentifier(column)} ${options.ascending === false ? 'DESC' : 'ASC'}`);
    return this;
  }

  limit(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1000) throw new Error('Invalid query limit');
    this.limitValue = value;
    return this;
  }

  single() { this.cardinality = 'single'; return this; }
  maybeSingle() { this.cardinality = 'maybeSingle'; return this; }
  insert(values) { this.mode = 'insert'; this.values = values; return this; }
  update(values) { this.mode = 'update'; this.values = values; return this; }

  async run() {
    try {
      const params = [];
      const placeholder = value => { params.push(value); return `$${params.length}`; };
      const where = this.filters.map(filter => {
        if (filter.kind === 'eq') return `${filter.column} = ${placeholder(filter.value)}`;
        if (filter.kind === 'in') return `${filter.column} = ANY(${placeholder(filter.value)})`;
        const createdAt = placeholder(filter.createdAt);
        const id = placeholder(filter.id);
        return `("created_at" < ${createdAt} OR ("created_at" = ${createdAt} AND "id" < ${id}))`;
      });
      const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
      let sql;
      if (this.mode === 'select') {
        sql = this.countOnly ? `SELECT count(*)::int AS count FROM public.${this.table}${whereSql}` :
          `SELECT ${this.columns} FROM public.${this.table}${whereSql}`;
        if (!this.countOnly && this.sort.length) sql += ` ORDER BY ${this.sort.join(', ')}`;
        if (!this.countOnly && this.limitValue !== null) sql += ` LIMIT ${this.limitValue}`;
      } else {
        if (!this.values || typeof this.values !== 'object' || Array.isArray(this.values)) throw new Error('Invalid row values');
        const entries = Object.entries(this.values);
        if (!entries.length) throw new Error('Empty row values');
        const assignments = entries.map(([column, value]) => [safeIdentifier(column), placeholder(value)]);
        if (this.mode === 'insert') {
          sql = `INSERT INTO public.${this.table} (${assignments.map(([column]) => column).join(', ')}) VALUES (${assignments.map(([, value]) => value).join(', ')})`;
        } else {
          if (!where.length) throw new Error('Refusing an unfiltered update');
          sql = `UPDATE public.${this.table} SET ${assignments.map(([column, value]) => `${column} = ${value}`).join(', ')}${whereSql}`;
        }
        if (this.columns !== '*') sql += ` RETURNING ${this.columns}`;
      }
      const result = await execute(this.pool, this.role, this.userId, sql, params);
      if (this.countOnly) return {data: null, count: result.rows[0].count, error: null};
      if (this.mode !== 'select' && this.columns === '*') return {data: null, error: null};
      if (this.cardinality !== 'many') {
        if (result.rows.length > 1 || (this.cardinality === 'single' && result.rows.length !== 1)) {
          return {data: null, error: {code: 'PGRST116', message: 'Expected one row'}};
        }
        return {data: result.rows.length ? normalize(result.rows[0]) : null, error: null};
      }
      return {data: normalize(result.rows), error: null};
    } catch (error) {
      return {data: null, error: {code: error.code || 'RDS_QUERY_ERROR', message: error.message}};
    }
  }

  then(resolve, reject) { return this.run().then(resolve, reject); }
}

export function createRdsClient({role, userId, environment = process.env}) {
  if (role !== 'service_role' && (role !== 'authenticated' || !/^[0-9a-f-]{36}$/i.test(userId || ''))) {
    throw new Error('Verified identity or service role required');
  }
  const pool = poolFor(environment);
  return {
    from: table => new TableRequest(pool, role, userId, table),
    rpc: async (name, args = {}) => {
      if (!functions.has(name) || !args || typeof args !== 'object' || Array.isArray(args)) {
        return {data: null, error: {code: 'RDS_QUERY_ERROR', message: 'Unsupported database function'}};
      }
      const entries = Object.entries(args);
      if (entries.some(([key]) => !identifier.test(key))) throw new Error('Invalid function argument');
      const sql = `SELECT public.${safeIdentifier(name)}(${entries.map(([key], index) => `${safeIdentifier(key)} => $${index + 1}`).join(', ')}) AS data`;
      try {
        const result = await execute(pool, role, userId, sql, entries.map(([, value]) => value));
        return {data: normalize(result.rows[0]?.data ?? null), error: null};
      } catch (error) {
        return {data: null, error: {code: error.code || 'RDS_QUERY_ERROR', message: error.message}};
      }
    },
  };
}

export async function syncRdsIdentity(user, environment = process.env) {
  if (!user?.id || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    throw new Error('Verified Supabase identity required');
  }
  const pool = poolFor(environment);
  const metadata = Object.fromEntries(['company_name', 'full_name']
    .filter(key => typeof user.user_metadata?.[key] === 'string')
    .map(key => [key, user.user_metadata[key]]));
  await execute(pool, 'service_role', null, `
    INSERT INTO auth.users(id, email_confirmed_at, phone_confirmed_at, is_anonymous, raw_user_meta_data)
    VALUES($1, $2, $3, false, $4)
    ON CONFLICT (id) DO UPDATE SET
      email_confirmed_at = EXCLUDED.email_confirmed_at,
      phone_confirmed_at = EXCLUDED.phone_confirmed_at,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      synced_at = now()
  `, [user.id, user.email_confirmed_at || null, user.phone_confirmed_at || null, metadata]);
}
