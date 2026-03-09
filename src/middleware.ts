import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // API routes пропускаємо
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Статичні файли пропускаємо
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Публічні маршрути
  const publicPaths = ['/login'];
  const isPublicPath = publicPaths.includes(pathname);

  // Без сесії і не публічний шлях → на логін
  if (!session && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Є сесія і намагається на логін → на головну
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};