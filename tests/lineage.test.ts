import { describe, it, expect } from "bun:test";
import { getActiveLineageEntryIds, getActiveLineageEntryIdsFromEntries } from "../src/core/lineage";

describe("getActiveLineageEntryIds", () => {
  it("returns IDs from active branch", () => {
    const ids = getActiveLineageEntryIds({
      getBranch: () => [{ id: "a" }, { id: "b" }, { id: "c" }],
    });
    expect([...ids]).toEqual(["a", "b", "c"]);
  });

  it("falls back to getEntries when getBranch throws", () => {
    const ids = getActiveLineageEntryIds({
      getBranch: () => {
        throw new Error("boom");
      },
      getEntries: () => [{ id: "x" }, { id: "y" }],
    });
    expect([...ids]).toEqual(["x", "y"]);
  });

  it("returns empty set when both branch and entries are unavailable", () => {
    const ids = getActiveLineageEntryIds({
      getBranch: () => {
        throw new Error("boom");
      },
      getEntries: () => {
        throw new Error("boom2");
      },
    });
    expect(ids.size).toBe(0);
  });
});

describe("getActiveLineageEntryIdsFromEntries", () => {
  it("walks from the latest entry through its parents", () => {
    const entries = [
      { id: "root" },
      { id: "kept", parentId: "root" },
      { id: "other", parentId: "root" },
      { id: "leaf", parentId: "kept" },
    ];

    expect(getActiveLineageEntryIdsFromEntries(entries)).toEqual(new Set(["leaf", "kept", "root"]));
  });
});
