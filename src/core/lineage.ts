export interface LineageEntryLike {
  id?: string;
  parentId?: string | null;
}

export interface LineageSessionManagerLike {
  getBranch: () => LineageEntryLike[];
  getEntries?: () => LineageEntryLike[];
}

export const getActiveLineageEntryIds = (sessionManager: LineageSessionManagerLike): Set<string> => {
  try {
    const branch = sessionManager.getBranch() ?? [];
    if (branch.length > 0) {
      return new Set(branch.map((e) => e.id).filter((id): id is string => Boolean(id)));
    }
  } catch {
    // fall through to defensive fallback
  }

  try {
    const all = sessionManager.getEntries?.() ?? [];
    return new Set(all.map((e) => e.id).filter((id): id is string => Boolean(id)));
  } catch {
    return new Set();
  }
};

export const getActiveLineageEntryIdsFromEntries = (entries: LineageEntryLike[]): Set<string> => {
  const byId = new Map(entries.flatMap((entry) => entry.id ? [[entry.id, entry] as const] : []));
  let entry = entries.findLast((candidate) => candidate.id);
  const ids = new Set<string>();

  while (entry?.id && !ids.has(entry.id)) {
    ids.add(entry.id);
    entry = entry.parentId ? byId.get(entry.parentId) : undefined;
  }

  return ids;
};
