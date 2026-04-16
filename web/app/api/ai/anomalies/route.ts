import { generateObject } from "ai";
import { z } from "zod";
import { buildAnomaliesFallback } from "@/lib/ai/fallback";
import { getAiTextModel } from "@/lib/ai/provider";
import { buildDashboardModel, buildDefaultFilters } from "@/lib/mis/engine";
import { loadAvailableMisDataset } from "@/lib/mis/runtime-dataset";
import { ANOMALY_SYSTEM_PROMPT, buildAnomalyDataContext } from "@/lib/ai/prompts";

const anomalySchema = z.array(
  z.object({
    severity: z.enum(["Critical", "Warning", "Info"]),
    title: z.string().min(1),
    dimension: z.string().min(1),
    detail: z.string().min(1),
    action: z.string().min(1),
    impactLacs: z.number().describe("Estimated financial impact in lakhs"),
    confidence: z.number().min(0).max(100).describe("Confidence score 0-100"),
    trend: z.enum(["worsening", "stable", "improving"]).describe("Direction of the anomaly"),
  }),
);

export async function POST(req: Request) {
  const { filters, datasetId } = await req.json();
  const dataset = await loadAvailableMisDataset(datasetId);
  const currentFilters = filters ?? buildDefaultFilters(dataset);
  const model = buildDashboardModel(dataset, currentFilters);
  const fallbackAnomalies = buildAnomaliesFallback(model);
  const aiModel = getAiTextModel();

  if (!aiModel) {
    return Response.json({ anomalies: fallbackAnomalies, source: "rule-based" });
  }

  const dataContext = buildAnomalyDataContext(model, currentFilters);

  try {
    const { object: anomalies } = await generateObject({
      model: aiModel.model,
      system: ANOMALY_SYSTEM_PROMPT,
      prompt: `Analyze this MIS data for anomalies and unusual patterns. Quantify the financial impact and assign confidence scores:\n\n${dataContext}`,
      schema: anomalySchema,
    });

    return Response.json({ anomalies, source: "ai" });
  } catch {
    return Response.json({ anomalies: fallbackAnomalies, source: "rule-based" });
  }
}
