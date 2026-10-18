/**
 * @deprecated Import from "@/lib/storage" instead.
 * This shim is kept for 1 release to avoid breaking dynamic `import("@/lib/supabase/storage")`
 * in `drizzle-spot-repository.ts:119` etc. All logic now lives in `src/lib/storage/index.ts`
 * which switches between R2 (S3) and Supabase via `STORAGE_PROVIDER`.
 */
export * from "@/lib/storage"
