import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShortLink } from "@/db/schema";
import type { ShortLinkRepository } from "@/lib/repositories/short-link/short-link-repository";
import { createShortLink, runResolveShortLink } from "./short-links";
import { ShortLinkValidationError } from "@/lib/utils/short-code";

function mockRow(code: string, targetUrl: string, title: string | null = null): ShortLink {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    code,
    targetUrl,
    title,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

const mockRepo: ShortLinkRepository = {
  findByCode: vi.fn(),
  findByTargetUrl: vi.fn(),
  create: vi.fn(),
};

vi.mock("@/lib/repositories", () => ({
  getShortLinkRepositoryAsync: () => Promise.resolve(mockRepo),
}));

describe("short-links service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runResolveShortLink", () => {
    it("returns null immediately for invalid code syntax", async () => {
      const result = await runResolveShortLink("bad!");
      expect(result).toBeNull();
      expect(mockRepo.findByCode).not.toHaveBeenCalled();
    });

    it("fetches code from repository when code is valid", async () => {
      const row = mockRow("7xK9q2A", "/spots/spot-1");
      vi.mocked(mockRepo.findByCode).mockResolvedValueOnce(row);

      const result = await runResolveShortLink("7xK9q2A");
      expect(result).toEqual(row);
      expect(mockRepo.findByCode).toHaveBeenCalledWith("7xK9q2A");
    });
  });

  describe("createShortLink", () => {
    it("deduplicates and returns existing short link if target URL already exists", async () => {
      const existing = mockRow("7xK9q2A", "/spots/spot-1", "Spot 1");
      vi.mocked(mockRepo.findByTargetUrl).mockResolvedValueOnce(existing);

      const result = await createShortLink({ targetUrl: "/spots/spot-1/" });

      expect(result).toEqual(existing);
      expect(mockRepo.findByTargetUrl).toHaveBeenCalledWith("/spots/spot-1");
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it("creates a new short link when target URL is new", async () => {
      vi.mocked(mockRepo.findByTargetUrl).mockResolvedValue(null);
      const created = mockRow("newCod1", "/spots/new-spot", "New Spot");
      vi.mocked(mockRepo.create).mockResolvedValueOnce(created);

      const result = await createShortLink({
        targetUrl: "/spots/new-spot",
        title: "New Spot",
      });

      expect(result).toEqual(created);
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
      const createCall = vi.mocked(mockRepo.create).mock.calls[0]![0];
      expect(createCall.targetUrl).toBe("/spots/new-spot");
      expect(createCall.title).toBe("New Spot");
      expect(createCall.code).toHaveLength(7);
    });

    it("retries when a code collision occurs and succeeds on subsequent attempt", async () => {
      vi.mocked(mockRepo.findByTargetUrl).mockResolvedValue(null);
      const created = mockRow("retryOk", "/spots/collide-spot");

      // First create attempt fails with unique code violation
      vi.mocked(mockRepo.create)
        .mockRejectedValueOnce(new Error("duplicate key value violates unique constraint \"short_links_code_idx\" (23505)"))
        .mockResolvedValueOnce(created);

      const result = await createShortLink({ targetUrl: "/spots/collide-spot" });

      expect(result).toEqual(created);
      expect(mockRepo.create).toHaveBeenCalledTimes(2);
    });

    it("recovers from concurrent race when target_url is created by another request", async () => {
      const raceWinner = mockRow("winner1", "/spots/race-spot");

      // The dedupe read returns null
      vi.mocked(mockRepo.findByTargetUrl)
        .mockResolvedValueOnce(null)
        // Race check inside catch returns the winner
        .mockResolvedValueOnce(raceWinner);

      vi.mocked(mockRepo.create).mockRejectedValueOnce(
        new Error("duplicate key value violates unique constraint \"short_links_target_url_idx\" (23505)")
      );

      const result = await createShortLink({ targetUrl: "/spots/race-spot" });

      expect(result).toEqual(raceWinner);
    });

    it("throws ShortLinkValidationError for invalid target URLs", async () => {
      await expect(
        createShortLink({ targetUrl: "https://evil.com/phish" })
      ).rejects.toThrow(ShortLinkValidationError);
    });
  });
});
