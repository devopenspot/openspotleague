export function verificationCountLabel(count: number): string {
  if (count === 0) return "No verifications yet";
  if (count === 1) return "Verified by 1 rider";
  return `Verified by ${count} riders`;
}

export function isSafeExternalUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
