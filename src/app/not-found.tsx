import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      role="alert"
      className="min-h-[60vh] flex items-center justify-center p-6"
    >
      <div className="mx-auto my-12 max-w-md rounded-none-none border border-outline-variant bg-surface-bright p-6 text-center">
        <span className="font-mono text-[10px] font-bold tracking-widest text-secondary uppercase block mb-3">
          404 · Off the map
        </span>
        <h1 className="font-display text-2xl font-bold uppercase tracking-widest text-on-surface">
          Plot not found
        </h1>
        <p className="mt-2 text-xs text-secondary leading-relaxed">
          The page you&rsquo;re scouting doesn&rsquo;t exist on this grid. Head back to the directory and start fresh.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center space-x-2 rounded-none-none bg-on-surface text-surface px-5 py-2 text-xs font-bold tracking-widest uppercase hover:bg-on-surface/90 transition-all"
        >
          <Compass size={14} aria-hidden="true" />
          <span>Back to directory</span>
        </Link>
      </div>
    </div>
  );
}
