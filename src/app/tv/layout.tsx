import type { CSSProperties } from "react";

// TV-scoped theme: deep blue-black canvas (streaming-app feel). Overriding
// `--color-wire` here re-skins every `bg-wire` / `from-wire` surface inside
// /tv without touching the rest of the app.
const tvTheme = { "--color-wire": "#060912" } as CSSProperties;

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-wire text-white" style={tvTheme}>
      {children}
    </div>
  );
}
