import { existsSync, readFileSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { formatRecallOutput } from "../src/core/format-recall";
import { getActiveLineageEntryIdsFromEntries } from "../src/core/lineage";
import { loadAllMessages } from "../src/core/load-messages";
import { searchEntries } from "../src/core/search-entries";

interface RecallRequest {
  query?: string;
  page?: number;
  scope?: "lineage" | "all";
  expand?: number[];
}

const PAGE_SIZE = 5;
const DEFAULT_RECENT = 25;

const sessionRoot = (): string =>
  process.env.PI_CODING_AGENT_SESSION_DIR ?? join(homedir(), ".pi", "agent", "sessions");

const findSessionFile = (root: string, sessionId: string): string => {
  if (!existsSync(root)) throw new Error(`Session directory does not exist: ${root}`);

  const matches: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith(`_${sessionId}.jsonl`)) matches.push(path);
    }
  };
  walk(root);

  if (matches.length !== 1) {
    throw new Error(`Expected one session for ${sessionId}, found ${matches.length}`);
  }
  return matches[0];
};

const readEntries = (sessionFile: string): Array<{ id?: string; parentId?: string | null }> =>
  readFileSync(sessionFile, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });

const recall = (sessionFile: string, request: RecallRequest): string => {
  const allowedEntryIds = request.scope === "all"
    ? undefined
    : getActiveLineageEntryIdsFromEntries(readEntries(sessionFile));
  const expand = new Set(request.expand ?? []);

  if (expand.size > 0 && !request.query?.trim()) {
    const { rendered } = loadAllMessages(sessionFile, true, allowedEntryIds);
    const byIndex = new Map(rendered.map((entry) => [entry.index, entry]));
    const missing = [...expand].filter((index) => !byIndex.has(index));
    if (missing.length > 0) throw new Error(`Cannot expand message indices: ${missing.join(", ")}`);
    return formatRecallOutput([...expand].map((index) => byIndex.get(index)!));
  }

  const { rendered, rawMessages } = loadAllMessages(sessionFile, false, allowedEntryIds);
  if (!request.query?.trim()) return formatRecallOutput(rendered.slice(-DEFAULT_RECENT));

  const results = searchEntries(rendered, rawMessages, request.query);
  const page = Math.max(1, request.page ?? 1);
  const start = (page - 1) * PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const header = `Page ${page}/${totalPages} (${results.length} total matches)`;
  return formatRecallOutput(results.slice(start, start + PAGE_SIZE), request.query, header);
};

const main = (): void => {
  const sessionId = process.env.PI_SESSION_ID;
  if (!sessionId) throw new Error("PI_SESSION_ID is not set");
  const input = readFileSync(0, "utf8").trim();
  const request = input ? JSON.parse(input) as RecallRequest : {};
  process.stdout.write(`${recall(findSessionFile(sessionRoot(), sessionId), request)}\n`);
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
