import Link from "next/link";
import { CARD, controlClass, SECTION_TITLE } from "@/components/ui/recipes";
export default function NotFound() {
  return (
    <div className={`${CARD} mx-auto my-12 max-w-md text-center sm:p-8`}>
      <h2 className={`${SECTION_TITLE} text-on-surface`}>404 · Off the grid</h2>
      <p className="mt-2 text-sm font-semibold leading-5 text-secondary">Spot not found — explore nearby.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/explore" className={controlClass("primary")}>
          Explore spots
        </Link>
        <Link href="/" className={controlClass("outline")}>
          Back to directory
        </Link>
      </div>
    </div>
  );
}
