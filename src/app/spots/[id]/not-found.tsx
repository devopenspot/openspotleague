import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto my-12 max-w-md rounded-[16px] border border-outline-variant bg-surface-bright p-6 text-center">
      <h2 className="font-display text-base font-bold uppercase">404 · Off the grid</h2>
      <p className="mt-2 text-xs text-secondary">Spot not found — explore nearby.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Link href="/explore" className="min-h-11 rounded-full bg-on-surface px-4 text-xs font-bold uppercase flex items-center text-surface">
          Explore spots
        </Link>
        <Link href="/" className="min-h-11 rounded-full border border-outline px-4 text-xs font-bold uppercase flex items-center">
          Back to directory
        </Link>
      </div>
    </div>
  );
}
