import { describe, it, expect, vi } from "vitest";
import { getMatchedItemGroups, renameGroupItems, selectMatchedItems } from "./groupHelpers";

interface Row {
  id: number;
  group: string;
}

describe("renameGroupItems", () => {
  const setOpenGroups = () => {};

  it("returns { ok: false, reason: 'empty' } when name is blank", () => {
    const items: Row[] = [{ id: 1, group: "A" }];
    const update = vi.fn();
    const result = renameGroupItems("A", "  ", items, "group", update, setOpenGroups);
    expect(result).toEqual({ ok: false, reason: "empty" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns { ok: false, reason: 'unchanged' } when name is identical", () => {
    const items: Row[] = [{ id: 1, group: "A" }];
    const update = vi.fn();
    const result = renameGroupItems("A", "A", items, "group", update, setOpenGroups);
    expect(result).toEqual({ ok: false, reason: "unchanged" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns { ok: false, reason: 'duplicate' } when new name matches an existing group", () => {
    const items: Row[] = [
      { id: 1, group: "A" },
      { id: 2, group: "B" },
    ];
    const update = vi.fn();
    const result = renameGroupItems("A", "B", items, "group", update, setOpenGroups);
    expect(result).toEqual({ ok: false, reason: "duplicate" });
    expect(update).not.toHaveBeenCalled();
  });

  it("renames every row that matches the old group name", () => {
    const items: Row[] = [
      { id: 1, group: "A" },
      { id: 2, group: "A" },
      { id: 3, group: "B" },
    ];
    const update = vi.fn();
    const result = renameGroupItems("A", "C", items, "group", update, setOpenGroups);
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, 1, { group: "C" });
    expect(update).toHaveBeenNthCalledWith(2, 2, { group: "C" });
  });

  it("trims whitespace from the new name before applying it", () => {
    const items: Row[] = [{ id: 1, group: "A" }];
    const update = vi.fn();
    const result = renameGroupItems("A", "  New  ", items, "group", update, setOpenGroups);
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(1, { group: "New" });
  });
});

describe("selectMatchedItems", () => {
  it("selects matched rows without changing unmatched rows", () => {
    const items = [
      { id: 1, isSelected: false, group: "A" },
      { id: 2, isSelected: false, group: "B" },
    ];
    expect(selectMatchedItems(items, { 1: {} })).toEqual([
      { id: 1, isSelected: true, group: "A" },
      { id: 2, isSelected: false, group: "B" },
    ]);
  });

  it("returns null when all matched rows are already selected", () => {
    expect(selectMatchedItems([{ id: 1, isSelected: true }], { 1: {} })).toBeNull();
  });
});

describe("getMatchedItemGroups", () => {
  it("returns the groups that contain matched rows", () => {
    const items = [
      { id: 1, group: "Hero" },
      { id: 2, group: "Cards" },
      { id: 3, group: "Hero" },
    ];

    expect(getMatchedItemGroups(items, { 1: {}, 2: {} }, (item) => item.group)).toEqual(
      new Set(["Hero", "Cards"]),
    );
  });

  it("ignores matched ids that are not in the current items", () => {
    expect(
      getMatchedItemGroups([{ id: 1, group: "Hero" }], { 2: {} }, (item) => item.group),
    ).toEqual(new Set());
  });
});
