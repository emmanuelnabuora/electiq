"use client";

import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const EXAMPLE_QUERIES = [
  "What is the current turnout in Nairobi?",
  "Which constituencies have not fully reported?",
  "Summarize unresolved incidents.",
  "Which polling stations require verification?",
  "Show reporting progress by county.",
  "Generate an election situation summary.",
];

type ChatMessage = { role: "user" | "assistant"; content: string };

export function CopilotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The Copilot could not process that question.");

      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 py-4">
            <p className="text-sm text-neutral">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-light hover:bg-white/5"
                >
                  {q}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "self-end rounded-lg bg-accent/20 px-4 py-2 text-sm text-light"
                : "self-start w-full rounded-lg border border-white/10 bg-panel px-4 py-3 text-sm text-light"
            }
          >
            {m.role === "assistant" && (
              <div className="mb-1 flex items-center gap-1.5 text-xs text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                ElectIQ Copilot
              </div>
            )}
            <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
          </div>
        ))}
        {loading && <p className="text-sm text-neutral">Thinking…</p>}
        {error && <p className="text-sm text-critical">{error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about results, turnout, incidents, integrity alerts…"
          className="flex-1 rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
        />
        <Button type="submit" disabled={loading}>
          <Send className="h-4 w-4" />
          Send
        </Button>
      </form>
    </div>
  );
}
