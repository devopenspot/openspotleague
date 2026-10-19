"use client";

import { ProfileGamesListSkeleton } from "../games/ProfileGamesList";
import { ProfileTricksSkeleton } from "../settings/ProfileTricksPanel";

export function ProfileOverviewSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4 ">
      {/* At a glance skeleton */}
      <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
        <div className="h-4 w-24 rounded bg-surface-container-high" />
        <div className="mt-2 h-3 w-56 rounded bg-surface-container-high" />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[12px] border border-outline-variant bg-surface-container px-2.5 py-2.5"
            >
              <div className="h-3 w-12 rounded bg-surface-container-high" />
              <div className="mt-2 h-4 w-16 rounded bg-surface-container-high" />
              <div className="mt-2 h-3 w-20 rounded bg-surface-container-high" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="h-3 w-20 rounded bg-surface-container-high" />
            <div className="h-3 w-12 rounded bg-surface-container-high" />
          </div>
          <div className="mt-3">
            <ProfileGamesListSkeleton count={3} />
          </div>
        </div>
        <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="h-3 w-14 rounded bg-surface-container-high" />
            <div className="h-3 w-10 rounded bg-surface-container-high" />
          </div>
          <div className="mt-3">
            <ProfileTricksSkeleton compact />
          </div>
        </div>
      </div>
    </div>
  );
}
