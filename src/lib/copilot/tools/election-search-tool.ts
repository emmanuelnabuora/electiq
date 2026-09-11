import { db } from "@/lib/db";
import { authorize } from "@/lib/rbac";
import type { ToolDefinition, ToolResult } from "@/lib/copilot/types";

async function execute(userId: string, input: Record<string, unknown>): Promise<ToolResult> {
  const allowed = await authorize(userId, "elections", "read");
  if (!allowed) {
    return { data: null, sources: [], deniedReason: "This role does not have elections.read permission." };
  }

  const query = String(input.query ?? "").trim();
  if (!query) return { data: { message: "No search query provided." }, sources: [] };

  const [candidates, parties, stations] = await Promise.all([
    db.candidate.findMany({
      where: { fullName: { contains: query, mode: "insensitive" } },
      include: { party: true, position: true },
      take: 10,
    }),
    db.party.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { abbreviation: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 10,
    }),
    db.pollingStation.findMany({
      where: {
        OR: [
          { code: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { pollingCenter: { include: { unit: true } } },
      take: 10,
    }),
  ]);

  return {
    data: {
      candidates: candidates.map((c) => ({ name: c.fullName, party: c.party?.abbreviation, position: c.position.name })),
      parties: parties.map((p) => ({ name: p.name, abbreviation: p.abbreviation })),
      pollingStations: stations.map((s) => ({ code: s.code, name: s.name, ward: s.pollingCenter.unit.name })),
    },
    sources: [`Candidate, Party, and PollingStation records matching "${query}"`],
  };
}

export const electionSearchTool: ToolDefinition = {
  name: "ElectionSearchTool",
  description: "Search candidates, parties, and polling stations by name or code.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "Search text." } },
    required: ["query"],
  },
  execute,
};
