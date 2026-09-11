import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { COPILOT_TOOLS, getToolByName } from "@/lib/copilot/tools";
import { AnthropicProvider } from "@/lib/copilot/providers/anthropic";
import type { LLMProvider, LLMMessage } from "@/lib/copilot/gateway";

const SYSTEM_PROMPT = `You are ElectIQ Copilot, an election-administration decision-support assistant.

You may only answer using the structured tools provided — never invent election figures, candidate names, or statistics that a tool did not return. If a tool denies access (deniedReason), tell the person plainly that their role does not have that permission; do not work around it or guess at an answer instead.

Every response must use exactly this structure:

ANSWER
(direct answer to the question)

KEY FINDINGS
(the specific facts, as bullet points, each traceable to a tool result)

DATA SOURCES
(list the tool(s) and underlying records used — copy from each tool result's "sources" field)

LIMITATIONS
(what this data does NOT show — e.g. "figures are provisional/unverified," "reporting is incomplete," "no data available for X")

RECOMMENDED REVIEW
(what a human should check next, if anything — never a determination of fraud or wrongdoing)

Rules:
- Always distinguish published/official results from provisional/live figures. Never state a live figure as if it were certified.
- Distinguish a statistical alert (from IntegrityTool) from a confirmed finding. An alert means "requires verification," never "fraud detected."
- Never provide individualized political persuasion, voter targeting, or campaign strategy advice.
- Never infer or speculate about any individual's political beliefs.
- If a tool returns no data or an empty result, say so plainly — do not fill the gap with a plausible-sounding invented number.`;

export type CopilotResponse = {
  conversationId: string;
  answer: string;
  toolCalls: Array<{ name: string; input: unknown; result: unknown }>;
  configured: boolean;
};

const MAX_TOOL_ROUNDS = 4;

export async function askCopilot(params: {
  userId: string;
  conversationId?: string;
  message: string;
  provider?: LLMProvider;
}): Promise<CopilotResponse> {
  const provider = params.provider ?? new AnthropicProvider();

  const conversation = params.conversationId
    ? await db.aIConversation.findUniqueOrThrow({ where: { id: params.conversationId } })
    : await db.aIConversation.create({
        data: { userId: params.userId, title: params.message.slice(0, 80) },
      });

  await db.aIMessage.create({
    data: { conversationId: conversation.id, role: "USER", content: params.message },
  });

  if (!provider.isConfigured) {
    const fallback =
      "ANSWER\nThe Copilot's language model is not configured in this environment (no API key set). " +
      "No answer can be generated — nothing below should be treated as a real response.\n\n" +
      "LIMITATIONS\nThis is a configuration message, not a grounded answer to your question.";

    await db.aIMessage.create({
      data: { conversationId: conversation.id, role: "ASSISTANT", content: fallback },
    });

    return { conversationId: conversation.id, answer: fallback, toolCalls: [], configured: false };
  }

  const priorMessages = await db.aIMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });

  const messages: LLMMessage[] = priorMessages
    .slice(0, -1)
    .map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content }));
  messages.push({ role: "user", content: params.message });

  const toolCallLog: Array<{ name: string; input: unknown; result: unknown }> = [];
  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const turn = await provider.complete({
      system: SYSTEM_PROMPT,
      messages,
      tools: COPILOT_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
    });

    if (turn.toolUses.length === 0) {
      finalText = turn.text;
      break;
    }

    messages.push({ role: "assistant", content: turn.text || "(using tools)" });

    for (const use of turn.toolUses) {
      const tool = getToolByName(use.name);
      const result = tool
        ? await tool.execute(params.userId, use.input)
        : { data: null, sources: [], deniedReason: `Unknown tool: ${use.name}` };

      toolCallLog.push({ name: use.name, input: use.input, result });
      messages.push({ role: "tool_result", toolUseId: use.id, content: JSON.stringify(result) });
    }

    if (round === MAX_TOOL_ROUNDS - 1) {
      finalText =
        turn.text || "Reached the maximum number of tool calls for this question — please ask something more specific.";
    }
  }

  await db.aIMessage.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: finalText,
      toolCalls: toolCallLog as never,
    },
  });

  await recordAudit({
    actorId: params.userId,
    action: "COPILOT_QUERY",
    entityType: "AIConversation",
    entityId: conversation.id,
    newState: { toolsUsed: toolCallLog.map((t) => t.name) },
  });

  return { conversationId: conversation.id, answer: finalText, toolCalls: toolCallLog, configured: true };
}
