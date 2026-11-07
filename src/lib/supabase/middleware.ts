import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Refreshes the Supabase auth session on every request (token rotation) and
 * mirrors the refreshed cookies onto the response. Called from src/middleware.ts.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Touch the session so expired access tokens get refreshed.
  try {
    const { error } = await supabase.auth.getUser()
    // A refresh token the server no longer knows (signed out elsewhere,
    // rotated in another tab, project reset) would fail on every request.
    // Drop the stale auth cookies so the visitor is simply signed out.
    if (error && 'code' in error && error.code === 'refresh_token_not_found') {
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith('sb-')) response.cookies.delete(cookie.name)
      }
    }
  } catch {
    // Auth outage must never take the page down — continue signed out.
  }

  return response
}
