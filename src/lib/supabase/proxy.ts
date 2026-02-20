import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })
    // With Fluid compute, don't put this client in a global environment
    // variable. Always create a new one on each request.
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
                },
            },
        }
    )
    // Do not run code between createServerClient and
    // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.
    // IMPORTANT: If you remove getClaims() and you use server-side rendering
    // with the Supabase client, your users may be randomly logged out.
    const { data } = await supabase.auth.getClaims()
    const user = data?.claims
    
    // Lista de rutas que son para autenticarse (login o signup)
    const authRoutes = ['/login', '/signup', '/forgot-password', '/update-password'];
    const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/'));

    // Lista de rutas públicas que no requieren autenticación
    const publicRoutes = ['/', '/login', '/signup', '/forget-password', '/update-password', '/home', '/legal', '/error', '/sections', '/about', '/pricing', '/contact', '/privacy', '/terms'];
    const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/'));
    const schedulerRoutes = ['/api/gmail/scheduled/run', '/api/automations/run']
    const isSchedulerRoute = schedulerRoutes.some(
      route => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/')
    )

    if (isSchedulerRoute) {
        return supabaseResponse
    }
    
    if (!user && !isPublicRoute) {
        // Redirigir a la página de login
        console.log('Redirigiendo a login...');
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    // Si hay usuario, y es una ruta para autenticarse (login o signup), redirigir a workspace
    if (user && isAuthRoute) {
        console.log('Redirigiendo a dashboard...');
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }


    // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
    // creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!


    return supabaseResponse
}