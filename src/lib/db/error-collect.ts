export function collectErrorMessages(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < 10 && current; depth++) {
    if (current instanceof Error) {
      if (current.message) parts.push(current.message);
      const cause = (current as { cause?: unknown }).cause;
      current = cause ?? null;
    } else if (typeof current === "string") {
      parts.push(current);
      break;
    } else {
      break;
    }
  }
  return parts.join(": ");
}

export function collectErrorCodes(err: unknown): string[] {
  const codes: string[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < 10 && current; depth++) {
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string") codes.push(code);
      current = (current as { cause?: unknown }).cause ?? null;
    } else {
      break;
    }
  }
  return codes;
}
