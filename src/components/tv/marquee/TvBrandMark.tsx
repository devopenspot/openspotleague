import Image from "next/image";

/**
 * Bottom-right corner mark on TV cards (the "prime" slot in the reference
 * mockups). Placeholder: reuses the current favicon until a dedicated
 * TV badge icon is designed.
 */
export function TvBrandMark() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_1px_6px_rgba(0,0,0,0.55)] ring-1 ring-black/20"
    >
      <Image
        src="/favicon.png"
        alt=""
        width={24}
        height={24}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
