import type { ShortLink } from "@/db/schema";

export interface CreateShortLinkInput {
  code: string;
  targetUrl: string;
  title?: string | null;
}

export interface ShortLinkRepository {
  findByCode(code: string): Promise<ShortLink | null>;
  findByTargetUrl(targetUrl: string): Promise<ShortLink | null>;
  create(input: CreateShortLinkInput): Promise<ShortLink>;
}
