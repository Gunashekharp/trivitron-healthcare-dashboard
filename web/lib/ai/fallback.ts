import type { buildDashboardModel } from "@/lib/mis/engine";
import type { ExecutiveView, MisFilters, Recommendation, SeriesPoint } from "@/lib/mis/types";
import { formatLacs, formatPercent, formatVariance } from "@/lib/mis/utils";

type DashboardModel = ReturnType<typeof buildDashboardModel>;

export interface FallbackAnomaly {
  severity: "Critical" | "Warning" | "Info";
  title: string;
  dimension: string;
  detail: string;
  action: string;
  impactLacs: number;
  confidence: number;
  trend: "worsening" | "stable" | "improving";
}

export interface FallbackForecastRisk {
  risk: string;
  probability: "Low" | "Medium" | "High";
  impact: "Low" | "Medium" | "High";
}

export interface FallbackForecast {
  nextQuarterRevenue: { low: number; base: number; high: number };
  aopAchievementProbability: number;
  forecastConfidence: number;
  marginOutlook: string;
  marginTrend: "expanding" | "stable" | "compressing";
  keyRisks: FallbackForecastRisk[];
  scenarios: { best: string; base: string; stress: string };
  topActions: string[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function recentAverage(series: SeriesPoint[], count: number) {
  const values = series.slice(-count).map((point) => point.value);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latestValue(series: SeriesPoint[]) {
  return series.at(-1)?.value ?? 0;
}

function topRecommendation(recommendations: Recommendation[]) {
  return recommendations[0];
}

function topVarianceDrivers(model: DashboardModel) {
  const detailRows = model.plSummary.filter((row) => row.rowType === "detail" && row.aop !== 0);
  const negative = [...detailRows].sort((left, right) => left.variancePct - right.variancePct).slice(0, 2);
  const positive = [...detailRows].sort((left, right) => right.variancePct - left.variancePct).slice(0, 2);

  return { negative, positive };
}

function detectMomentum(series: SeriesPoint[]): "worsening" | "stable" | "improving" {
  if (series.length < 3) return "stable";
  const recent = series.slice(-3).map((p) => p.value);
  if (recent[2] > recent[1] && recent[1] > recent[0]) return "improving";
  if (recent[2] < recent[1] && recent[1] < recent[0]) return "worsening";
  return "stable";
}

function detectMarginTrend(model: DashboardModel): "expanding" | "stable" | "compressing" {
  const margins = model.monthlyMargins.ebit;
  if (margins.length < 3) return "stable";
  const recent = margins.slice(-3).map((p) => p.value);
  if (recent[2] > recent[0] + 0.5) return "expanding";
  if (recent[2] < recent[0] - 0.5) return "compressing";
  return "stable";
}

function summarizeLatestTrend(series: SeriesPoint[], formatter: (value: number) => string) {
  const latest = series.at(-1);
  const previous = series.at(-2);

  if (!latest) {
    return "No recent trend data is available.";
  }

  if (!previous) {
    return `${latest.label} closed at ${formatter(latest.value)}.`;
  }

  const deltaPct = previous.value === 0 ? 0 : ((latest.value - previous.value) / Math.abs(previous.value)) * 100;
  return `${latest.label} closed at ${formatter(latest.value)}, ${formatVariance(deltaPct)} versus ${previous.label}.`;
}

function formatDriverRows(rows: DashboardModel["plSummary"]) {
  if (rows.length === 0) {
    return "No clear line-item driver is visible in the current filter set.";
  }

  return rows
    .map(
      (row) =>
        `${row.lineItem} at ${formatLacs(row.actual)} versus ${formatLacs(row.aop)} AOP (${formatVariance(row.variancePct)})`,
    )
    .join("; ");
}

function summarizeFilters(filters: MisFilters) {
  const parts: string[] = [];

  if (filters.monthKeys.length > 0) {
    const preview = filters.monthKeys.slice(0, 3).join(", ");
    parts.push(
      filters.monthKeys.length > 3
        ? `months ${preview} +${filters.monthKeys.length - 3} more`
        : `months ${preview}`,
    );
  }
  if (filters.scenarios.length > 0) parts.push(`scenarios ${filters.scenarios.join(", ")}`);
  if (filters.types.length > 0) parts.push(`business units ${filters.types.join(", ")}`);
  if (filters.divisions.length > 0) parts.push(`geographies ${filters.divisions.join(", ")}`);
  if (filters.subDivisions.length > 0) parts.push(`sub-divisions ${filters.subDivisions.join(", ")}`);
  if (filters.categories.length > 0) parts.push(`categories ${filters.categories.join(", ")}`);
  if (filters.lineItems.length > 0) parts.push(`line items ${filters.lineItems.join(", ")}`);

  return parts.length > 0 ? parts.join("; ") : "all available dashboard data";
}

function recommendationToAnomaly(recommendation: Recommendation, model: DashboardModel): FallbackAnomaly {
  const severity =
    recommendation.severity === "Critical"
      ? "Critical"
      : recommendation.severity === "Watchlist"
        ? "Warning"
        : "Info";

  const revImpact = Math.abs(model.revenueSummary.actual - model.revenueSummary.aop);
  const estimatedImpact = severity === "Critical" ? revImpact * 0.4 : severity === "Warning" ? revImpact * 0.15 : revImpact * 0.05;

  return {
    severity,
    title: recommendation.title,
    dimension: recommendation.affectedDimension,
    detail: recommendation.explanation,
    action: recommendation.recommendedAction,
    impactLacs: Math.round(estimatedImpact),
    confidence: severity === "Critical" ? 85 : severity === "Warning" ? 65 : 45,
    trend: detectMomentum(model.monthlyRevenue.actual),
  };
}

export function buildCommentaryFallback(view: ExecutiveView, model: DashboardModel) {
  const viewLead: Record<ExecutiveView, string> = {
    ceo: "Strategic revenue and growth view",
    cfo: "Financial control and profitability view",
    chairman: "Board-level strategic oversight view",
  };

  const revMomentum = detectMomentum(model.monthlyRevenue.actual);
  const marginDirection = detectMarginTrend(model);

  const bullets = [
    `Revenue Gap: Revenue is ${formatLacs(model.revenueSummary.actual)} versus ${formatLacs(model.revenueSummary.aop)} AOP, a ${formatVariance(model.revenueSummary.vsAopPct)} gap, while prior year variance stands at ${formatVariance(model.revenueSummary.vsPyPct)}.`,
    `Margin Conversion: Profit conversion remains at ${formatPercent((model.ebitSummary.actual / Math.max(model.revenueSummary.actual, 1)) * 100)} EBIT margin with GM1 at ${formatPercent((model.gm1Summary.actual / Math.max(model.revenueSummary.actual, 1)) * 100)}. Margins are ${marginDirection}.`,
    model.bestDivision && model.worstDivision
      ? `Portfolio Spread: ${model.bestDivision.label} leads at ${formatPercent(model.bestDivision.value)} achievement, while ${model.worstDivision.label} lags at ${formatPercent(model.worstDivision.value)} — a ${formatPercent(model.bestDivision.value - model.worstDivision.value)} spread requiring attention.`
      : "Portfolio Mix: Business-unit achievement is available only at an aggregate level for the current filter selection.",
    `Momentum Signal: Revenue trajectory is ${revMomentum} based on the last 3 months of actuals.`,
    topRecommendation(model.recommendations)
      ? `Priority Action: ${topRecommendation(model.recommendations)?.title} for ${topRecommendation(model.recommendations)?.affectedDimension}. ${topRecommendation(model.recommendations)?.recommendedAction}`
      : "Stability: No high-severity issues are currently flagged in the filtered dashboard view.",
    `90-Day Focus (${viewLead[view]}): ${model.revenueSummary.vsAopPct < 0 ? "Close the AOP gap through targeted acceleration in the top 2-3 business units." : "Sustain the AOP beat while protecting margin conversion through the quarter close."}`,
  ];

  return bullets.map((line) => `- ${line}`).join("\n");
}

export function buildAnomaliesFallback(model: DashboardModel): FallbackAnomaly[] {
  const anomalies = model.recommendations.slice(0, 4).map((rec) => recommendationToAnomaly(rec, model));

  if (anomalies.length > 0) {
    return anomalies;
  }

  return [
    {
      severity: model.revenueSummary.vsAopPct < -5 ? "Warning" : "Info",
      title: "Revenue plan variance",
      dimension: "Consolidated revenue",
      detail: `Revenue is ${formatVariance(model.revenueSummary.vsAopPct)} versus AOP in the current view.`,
      action: "Review the most recent month and weakest business-unit mix to confirm whether the gap is volume or execution related.",
      impactLacs: Math.round(Math.abs(model.revenueSummary.actual - model.revenueSummary.aop)),
      confidence: 75,
      trend: detectMomentum(model.monthlyRevenue.actual),
    },
  ];
}

export function buildForecastFallback(model: DashboardModel): FallbackForecast {
  const actualRevenue = model.monthlyRevenue.actual;
  const recentRunRate = recentAverage(actualRevenue, 3) || latestValue(actualRevenue) || model.revenueSummary.actual;
  const latestMonth = latestValue(actualRevenue);
  const previousMonth = actualRevenue.at(-2)?.value ?? latestMonth;
  const monthTrend = latestMonth - previousMonth;
  const base = Math.max(0, Math.round(recentRunRate * 3 + monthTrend));
  const probability = clamp(
    Math.round(model.achievementPct + (model.revenueSummary.vsAopPct >= 0 ? 5 : -8)),
    5,
    95,
  );

  const marginTrend = detectMarginTrend(model);
  const gm1Margin = (model.gm1Summary.actual / Math.max(model.revenueSummary.actual, 1)) * 100;
  const ebitMargin = (model.ebitSummary.actual / Math.max(model.revenueSummary.actual, 1)) * 100;

  const keyRisks: FallbackForecastRisk[] = model.recommendations.slice(0, 3).map((item) => ({
    risk: `${item.title}: ${item.explanation}`,
    probability: item.severity === "Critical" ? "High" as const : item.severity === "Watchlist" ? "Medium" as const : "Low" as const,
    impact: item.severity === "Critical" ? "High" as const : "Medium" as const,
  }));

  if (keyRisks.length === 0) {
    keyRisks.push({
      risk: "No material risks flagged in the filtered view.",
      probability: "Low",
      impact: "Low",
    });
  }

  return {
    nextQuarterRevenue: {
      low: Math.max(0, Math.round(base * 0.92)),
      base,
      high: Math.max(0, Math.round(base * 1.08)),
    },
    aopAchievementProbability: probability,
    forecastConfidence: clamp(
      Math.round(60 + (actualRevenue.length >= 6 ? 15 : 0) + (Math.abs(model.revenueSummary.vsAopPct) < 10 ? 10 : -5)),
      20,
      90,
    ),
    marginOutlook: `GM1 margin is tracking at ${formatPercent(gm1Margin)} and EBIT margin at ${formatPercent(ebitMargin)}. Margins are ${marginTrend}. Near-term outlook depends on recovering the current ${formatVariance(model.revenueSummary.vsAopPct)} revenue gap without further opex dilution.`,
    marginTrend,
    keyRisks,
    scenarios: {
      best: "A stronger close in the top business units narrows the AOP gap and supports margin recovery.",
      base: "Current run-rate continues with moderate catch-up in revenue and stable gross margins.",
      stress: "Revenue softness persists while fixed-cost absorption weakens EBIT conversion.",
    },
    topActions: [
      "Accelerate revenue in the top 2-3 business units with the largest AOP gaps",
      "Contain opex growth to protect EBIT conversion through the quarter close",
      "Review the weakest business unit for structural vs. cyclical underperformance",
    ],
  };
}

export function buildChatFallback(question: string, model: DashboardModel, filters: MisFilters) {
  const normalizedQuestion = question.toLowerCase();
  const sections: string[] = [];
  const drivers = topVarianceDrivers(model);
  const risks = model.recommendations.slice(0, 3);
  const forecast = buildForecastFallback(model);

  sections.push(`Active filters: ${summarizeFilters(filters)}.`);

  if (
    normalizedQuestion.includes("revenue") ||
    normalizedQuestion.includes("aop") ||
    normalizedQuestion.includes("gap") ||
    normalizedQuestion.includes("achievement")
  ) {
    sections.push(
      `Revenue is ${formatLacs(model.revenueSummary.actual)} versus ${formatLacs(model.revenueSummary.aop)} AOP, a ${formatVariance(model.revenueSummary.vsAopPct)} variance. Against prior year, the view is at ${formatVariance(model.revenueSummary.vsPyPct)}.`,
    );
  }

  if (
    normalizedQuestion.includes("margin") ||
    normalizedQuestion.includes("ebit") ||
    normalizedQuestion.includes("profit") ||
    normalizedQuestion.includes("p&l")
  ) {
    sections.push(
      `GM1 stands at ${formatLacs(model.gm1Summary.actual)}, GM2 at ${formatLacs(model.gm2Summary.actual)}, and EBIT at ${formatLacs(model.ebitSummary.actual)}. EBIT conversion is ${formatPercent((model.ebitSummary.actual / Math.max(model.revenueSummary.actual, 1)) * 100)}.`,
    );
  }

  if (
    normalizedQuestion.includes("trend") ||
    normalizedQuestion.includes("month") ||
    normalizedQuestion.includes("trajectory") ||
    normalizedQuestion.includes("momentum")
  ) {
    sections.push(
      `Revenue trend: ${summarizeLatestTrend(model.monthlyRevenue.actual, formatLacs)} EBIT trend: ${summarizeLatestTrend(model.monthlyEbit, formatLacs)}`,
    );
  }

  if (
    normalizedQuestion.includes("division") ||
    normalizedQuestion.includes("business") ||
    normalizedQuestion.includes("unit") ||
    normalizedQuestion.includes("geograph")
  ) {
    sections.push(
      model.bestDivision && model.worstDivision
        ? `${model.bestDivision.label} is currently the strongest business unit at ${formatPercent(model.bestDivision.value)} achievement, while ${model.worstDivision.label} is the weakest at ${formatPercent(model.worstDivision.value)}.`
        : "The current filter selection does not expose a clear best-versus-worst business-unit split.",
    );
  }

  if (
    normalizedQuestion.includes("why") ||
    normalizedQuestion.includes("driver") ||
    normalizedQuestion.includes("cause") ||
    normalizedQuestion.includes("driving")
  ) {
    sections.push(
      `Primary adverse P&L drivers versus AOP are ${formatDriverRows(drivers.negative)}. Offsetting positives are ${formatDriverRows(drivers.positive)}.`,
    );
  }

  if (
    normalizedQuestion.includes("risk") ||
    normalizedQuestion.includes("attention") ||
    normalizedQuestion.includes("issue") ||
    normalizedQuestion.includes("anomal")
  ) {
    sections.push(
      risks.length > 0
        ? `Top flagged items: ${risks.map((item) => `${item.title} (${item.severity})`).join("; ")}.`
        : "No major anomalies are flagged in the current filtered view.",
    );
  }

  if (
    normalizedQuestion.includes("forecast") ||
    normalizedQuestion.includes("outlook") ||
    normalizedQuestion.includes("next quarter") ||
    normalizedQuestion.includes("year end")
  ) {
    sections.push(
      `Built-in outlook for the next quarter is ${formatLacs(forecast.nextQuarterRevenue.low)} to ${formatLacs(forecast.nextQuarterRevenue.high)}, with a base case of ${formatLacs(forecast.nextQuarterRevenue.base)}. AOP achievement probability is ${forecast.aopAchievementProbability}%. Margin outlook: ${forecast.marginOutlook}`,
    );
  }

  if (
    normalizedQuestion.includes("action") ||
    normalizedQuestion.includes("recommend") ||
    normalizedQuestion.includes("priority") ||
    normalizedQuestion.includes("what should")
  ) {
    sections.push(
      risks.length > 0
        ? `Priority actions are ${risks.map((item) => `${item.title}: ${item.recommendedAction}`).join(" ")}`
        : "No major corrective action is flagged in the current filtered view.",
    );
  }

  if (sections.length === 1) {
    sections.push(
      `At the current selection, revenue is ${formatLacs(model.revenueSummary.actual)} and EBIT is ${formatLacs(model.ebitSummary.actual)}. The strongest business unit is ${model.bestDivision?.label ?? "not clearly identifiable"} and the most important action is ${topRecommendation(model.recommendations)?.recommendedAction ?? "to review the filtered view for the top variance drivers"}.`,
    );
  }

  sections.push("This answer is using the dashboard's built-in analysis because no external AI provider is currently available.");

  return sections.join("\n\n");
}
