import { generateText } from "ai";
import { buildCommentaryFallback } from "@/lib/ai/fallback";
import { getAiTextModel } from "@/lib/ai/provider";
import { buildDashboardModel, buildDefaultFilters } from "@/lib/mis/engine";
import { loadAvailableMisDataset } from "@/lib/mis/runtime-dataset";
import { COMMENTARY_SYSTEM_PROMPT, buildCommentaryDataContext } from "@/lib/ai/prompts";
import type { ExecutiveView } from "@/lib/mis/types";

export async function POST(req: Request) {
  const { view, filters, datasetId } = (await req.json()) as {
    view: ExecutiveView;
    filters?: unknown;
    datasetId?: string;
  };

  const dataset = await loadAvailableMisDataset(datasetId);
  const currentFilters = filters ?? buildDefaultFilters(dataset);
  const model = buildDashboardModel(dataset, currentFilters as Parameters<typeof buildDashboardModel>[1]);
  const fallbackCommentary = buildCommentaryFallback(view, model);
  const aiModel = getAiTextModel();

  if (!aiModel) {
    return Response.json({
      commentary: fallbackCommentary,
      source: "rule-based",
    });
  }

  const viewPrompts: Record<ExecutiveView, string> = {
    ceo: "Generate CEO-level strategic commentary. Start each bullet with a bold insight label (e.g., 'Revenue Gap:', 'Growth Signal:', 'Portfolio Spread:'). Focus on revenue achievement, top/bottom performing divisions, market position, and momentum signals. Close with a 90-Day Focus bullet. Keep it visionary and action-oriented.",
    cfo: "Generate CFO-level financial commentary. Start each bullet with a bold insight label (e.g., 'Margin Alert:', 'Cost Signal:', 'Conversion Risk:'). Focus on P&L analysis, margin trends, the conversion bridge from revenue to EBIT, variance vs AOP, and cost control levers. Close with a 90-Day Focus bullet. Be precise with numbers.",
    chairman: "Generate Chairman-level board commentary. Start each bullet with a bold insight label (e.g., 'Strategic Signal:', 'Governance Risk:', 'Value Creation:'). Focus on strategic milestones, competitive positioning, shareholder value creation, and governance-level risks. Close with a 90-Day Focus bullet.",
  };

  const dataContext = buildCommentaryDataContext(model, currentFilters as Parameters<typeof buildDashboardModel>[1], view);

  try {
    const { text } = await generateText({
      model: aiModel.model,
      system: `${COMMENTARY_SYSTEM_PROMPT}\n\n${dataContext}`,
      prompt: viewPrompts[view],
    });

    return Response.json({ commentary: text, source: "ai" });
  } catch {
    return Response.json({
      commentary: fallbackCommentary,
      source: "rule-based",
    });
  }
}
