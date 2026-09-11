import { resultsTool } from "@/lib/copilot/tools/results-tool";
import { turnoutTool } from "@/lib/copilot/tools/turnout-tool";
import { incidentTool } from "@/lib/copilot/tools/incident-tool";
import { integrityTool } from "@/lib/copilot/tools/integrity-tool";
import { mapTool } from "@/lib/copilot/tools/map-tool";
import { auditTool } from "@/lib/copilot/tools/audit-tool";
import { reportTool } from "@/lib/copilot/tools/report-tool";
import { electionSearchTool } from "@/lib/copilot/tools/election-search-tool";
import type { ToolDefinition } from "@/lib/copilot/types";

export const COPILOT_TOOLS: ToolDefinition[] = [
  resultsTool,
  turnoutTool,
  incidentTool,
  integrityTool,
  mapTool,
  auditTool,
  reportTool,
  electionSearchTool,
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return COPILOT_TOOLS.find((t) => t.name === name);
}
