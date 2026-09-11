/**
 * Provider-independent LLM gateway (Section 4: "Provider-independent LLM
 * gateway"). The Copilot service (src/lib/copilot/service.ts) only talks
 * to this interface — swapping providers means writing a new
 * implementation of `LLMProvider`, not touching the tool-calling loop or
 * any of the 8 tools.
 */

export type LLMToolUse = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type LLMTurn = {
  text: string;
  toolUses: LLMToolUse[];
  stopReason: "tool_use" | "end_turn" | "max_tokens" | string;
};

export type LLMMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool_result"; toolUseId: string; content: string };

export interface LLMProvider {
  readonly isConfigured: boolean;
  complete(params: {
    system: string;
    messages: LLMMessage[];
    tools: Array<{ name: string; description: string; input_schema: unknown }>;
  }): Promise<LLMTurn>;
}
