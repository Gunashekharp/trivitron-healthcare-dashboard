"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, User, X, Loader2, RotateCcw, Filter, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AiChatbotLogo } from "@/components/icons/ai-chatbot-logo";
import { cn } from "@/lib/mis/utils";
import { useDashboardStore } from "@/lib/store";
import type { MisFilters } from "@/lib/mis/types";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "I’m your AI financial analyst for Trivitron Healthcare. Ask about revenue gaps, margin movement, top risks, business-unit performance, or what actions matter most in the current filtered view.",
};

function summarizeScope(filters: MisFilters) {
  const parts = [`${filters.monthKeys.length} months`, `${filters.scenarios.length} scenarios`];

  if (filters.types.length > 0) parts.push(`${filters.types.length} business units`);
  if (filters.divisions.length > 0) parts.push(`${filters.divisions.length} geographies`);
  if (filters.subDivisions.length > 0) parts.push(`${filters.subDivisions.length} sub-divisions`);
  if (filters.categories.length > 0) parts.push(`${filters.categories.length} categories`);
  if (filters.lineItems.length > 0) parts.push(`${filters.lineItems.length} line items`);

  return parts.join(" · ");
}

function renderMessageLines(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, ""));
}

export function AiChatPanel({ datasetId }: { datasetId?: string }) {
  const { aiChatOpen, closeAiChat, filters } = useDashboardStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);

  const scopeSummary = useMemo(() => summarizeScope(filters), [filters]);
  const hasScopedFilters =
    filters.types.length > 0 ||
    filters.divisions.length > 0 ||
    filters.subDivisions.length > 0 ||
    filters.categories.length > 0 ||
    filters.lineItems.length > 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            filters,
            datasetId,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              content: err.error ?? "Something went wrong. Please try again.",
            },
          ]);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let assistantContent = "";
        const assistantId = `assistant-${Date.now()}`;

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: assistantContent } : m,
            ),
          );
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content:
              "Connection error. Check whether the AI service is reachable and whether an AI provider API key is configured correctly.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [datasetId, messages, filters, loading],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const quickQueries = [
    "What's driving the revenue gap vs AOP?",
    "Which division needs immediate attention?",
    "Summarize the P&L performance",
    "What are the key risks this quarter?",
  ];

  const clearConversation = () => {
    setMessages([INITIAL_MESSAGE]);
    setInput("");
  };

  return (
    <AnimatePresence>
      {aiChatOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm"
            onClick={closeAiChat}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-slate-100 bg-white/98 shadow-[0_0_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="border-b border-slate-100 bg-gradient-to-br from-violet-50/70 via-white to-white px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-2 text-white shadow-sm">
                    <AiChatbotLogo className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-800">AI Analyst</div>
                    <div className="text-[11px] font-medium text-slate-500">
                      Ask natural questions and get answers tied to the current dashboard scope.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearConversation}
                      className="h-8 gap-1.5 px-2.5 text-[10px]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={closeAiChat} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="success">Powered by AI</Badge>
                <Badge variant="outline">Current scope: {scopeSummary}</Badge>
                {hasScopedFilters && (
                  <Badge variant="default" className="gap-1">
                    <Filter className="h-3 w-3" />
                    Narrowed view
                  </Badge>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="space-y-4 px-5 py-4">
                {messages.length === 1 && (
                  <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/70 via-white to-white p-4">
                    <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-500">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Good prompts
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      Ask for drivers, actions, comparisons, or outlook. The assistant will answer using the current
                      filtered data slice rather than the full dataset.
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        msg.role === "assistant"
                          ? "bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600"
                          : "bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600",
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <AiChatbotLogo className="h-3.5 w-3.5" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-[0_4px_16px_rgba(15,23,42,0.03)]",
                        msg.role === "assistant"
                          ? "border border-slate-100 bg-white text-slate-700"
                          : "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
                      )}
                    >
                      <div
                        className={cn(
                          "mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em]",
                          msg.role === "assistant" ? "text-slate-400" : "text-blue-100",
                        )}
                      >
                        {msg.role === "assistant" ? "Analyst" : "You"}
                      </div>
                      <div className="space-y-2">
                        {renderMessageLines(msg.content).map((line, index) => (
                          <p key={`${msg.id}-${index}`} className="whitespace-pre-wrap">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600">
                      <AiChatbotLogo className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-[0_4px_16px_rgba(15,23,42,0.03)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analyzing current filters...
                    </div>
                  </motion.div>
                )}

                {messages.length <= 1 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                      Quick questions
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {quickQueries.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => sendMessage(q)}
                          className="block rounded-2xl border border-slate-100 bg-white px-3 py-3 text-left text-xs font-semibold text-slate-600 transition-all hover:border-violet-200 hover:bg-violet-50/30 hover:text-violet-700"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-white/95 px-5 py-3">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about revenue, risks, outlook, or actions..."
                  className="flex-1 text-sm"
                  disabled={loading}
                />
                <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 text-[10px] font-medium text-slate-400">
                Answers are grounded in the current dashboard filters and live AI availability.
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
