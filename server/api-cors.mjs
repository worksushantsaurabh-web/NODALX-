const allowedHeaders = 'Authorization, Content-Type, Idempotency-Key';
const allowedMethods = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

export function apiCorsPolicy(request, environment = process.env) {
  const origin = request.headers?.origin;
  if (!origin) return {allowed: true, headers: {Vary: 'Origin'}};
  const allowedOrigins = new Set((environment.API_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
  if (!allowedOrigins.has(origin)) return {allowed: false, headers: {Vary: 'Origin'}};
  return {allowed: true, headers: {
    Vary: 'Origin',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': allowedMethods,
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Expose-Headers': 'X-Request-ID, X-NodalX-Data-Source',
    'Access-Control-Max-Age': '600',
  }};
}

export function applyApiCors(request, response, environment = process.env) {
  const policy = apiCorsPolicy(request, environment);
  for (const [name, value] of Object.entries(policy.headers)) response.setHeader(name, value);
  if (!policy.allowed) return response.status(403).json({code: 'ORIGIN_NOT_ALLOWED'});
  if (request.method === 'OPTIONS') return response.status(204).end();
  return null;
}
