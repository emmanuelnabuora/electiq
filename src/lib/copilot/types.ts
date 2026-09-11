/**
 * Every Copilot tool follows this shape. `execute` re-checks permissions
 * itself (never trusts that the model only asked for things the user is
 * allowed to see) and returns `sources` — a human-readable description of
 * exactly what was queried, for the response's required DATA SOURCES
 * section (Section 7). A permission failure is returned as data, not
 * thrown, so the model can honestly tell the person their role doesn't
 * allow that view rather than silently working around it.
 */
export type ToolResult = {
  data: unknown;
  sources: string[];
  deniedReason?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (userId: string, input: Record<string, unknown>) => Promise<ToolResult>;
};
