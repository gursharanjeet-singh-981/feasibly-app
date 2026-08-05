import { describe, it, expect, vi } from "vitest";
import { renameGroupItems } from "./groupHelpers";

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
