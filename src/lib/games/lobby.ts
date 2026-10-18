import type { GameMode } from "@/lib/schemas/game"

export function isLobbyReadyForStart(
  mode: GameMode,
  _playerCount: number,
  activePlayerCount: number,
  verifiedPlayerCount: number,
): boolean {
  if (mode === "training") return activePlayerCount >= 2
  return activePlayerCount >= 2 && verifiedPlayerCount >= activePlayerCount
}
