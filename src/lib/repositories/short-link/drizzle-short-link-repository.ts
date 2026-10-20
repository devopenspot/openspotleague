import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/postgres-js";
import { shortLinks, type ShortLink } from "@/db/schema";
import type { CreateShortLinkInput, ShortLinkRepository } from "./short-link-repository";

export class DrizzleShortLinkRepository implements ShortLinkRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async findByCode(code: string): Promise<ShortLink | null> {
    const [row] = await this.db
      .select()
      .from(shortLinks)
      .where(eq(shortLinks.code, code))
      .limit(1);

    return row ?? null;
  }

  async findByTargetUrl(targetUrl: string): Promise<ShortLink | null> {
    const [row] = await this.db
      .select()
      .from(shortLinks)
      .where(eq(shortLinks.targetUrl, targetUrl))
      .limit(1);

    return row ?? null;
  }

  async create(input: CreateShortLinkInput): Promise<ShortLink> {
    const [row] = await this.db
      .insert(shortLinks)
      .values({
        code: input.code,
        targetUrl: input.targetUrl,
        title: input.title ?? null,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create short link row");
    }

    return row;
  }
}
