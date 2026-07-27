import axios, { AxiosError, type AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/auth';

const envApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
const baseURL = envApiUrl.endsWith('/api/v1') ? envApiUrl : `${envApiUrl.replace(/\/$/, '')}/api/v1`;

/**
 * Axios instance for the KDS API.
 *  - `withCredentials` so the HttpOnly refresh cookie is sent to /auth routes.
 *  - Access token is held in memory (not localStorage) and attached per request.
 *  - On a 401, it transparently tries one refresh, then retries the request.
 */
export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post<{ data: { accessToken: string } }>(
      `${baseURL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const token = res.data.data.accessToken;
    accessToken = token;
    return token;
  } catch {
    accessToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('has_session');
      document.cookie = 'hm_role=; Path=/; Max-Age=0; SameSite=Lax';
      useAuthStore.getState().setUser(null);
    }
    return null;
  }
}

/**
 * Refresh the access token, coalescing concurrent callers onto a single
 * in-flight request. This is critical because the backend ROTATES refresh
 * tokens with reuse-detection — two parallel /auth/refresh calls (e.g. the
 * session bootstrap and a page query that fired before the token was ready)
 * would race, invalidate each other, and leave the app 401'd. Everyone must go
 * through this one promise.
 */
export function refreshSession(): Promise<string | null> {
  refreshing ??= refreshAccessToken().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    // Attempt a single silent refresh on 401 for non-auth requests.
    if (status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      const token = await refreshSession();
      if (token) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Extract a human-friendly message from an API error. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    if (data) {
      // Prefer a specific field-level reason over the generic top-level message
      // (e.g. "Validation failed") so the user knows what to fix.
      const generic = typeof data.message === 'string' && /validation failed/i.test(data.message);
      const fieldError = firstFieldError(data.errors);
      if (fieldError && (generic || !data.message)) return fieldError;
      if (typeof data.message === 'string') return data.message;
      if (data.error && typeof data.error.message === 'string') return data.error.message;
      if (fieldError) return fieldError;
    }
  }
  return fallback;
}

/** Pull the first field-level error string from a `{ field: message }` map. */
function firstFieldError(errors: unknown): string | undefined {
  if (!errors || typeof errors !== 'object') return undefined;
  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0];
  }
  return undefined;
}
