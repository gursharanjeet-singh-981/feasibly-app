import type { Dispatch, SetStateAction } from "react";

interface Identifiable {
  id: number;
  isSelected: boolean;
}

export function toggleGroup(
  group: string,
  setOpenGroups: Dispatch<SetStateAction<Set<string>>>
) {
  setOpenGroups((prev) => {
    const next = new Set(prev);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    return next;
  });
}

export function toggleAllInGroup<T extends Identifiable>(
  group: string,
  grouped: Map<string, T[]>,
  setSelection: (ids: number[], isSelected: boolean) => void
) {
  const items = grouped.get(group);
  if (!items) return;
  const allSelected = items.every((i) => i.isSelected);
  setSelection(items.map((i) => i.id), !allSelected);
}

export function renameGroupItems<T extends { id: number }>(
  oldName: string,
  newName: string,
  items: T[],
  nameKey: keyof T,
  updateItem: (id: number, updates: Partial<T>) => void,
  setOpenGroups: Dispatch<SetStateAction<Set<string>>>
) {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;
  const existingNames = new Set(items.map((i) => i[nameKey] as string));
  if (existingNames.has(trimmed)) return;
  for (const item of items) {
    if (item[nameKey] === oldName) {
      updateItem(item.id, { [nameKey]: trimmed } as Partial<T>);
    }
  }
  setOpenGroups((prev) => {
    const next = new Set(prev);
    if (next.has(oldName)) {
      next.delete(oldName);
      next.add(trimmed);
    }
    return next;
  });
}

export function addItemAndScroll(
  addFn: () => void,
  groupName: string,
  setOpenGroups: Dispatch<SetStateAction<Set<string>>>
) {
  addFn();
  setOpenGroups((prev) => new Set(prev).add(groupName));
  setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 100);
}
