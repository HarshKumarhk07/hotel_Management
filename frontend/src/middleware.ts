import { NextResponse, type NextRequest } from 'next/server';
import { ROLE_COOKIE } from '@/lib/session';

/**
 * Edge route guard for the privileged portals. This is defense-in-depth and a
 * UX guard — the authoritative authorization check is on the backend API, which
 * authenticates and role-checks every request. Here we only prevent the wrong
 * role's portal shell from ever being served:
 *   - /admin/*   → SUPER_ADMIN only
 *   - /kitchen/* → KITCHEN_OWNER only
 * A missing cookie sends the visitor to /login (login pages themselves are
 * excluded so the flow can complete).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = req.cookies.get(ROLE_COOKIE)?.value;

  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const isKitchen = pathname === '/kitchen' || pathname.startsWith('/kitchen/');

  // Never intercept the login entry points.
  if (pathname === '/admin/login' || pathname === '/kitchen/login') {
    return NextResponse.next();
  }

  if (isAdmin && role !== 'SUPER_ADMIN') {
    return redirectFor(req, role);
  }
  if (isKitchen && role !== 'KITCHEN_OWNER') {
    return redirectFor(req, role);
  }
  return NextResponse.next();
}

function redirectFor(req: NextRequest, role: string | undefined) {
  const url = req.nextUrl.clone();
  if (role === 'SUPER_ADMIN') url.pathname = '/admin';
  else if (role === 'KITCHEN_OWNER') url.pathname = '/kitchen';
  else {
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*', '/kitchen/:path*'],
};
