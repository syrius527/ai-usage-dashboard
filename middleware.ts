import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'dashboard_session';

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const pathname = request.nextUrl.pathname;

  const isLoginPage = pathname === '/';
  const isDashboard = pathname.startsWith('/dashboard') || pathname.startsWith('/settings');
  const isProtectedAPI = pathname.startsWith('/api/') && !pathname.startsWith('/api/auth');

  if (isDashboard && !sessionToken) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (isLoginPage && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isProtectedAPI && !sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/settings/:path*', '/api/:path*'],
};
