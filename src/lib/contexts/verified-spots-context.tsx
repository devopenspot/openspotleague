"use client"

import { createContext, useContext, type ReactNode } from "react"

export interface InitialVerifiedSpot {
  userId: string
  spotId: string
  createdAt: string
}

const Ctx = createContext<readonly InitialVerifiedSpot[]>([])

export function VerifiedSpotsProvider({
  initial,
  children,
}: {
  initial: readonly InitialVerifiedSpot[]
  children: ReactNode
}) {
  return <Ctx.Provider value={initial}>{children}</Ctx.Provider>
}

export function useInitialVerifiedSpots(): readonly InitialVerifiedSpot[] {
  return useContext(Ctx)
}
