// import { HeaderImageOverride } from "@/hooks/ui/useHeaderImage";

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-black text-white">
      {/* <HeaderImageOverride image="/osl-tv.png" /> */}
      {children}
    </div>
  );
}
