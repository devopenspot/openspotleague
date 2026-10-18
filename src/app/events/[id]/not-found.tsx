import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto my-12 max-w-md rounded-[16px] border border-outline-variant bg-surface-bright p-6 text-center">
      <h2 className="font-display text-base font-bold uppercase">404 · Event not on circuit</h2>
      <p className="mt-2 text-xs text-secondary">This event could not be found.</p>
      <Link href="/explore" className="mt-5 inline-flex min-h-11 rounded-full bg-on-surface px-5 text-xs font-bold uppercase items-center text-surface">
        Explore events
      </Link>
    </div>
  );
}
