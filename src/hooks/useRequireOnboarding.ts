"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { ROUTES } from "@/lib/constants";

/**
 * Redirects to /onboarding if the current session has no active project
 * (e.g. /components or /templates was hit directly, or the session storage
 * was cleared). Returns `true` once it's safe to render the gated page.
 */
export function useRequireOnboarding(): boolean {
  const router = useRouter();
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);

  useEffect(() => {
    if (hasHydrated && !hasOnboarded) {
      router.replace(ROUTES.onboarding);
    }
  }, [hasHydrated, hasOnboarded, router]);

  return hasHydrated && hasOnboarded;
}
