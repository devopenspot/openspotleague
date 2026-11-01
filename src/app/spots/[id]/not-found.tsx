import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto my-12 max-w-md rounded-[16px] border border-outline-variant bg-surface-bright p-6 text-center">
      <h2 className="font-display text-2xl font-bold uppercase leading-[1.3] tracking-[-0.02em]">404 · Off the grid</h2>
      <p className="mt-2 text-sm font-semibold leading-5 text-secondary">Spot not found — explore nearby.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/explore" className="flex min-h-12 items-center rounded-lg border-2 border-on-surface bg-on-surface px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-surface transition-[background-color,transform] hover:bg-on-surface/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px">
          Explore spots
        </Link>
        <Link href="/" className="flex min-h-12 items-center rounded-lg border-2 border-on-surface px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,transform] hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px">
          Back to directory
        </Link>
      </div>
    </div>
  );
}
