import type { AuthUser } from '@/stores/auth';

/**
 * A NON-sensitive, readable cookie mirroring the authenticated role. It is NOT
 * a credential and is never trusted for data authorization (the backend API is
 * the real boundary and re-validates every request). It exists purely so the
 * Next.js edge middleware can redirect the wrong role away from a portal before
 * any admin/kitchen shell HTML is served — a client-side gate alone cannot run
 * at the edge because the real session lives in memory + a cross-origin
 * HttpOnly cookie on the API domain.
 */
export const ROLE_COOKIE = 'hm_role';

export function setRoleCookie(role: AuthUser['role']) {
  if (typeof document === 'undefined') return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  // Session cookie (no Max-Age) so it clears when the browser fully closes;
  // SameSite=Lax is enough since it is only read by our own middleware.
  document.cookie = `${ROLE_COOKIE}=${role}; Path=/; SameSite=Lax${secure}`;
}

export function clearRoleCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
