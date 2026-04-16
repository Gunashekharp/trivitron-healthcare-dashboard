import { generateObject } from "ai";
import { z } from "zod";
import { buildForecastFallback } from "@/lib/ai/fallback";
import { getAiTextModel } from "@/lib/ai/provider";
import { buildDashboardModel, buildDefaultFilters } from "@/lib/mis/engine";
import { loadAvailableMisDataset } from "@/lib/mis/runtime-dataset";
import { FORECAST_SYSTEM_PROMPT, buildForecastDataContext } from "@/lib/ai/prompts";

const forecastSchema = z.object({
  nextQuarterRevenue: z.object({
    low: z.number(),
    base: z.number(),
    high: z.number(),
  }),
  aopAchievementProbability: z.number(),
  forecastConfidence: z.number().min(0).max(100).describe("Overall confidence in the forecast"),
  marginOutlook: z.string().min(1),
  marginTrend: z.enum(["expanding", "stable", "compressing"]).describe("Margin direction"),
  keyRisks: z.array(
    z.object({
      risk: z.string().min(1),
      probability: z.enum(["Low", "Medium", "High"]),
      impact: z.enum(["Low", "Medium", "High"]),
    }),
  ),
  scenarios: z.object({
    best: z.string().min(1),
    base: z.string().min(1),
    stress: z.string().min(1),
  }),
  topActions: z.array(z.string()).describe("Top 3 recommended actions to improve outlook"),
});

export async function POST(req: Request) {
  const { filters, datasetId } = await req.json();
  const dataset = await loadAvailableMisDataset(datasetId);
  const currentFilters = filters ?? buildDefaultFilters(dataset);
  const model = buildDashboardModel(dataset, currentFilters);
  const fallbackForecast = buildForecastFallback(model);
  const aiModel = getAiTextModel();

  if (!aiModel) {
    return Response.json({
      forecast: fallbackForecast,
      source: "rule-based",
    });
  }

  const dataContext = buildForecastDataContext(model, currentFilters);

  try {
    const { object: forecast } = await generateObject({
      model: aiModel.model,
      system: FORECAST_SYSTEM_PROMPT,
      prompt: `Based on this historical MIS data, generate a forward-looking forecast with confidence scores and recommended actions:\n\n${dataContext}`,
      schema: forecastSchema,
    });

    return Response.json({ forecast, source: "ai" });
  } catch {
    return Response.json({ forecast: fallbackForecast, source: "rule-based" });
  }
}
