import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ensureProfileRow, userFromClaims, type AuthClaims } from '@/lib/auth/auth'
import { sanitizeNext } from '@/lib/auth/server'
import { log } from '@/lib/utils/log'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = sanitizeNext(url.searchParams.get('next'))
  const redirectToOAuthError = () => {
    const loginUrl = new URL('/login', url)
    loginUrl.searchParams.set('error', 'oauth')
    if (next !== '/') loginUrl.searchParams.set('next', next)
    return NextResponse.redirect(loginUrl)
  }

  // Log which query keys are present so we can diagnose the
  // `?error=oauth` redirect without dumping the one-time `code`.
  const presentKeys = Array.from(url.searchParams.keys())
  log.info('auth/callback: hit', { presentKeys, hasCode: Boolean(code) })

  if (!code) {
    log.error('auth/callback: missing code', {
      error: url.searchParams.get('error'),
      errorDescription: url.searchParams.get('error_description'),
    })
    return redirectToOAuthError()
  }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    log.error('auth/callback: exchangeCodeForSession failed', error.message)
    return redirectToOAuthError()
  }
  // getClaims validates the freshly-set session cookie and returns the
  // user identity from the JWT payload. No network round trip to /user.
  const { data: claimsResult, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError) {
    log.error('auth/callback: getClaims failed after exchange', claimsError.message)
    return redirectToOAuthError()
  }
  const user = userFromClaims(claimsResult?.claims as AuthClaims | undefined ?? {})
  if (user) {
    try {
      await ensureProfileRow(user)
    } catch {
      // The session is already established; preference hydration can repair
      // profile provisioning on the next authenticated request.
      log.error('auth/callback: profile provisioning failed', { userId: user.id })
    }
  }
  return NextResponse.redirect(new URL(next, url))
}
