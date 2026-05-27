import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Защищённые пути
  const protectedPaths = ['/dashboard']
  const isProtectedPath = protectedPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  )

  // Если пытается зайти на защищённую страницу без сессии — редирект на логин
  if (isProtectedPath && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Если уже авторизован и идёт на /login — редирект на дашборд
  if (req.nextUrl.pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}