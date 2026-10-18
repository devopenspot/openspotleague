import { InvalidConcurrencyTokenError, InvalidReferenceError } from "./errors";

export abstract class BaseDrizzleRepository {
  protected limitClamp(limit: number, hardCap: number): number {
    if (!Number.isFinite(limit)) return hardCap;
    return Math.min(Math.max(Math.trunc(limit), 1), hardCap);
  }

  protected parseExpectedUpdatedAt(value: string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      throw new InvalidConcurrencyTokenError();
    }
    return parsed;
  }

  protected assertFound<T>(row: T | null | undefined, message: string): T {
    if (!row) throw new InvalidReferenceError(message);
    return row;
  }
}
