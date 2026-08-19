"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store";
import { STORAGE_KEY } from "@/lib/constants";

export function StoreHydration() {
  useEffect(() => {
    // Purge state persisted under the old localStorage-backed key from earlier
    // builds; state now lives in sessionStorage only and must not leak across sessions.
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage may be unavailable (e.g. private browsing); safe to ignore.
    }
    useAppStore.persist.rehydrate();
  }, []);

  return null;
}
