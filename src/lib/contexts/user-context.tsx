'use client';

import { createContext, useContext, type ReactNode } from 'react'
import type { User } from '@/lib/auth/user'

const UserCtx = createContext<User | null>(null)

export function UserProvider({
  user,
  children,
}: {
  user: User | null
  children: ReactNode
}) {
  return <UserCtx.Provider value={user}>{children}</UserCtx.Provider>
}

/**
 * Returns the current signed-in user, or `null` when there is no real
 * Supabase session. The root layout always wraps the app in a
 * `<UserProvider>` (passing `null` on the server when the visitor is
 * unauthenticated), so the only "no provider" case is a programming
 * error — throw loudly in that situation.
 */
export function useUser(): User | null {
  const ctx = useContext(UserCtx)
  if (ctx === undefined) {
    throw new Error("useUser() must be called inside <UserProvider>")
  }
  return ctx
}
