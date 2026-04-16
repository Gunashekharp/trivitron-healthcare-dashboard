import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

export function getAiTextModel() {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic" as const,
      label: "Claude Sonnet 4",
      model: anthropic("claude-sonnet-4-20250514"),
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai" as const,
      label: "GPT-4.1",
      model: openai("gpt-4.1"),
    };
  }

  return null;
}
