type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: unknown }
  | ((...args: never[]) => ClassValue);

function toVal(v: ClassValue): string {
  if (v === null || v === undefined || v === false || v === true || v === '')
    return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(toVal).join(' ');
  if (typeof v === 'object') {
    return Object.entries(v)
      .filter(([, val]) => Boolean(val))
      .map(([key]) => key)
      .join(' ');
  }
  if (typeof v === 'function') return toVal((v as () => ClassValue)());
  return '';
}

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .map(toVal)
    .filter(Boolean)
    .join(' ')
    .trim();
}
