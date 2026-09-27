/**
 * What went wrong with a Supabase Auth call, in terms the login page can
 * explain. Until now every signup failure read «ця пошта вже зайнята» — even
 * a 500 from the SMTP relay (e.g. Brevo refusing Supabase's IP, 525).
 */
export type AuthFailure = 'exists' | 'email_send' | 'other'

export interface AuthErrorLike {
  message?: string
  status?: number
  code?: string
}

export function classifyAuthError(error: AuthErrorLike | null | undefined): AuthFailure {
  if (!error) return 'other'
  const code = error.code ?? ''
  const message = error.message ?? ''
  if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered|already exists/i.test(message)) {
    return 'exists'
  }
  if (
    code === 'over_email_send_rate_limit' ||
    error.status === 429 ||
    /error sending|sending (the )?(confirmation|magic link|recovery|reset)|smtp|unauthorized ip|\b525\b/i.test(message) ||
    ((error.status ?? 0) >= 500 && /e-?mail|mail/i.test(message))
  ) {
    return 'email_send'
  }
  return 'other'
}

/**
 * With e-mail confirmation on, Supabase answers a signup for an address that
 * is already registered with a fake user and no error (anti-enumeration) —
 * the tell is an empty identities list.
 */
export function isExistingUserSignup(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0
}
