import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isAuth = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth/');
  if (!isAuth && !isAuthPage) {
    return NextResponse.redirect(new URL('/auth/sign-in', req.url));
  }
  if (isAuth && isAuthPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }
});

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
