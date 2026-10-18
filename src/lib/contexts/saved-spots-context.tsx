'use client';

import { createContext, useContext, type ReactNode } from 'react'

export interface InitialSavedSpot {
  userId: string
  spotId: string
  createdAt: string
}

const Ctx = createContext<readonly InitialSavedSpot[]>([])

export function SavedSpotsProvider({
  initial,
  children,
}: {
  initial: readonly InitialSavedSpot[]
  children: ReactNode
}) {
  return <Ctx.Provider value={initial}>{children}</Ctx.Provider>
}

export function useInitialSavedSpots(): readonly InitialSavedSpot[] {
  return useContext(Ctx)
}
