import type { MatchMetadata } from "./types";

export function countMatchedGroups(
  record: Record<number, MatchMetadata>,
): number {
  const groups = new Set(
    Object.values(record)
      .map((metadata) => metadata.group?.trim().toLowerCase())
      .filter((group): group is string => Boolean(group)),
  );
  return groups.size > 0 ? groups.size : Object.keys(record).length;
}