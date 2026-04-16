import { generateText } from "ai";
import { buildChatFallback } from "@/lib/ai/fallback";
import { getAiTextModel } from "@/lib/ai/provider";
import { buildDashboardModel, buildDefaultFilters } from "@/lib/mis/engine";
import { loadAvailableMisDataset } from "@/lib/mis/runtime-dataset";
import { MIS_SYSTEM_PROMPT, buildChatDataContext } from "@/lib/ai/prompts";

export async function POST(req: Request) {
  const { messages, filters, datasetId } = await req.json();
  const dataset = await loadAvailableMisDataset(datasetId);
  const currentFilters = filters ?? buildDefaultFilters(dataset);
  const model = buildDashboardModel(dataset, currentFilters);
  const latestUserMessage =
    [...messages].reverse().find((message) => message.role === "user")?.content ??
    "Summarize the current dashboard state.";

  const fallbackResponse = buildChatFallback(latestUserMessage, model, currentFilters);
  const aiModel = getAiTextModel();

  if (!aiModel) {
    return new Response(fallbackResponse, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const dataContext = buildChatDataContext(model, currentFilters, latestUserMessage);

  try {
    const { text } = await generateText({
      model: aiModel.model,
      system: `${MIS_SYSTEM_PROMPT}\n\n${dataContext}`,
      messages,
    });

    return new Response(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return new Response(fallbackResponse, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
