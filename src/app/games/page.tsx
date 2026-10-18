import { getSessionUser } from "@/lib/auth/server";
import { GameLanding } from "@/components/games/layout/GameLanding";

export default async function GamesPage() {
  const user = await getSessionUser();
  return <GameLanding signedIn={user !== null} />;
}
