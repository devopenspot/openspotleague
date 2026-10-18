"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { ToastViewport } from "@/components/shell/Toast";
import { UserAvatar } from "@/components/ui";
import { useUser } from "@/lib/contexts/user-context";
import { MAIN_CONTENT_ID } from "@/lib/config/constants";
import { AdminSidebar } from "./AdminSidebar";
import type { ReactNode } from "react";

export function AdminShell({ children }: { children: ReactNode }) {
  const user = useUser();
  if (!user) return null;
  return (
    <div
      id="app-root"
      className="flex min-h-screen flex-col bg-surface font-sans text-on-surface"
    >
      <header
        id="app-header"
        className="sticky top-0 z-40 w-full border-b border-outline-variant bg-surface-container-lowest px-4 py-3 md:px-8"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <span
              aria-hidden="true"
              className="hidden font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary sm:inline"
            >
              /
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
               {user.isAdministrator ? "Admin" : "Curation"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="sm" />
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-secondary transition-colors duration-150 ease-out hover:bg-surface-container-low hover:text-on-surface active:scale-[0.99]"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              Directory
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-8">
        <AdminSidebar />
        <main
          id={MAIN_CONTENT_ID}
          aria-label="Admin content"
          className="min-w-0 flex-1"
        >
          {children}
        </main>
      </div>

      <ToastViewport />
    </div>
  );
}
