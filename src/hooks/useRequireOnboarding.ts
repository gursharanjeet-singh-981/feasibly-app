"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { ROUTES } from "@/lib/constants";

// Set when the user submits onboarding in this page load. It lives in memory, so a direct visit
// or a browser refresh of a gated page starts with it unset and sends the user back to onboarding.
let enteredFromOnboarding = false;

/** Call before moving from onboarding to a gated page. */
export function markEnteredFromOnboarding(): void {
  enteredFromOnboarding = true;
}

/**
 * Gates /components and /templates. Redirects to /onboarding unless the user has set up a project
 * and reached this page through onboarding in the current page load (not by a direct visit or a
 * browser refresh). Returns `true` once it's safe to render the gated page.
 */
export function useRequireOnboarding(): boolean {
  const router = useRouter();
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const allowed = hasOnboarded && enteredFromOnboarding;

  useEffect(() => {
    if (hasHydrated && !allowed) {
      router.replace(ROUTES.onboarding);
    }
  }, [hasHydrated, allowed, router]);

  return hasHydrated && allowed;
}
