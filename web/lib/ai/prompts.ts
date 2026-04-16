import type { buildDashboardModel } from "@/lib/mis/engine";
import type { ExecutiveView, MisFilters, PlSummaryRow, Recommendation, SeriesPoint } from "@/lib/mis/types";
import { formatLacs, formatPercent, formatVariance } from "@/lib/mis/utils";

type DashboardModel = ReturnType<typeof buildDashboardModel>;

export const MIS_SYSTEM_PROMPT = `You are an elite CFO-level financial analyst for Trivitron Healthcare, a diversified healthcare conglomerate.

## Primary Goal
Answer the user's question using only the supplied dashboard context. Be analytically sharp, numerically precise, and commercially useful.

## Core Rules
- Never invent numbers, dimensions, drivers, or causes that are not supported by the provided context
- If the data is insufficient, say exactly what is missing
- Prefer direct answers over generic summaries
- Cite concrete figures, percentages, and named business units wherever possible
- When asked "why" or "what is driving", identify the strongest visible evidence first, then state the likely implication
- When asked for actions, prioritize the most material item first

## Data Context
- Revenue by business unit, sub-division, geography, and line item
- Profitability through GM1, GM2, and EBIT
- Actual vs AOP vs PY comparisons
- Monthly time series across the fiscal year
- Amounts are in Indian Lakhs (Rs L)

## Style
- Board-ready, concise, and specific
- Use short paragraphs or bullets only when they improve clarity
- Mention active filters whenever they materially narrow the answer
- When asked about dashboard filters or views, map natural language to:
  monthKeys, scenarios, types, divisions, subDivisions, categories, lineItems`;

export const COMMENTARY_SYSTEM_PROMPT = `You are a senior financial analyst writing executive commentary for Trivitron Healthcare's MIS dashboard.

## Instructions
- Produce 5-7 bullets of varying depth
- Start each bullet with a bold insight label (e.g., "Revenue Gap:", "Margin Alert:", "Growth Signal:")
- Follow each label with the finding, supporting numbers, and a clear implication or required action
- Balance coverage across: revenue trajectory, profitability conversion, portfolio risk, execution momentum, and strategic outlook
- Use the executive lens requested in the prompt — CEO focuses on growth and market positioning, CFO on financial control and margin levers, Chairman on strategic governance
- Each bullet must contain at least one hard number
- If you detect a contradiction (e.g., revenue up but EBIT down), surface it explicitly
- Close with one forward-looking bullet on what the next 90 days should focus on
- Do not mention that you are an AI or discuss the prompt

Amounts are in Indian Lakhs (Rs L).`;

export const ANOMALY_SYSTEM_PROMPT = `You are a financial data scientist specializing in executive anomaly detection for MIS data.

## Detection Goals
- Flag material underperformance versus AOP or PY with quantified impact
- Detect abrupt month-on-month breaks in trend (momentum shifts)
- Catch margin compression where revenue and profitability diverge
- Highlight outlier business units or geographies versus peers
- Surface probable data quality concerns only when evidence exists
- Identify cross-metric contradictions (e.g., revenue growth with margin decline)

## Scoring Rules
- Each anomaly MUST include an impactLacs field: estimated financial impact in lakhs
- Each anomaly MUST include a confidence field: 0-100 score reflecting how certain the finding is
- Each anomaly MUST include a trend field: "worsening", "stable", or "improving"
- Severity should reflect business materiality: Critical = >5% of revenue impact, Warning = 1-5%, Info = <1%

## Output Rules
- Return 3-6 high-signal anomalies ordered by descending materiality
- Each finding must include: the observed issue, why it matters, the quantified impact, and the specific next investigation action
- Never pad the list with trivial items — quality over quantity`;

export const FORECAST_SYSTEM_PROMPT = `You are a financial forecasting analyst for Trivitron Healthcare.

## Forecasting Rules
- Base the outlook only on the supplied historical data and signals
- Use recent run-rate, momentum, margin trajectory, and current AOP gap
- Reflect uncertainty honestly; do not overstate confidence
- Keep scenario narratives grounded in the visible business drivers
- Assign a confidence score (0-100) to the overall forecast based on data quality and trend stability

## Required Output
- Next-quarter revenue range with low, base, and high cases
- AOP achievement probability by year-end (with confidence)
- Margin outlook with directional trend
- Key risks, each with estimated probability (Low/Medium/High) and potential impact
- Best, base, and stress scenarios with specific triggers
- Top 3 recommended actions to improve the outlook`;

function listOrAll(label: string, values: string[]) {
  return values.length > 0 ? `${label}: ${values.join(", ")}` : `${label}: All`;
}

function summarizeFilters(filters: MisFilters) {
  return [
    listOrAll("Months", filters.monthKeys),
    listOrAll("Scenarios", filters.scenarios),
    listOrAll("Business Units", filters.types),
    listOrAll("Geographies", filters.divisions),
    listOrAll("Sub-Divisions", filters.subDivisions),
    listOrAll("Categories", filters.categories),
    listOrAll("Line Items", filters.lineItems),
  ].join("\n");
}

function describeSeries(series: SeriesPoint[]) {
  const latest = series.at(-1);
  const previous = series.at(-2);
  if (!latest) {
    return "No recent series data available.";
  }

  if (!previous) {
    return `${latest.label}: ${formatLacs(latest.value)}.`;
  }

  const delta = previous.value === 0 ? 0 : ((latest.value - previous.value) / Math.abs(previous.value)) * 100;
  return `${latest.label}: ${formatLacs(latest.value)} (${formatVariance(delta)} vs prior month ${previous.label}).`;
}

function describeMomentum(series: SeriesPoint[]) {
  if (series.length < 3) return "Insufficient data for momentum analysis.";

  const recent3 = series.slice(-3).map((p) => p.value);
  const isAccelerating = recent3[2] > recent3[1] && recent3[1] > recent3[0];
  const isDecelerating = recent3[2] < recent3[1] && recent3[1] < recent3[0];
  const isVolatile = !isAccelerating && !isDecelerating && Math.abs(recent3[2] - recent3[0]) > recent3[0] * 0.1;

  if (isAccelerating) return "Momentum: Accelerating over last 3 months.";
  if (isDecelerating) return "Momentum: Decelerating over last 3 months.";
  if (isVolatile) return "Momentum: Volatile — no clear direction.";
  return "Momentum: Broadly stable.";
}

function formatTopContributors(
  items: Array<{ label: string; value: number }>,
  formatter: (value: number) => string,
  limit = 3,
) {
  if (items.length === 0) {
    return "None";
  }

  return items
    .slice(0, limit)
    .map((item) => `${item.label} (${formatter(item.value)})`)
    .join("; ");
}

function topVarianceRows(plSummary: PlSummaryRow[]) {
  const detailedRows = plSummary.filter((row) => row.rowType === "detail" && row.aop !== 0);
  const negative = [...detailedRows].sort((left, right) => left.variancePct - right.variancePct).slice(0, 3);
  const positive = [...detailedRows].sort((left, right) => right.variancePct - left.variancePct).slice(0, 3);

  return {
    negative,
    positive,
  };
}

function formatVarianceRows(rows: PlSummaryRow[]) {
  if (rows.length === 0) {
    return "None";
  }

  return rows
    .map(
      (row) =>
        `${row.lineItem}: ${formatLacs(row.actual)} vs ${formatLacs(row.aop)} AOP (${formatVariance(row.variancePct)})`,
    )
    .join("; ");
}

function formatRecommendations(recommendations: Recommendation[], limit = 3) {
  if (recommendations.length === 0) {
    return "None";
  }

  return recommendations
    .slice(0, limit)
    .map(
      (item) =>
        `[${item.severity}] ${item.title} | ${item.affectedDimension} | ${item.explanation} | Action: ${item.recommendedAction}`,
    )
    .join("\n");
}

function buildConversionBridge(model: DashboardModel) {
  const rev = model.revenueSummary.actual;
  if (rev === 0) return "Revenue is zero — conversion analysis is not applicable.";

  const gm1Pct = (model.gm1Summary.actual / rev) * 100;
  const gm2Pct = (model.gm2Summary.actual / rev) * 100;
  const ebitPct = (model.ebitSummary.actual / rev) * 100;
  const cogs1Drop = gm1Pct;
  const cogs2Drop = gm1Pct - gm2Pct;
  const opexDrop = gm2Pct - ebitPct;

  return [
    `Revenue → GM1: ${formatPercent(cogs1Drop)} retained (COGS1 absorbs ${formatPercent(100 - cogs1Drop)})`,
    `GM1 → GM2: ${formatPercent(cogs2Drop)} lost to COGS2`,
    `GM2 → EBIT: ${formatPercent(opexDrop)} lost to Opex`,
    `Final EBIT conversion: ${formatPercent(ebitPct)} of revenue`,
  ].join("\n");
}

function buildSharedContext(model: DashboardModel, filters: MisFilters) {
  const varianceDrivers = topVarianceRows(model.plSummary);

  return [
    "## Active Filters",
    summarizeFilters(filters),
    "",
    "## KPI Snapshot",
    `Revenue: ${formatLacs(model.revenueSummary.actual)} vs ${formatLacs(model.revenueSummary.aop)} AOP (${formatVariance(model.revenueSummary.vsAopPct)}) and ${formatVariance(model.revenueSummary.vsPyPct)} vs PY.`,
    `GM1: ${formatLacs(model.gm1Summary.actual)} | GM2: ${formatLacs(model.gm2Summary.actual)} | EBIT: ${formatLacs(model.ebitSummary.actual)}.`,
    `Achievement: ${formatPercent(model.achievementPct)} of AOP.`,
    "",
    "## Profitability Conversion Bridge",
    buildConversionBridge(model),
    "",
    "## Monthly Signals",
    `Revenue trend: ${describeSeries(model.monthlyRevenue.actual)}`,
    `${describeMomentum(model.monthlyRevenue.actual)}`,
    `EBIT trend: ${describeSeries(model.monthlyEbit)}`,
    `${describeMomentum(model.monthlyEbit)}`,
    `GM1 margin trend: ${describeSeries(model.monthlyMargins.gm1)}`,
    `EBIT margin trend: ${describeSeries(model.monthlyMargins.ebit)}`,
    "",
    "## Portfolio Mix",
    `Top business units: ${formatTopContributors(model.divisionContribution, formatLacs)}.`,
    `Top geographies: ${formatTopContributors(model.geographySplit, (value) => formatLacs(value))}.`,
    `Best achievement: ${model.bestDivision ? `${model.bestDivision.label} (${formatPercent(model.bestDivision.value)})` : "Not available"}.`,
    `Weakest achievement: ${model.worstDivision ? `${model.worstDivision.label} (${formatPercent(model.worstDivision.value)})` : "Not available"}.`,
    "",
    "## P&L Drivers vs AOP",
    `Most favorable lines: ${formatVarianceRows(varianceDrivers.positive)}.`,
    `Most adverse lines: ${formatVarianceRows(varianceDrivers.negative)}.`,
    "",
    "## Recommended Attention Areas",
    formatRecommendations(model.recommendations),
    "",
    "## Grounding JSON",
    JSON.stringify(
      {
        revenueSummary: model.revenueSummary,
        gm1Summary: model.gm1Summary,
        gm2Summary: model.gm2Summary,
        ebitSummary: model.ebitSummary,
        achievementPct: model.achievementPct,
        monthlyRevenue: model.monthlyRevenue,
        monthlyMargins: model.monthlyMargins,
        monthlyEbit: model.monthlyEbit,
        divisionContribution: model.divisionContribution,
        geographySplit: model.geographySplit,
        bestDivision: model.bestDivision,
        worstDivision: model.worstDivision,
        plSummary: model.plSummary.slice(0, 30),
        recommendations: model.recommendations,
        strategicSummary: model.strategicSummary,
      },
      null,
      2,
    ),
  ].join("\n");
}

export function buildChatDataContext(model: DashboardModel, filters: MisFilters, latestQuestion: string) {
  return `${buildSharedContext(model, filters)}

## Current User Question
${latestQuestion}`;
}

export function buildCommentaryDataContext(
  model: DashboardModel,
  filters: MisFilters,
  view: ExecutiveView,
) {
  return `${buildSharedContext(model, filters)}

## Commentary Lens
Executive view: ${view}`;
}

export function buildAnomalyDataContext(model: DashboardModel, filters: MisFilters) {
  return `${buildSharedContext(model, filters)}

## Task Focus
Detect only the most material anomalies for the currently filtered view. Quantify the financial impact of each finding in lakhs. Assign confidence scores based on data quality and signal strength.`;
}

export function buildForecastDataContext(model: DashboardModel, filters: MisFilters) {
  return `${buildSharedContext(model, filters)}

## Task Focus
Project the next quarter and year-end outlook from the currently filtered view only. Ground the forecast in visible momentum and run-rate. Assign confidence scores and identify the top actions to improve the outlook.`;
}
