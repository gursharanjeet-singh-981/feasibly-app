import { useMemo } from "react";

export function useGroupedItems<T>(
  items: T[],
  getGroup: (item: T) => string,
  search: string,
  matchers: (item: T) => Array<string | undefined>,
): Map<string, T[]> {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? items.filter((i) =>
          matchers(i).some((s) => (s ?? "").toLowerCase().includes(q)),
        )
      : items;
    const map = new Map<string, T[]>();
    for (const i of filtered) {
      const g = getGroup(i) || "Other";
      const bucket = map.get(g);
      if (bucket) bucket.push(i);
      else map.set(g, [i]);
    }
    return map;
  }, [items, search, getGroup, matchers]);
}
