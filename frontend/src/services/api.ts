import { getAccessToken, getCurrentSessionUser } from '../../lib/session';
import { resolveApiOrigin } from '../../lib/apiOrigin';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public requestId?: string) {
    super(requestId ? `${message} Reference: ${requestId}` : message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...fetchOptions } = options;
  
  // Build URL with query params
  const baseUrl = resolveApiOrigin(API_BASE_URL, window.location.origin);
  const url = new URL(`${baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  // Default headers
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add auth header if available. The session boundary returns null when the
  // identity provider is unavailable or signed out.
  const token = await getAccessToken();
  const requestIdentity = getCurrentSessionUser()?.uid;
  if (token) {
    (defaultHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers: defaultHeaders,
    signal: fetchOptions.signal || AbortSignal.timeout(20000),
    cache: 'no-store',
  });

  if (requestIdentity !== getCurrentSessionUser()?.uid) throw new ApiError('Your session changed. Please refresh this view.', 401, 'SESSION_CHANGED');

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`SERVICE_UNAVAILABLE: Service is temporarily unavailable (HTTP ${response.status})`);
    }
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || (response.status >= 500 ? 'The service is temporarily unavailable. Please retry later.' : `Request failed (${response.status}).`);
    throw new ApiError(message, response.status, errorData.code, response.headers.get('X-Request-ID') || undefined);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`SERVICE_UNAVAILABLE: Service is temporarily unavailable`);
  }
  const result = await response.json();
  if (requestIdentity !== getCurrentSessionUser()?.uid) throw new ApiError('Your session changed. Please refresh this view.', 401, 'SESSION_CHANGED');
  return result;
}

export const apiRequest = request;

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string>) => 
    request<T>(endpoint, { method: 'GET', params }),
  
  post: <T>(endpoint: string, body: unknown) => 
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  
  put: <T>(endpoint: string, body: unknown) => 
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  
  patch: <T>(endpoint: string, body: unknown) => 
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  
  delete: <T>(endpoint: string) => 
    request<T>(endpoint, { method: 'DELETE' }),
};
