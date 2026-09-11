import type { LLMProvider, LLMMessage, LLMTurn, LLMToolUse } from "@/lib/copilot/gateway";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = { role: "user" | "assistant"; content: AnthropicContentBlock[] };

/** Converts this app's provider-agnostic message list into Anthropic's wire format, merging consecutive tool_result entries into one user turn as the API requires. */
function toAnthropicMessages(messages: LLMMessage[]): AnthropicMessage[] {
  const result: AnthropicMessage[] = [];

  for (const m of messages) {
    if (m.role === "user") {
      result.push({ role: "user", content: [{ type: "text", text: m.content }] });
    } else if (m.role === "assistant") {
      result.push({ role: "assistant", content: [{ type: "text", text: m.content }] });
    } else {
      const block: AnthropicContentBlock = { type: "tool_result", tool_use_id: m.toolUseId, content: m.content };
      const last = result[result.length - 1];
      if (last?.role === "user") {
        last.content.push(block);
      } else {
        result.push({ role: "user", content: [block] });
      }
    }
  }
  return result;
}

export class AnthropicProvider implements LLMProvider {
  get isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async complete(params: {
    system: string;
    messages: LLMMessage[];
    tools: Array<{ name: string; description: string; input_schema: unknown }>;
  }): Promise<LLMTurn> {
    if (!this.isConfigured) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: params.system,
        messages: toAnthropicMessages(params.messages),
        tools: params.tools,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      content: AnthropicContentBlock[];
      stop_reason: string;
    };

    let text = "";
    const toolUses: LLMToolUse[] = [];
    for (const block of data.content) {
      if (block.type === "text") text += block.text;
      if (block.type === "tool_use") toolUses.push({ id: block.id, name: block.name, input: block.input });
    }

    return { text, toolUses, stopReason: data.stop_reason };
  }
}
