import { auth } from '../../lib/firebase';

const API_BASE_URL = import.meta.env.PROD 
  ? '' 
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001');

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...fetchOptions } = options;
  
  // Build URL with query params
  const baseUrl = API_BASE_URL || window.location.origin;
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

  // Add auth header if available
  const token = await auth.currentUser?.getIdToken();
  if (token) {
    (defaultHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    ...fetchOptions,
    headers: defaultHeaders,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
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
