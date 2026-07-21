import axios, { AxiosError, type AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/auth';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

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
      useAuthStore.getState().setUser(null);
    }
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    // Attempt a single silent refresh on 401 for non-auth requests.
    if (status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
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
      if (typeof data.message === 'string') return data.message;
      if (data.error && typeof data.error.message === 'string') return data.error.message;
    }
  }
  return fallback;
}
