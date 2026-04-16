import type {
  DetailRow,
  MetricCardValue,
  MisDataset,
  MisFact,
  MisFilters,
  PlSummaryRow,
  Recommendation,
  Scenario,
  SeriesPoint,
} from "@/lib/mis/types";
import { formatLacs, formatPercent, formatVariance, safeDivide } from "@/lib/mis/utils";

const DEFAULT_SCENARIOS: Scenario[] = ["Actual", "AOP", "PY"];
const OPEX_CATEGORIES = ["Opex Exp1", "Opex Exp2", "Opex Exp3"];
const PNL_CATEGORY_ORDER = ["Sales", "COGS1", "COGS2", ...OPEX_CATEGORIES];

type MetricKey = "revenue" | "gm1" | "gm2" | "ebit";

function matchesFilter(value: string, selected: string[]) {
  return selected.length === 0 || selected.includes(value);
}

function factMatchesFilters(fact: MisFact, filters: MisFilters) {
  return (
    matchesFilter(fact.monthKey, filters.monthKeys) &&
    matchesFilter(fact.scenario, filters.scenarios) &&
    matchesFilter(fact.type, filters.types) &&
    matchesFilter(fact.div, filters.divisions) &&
    matchesFilter(fact.subDivision, filters.subDivisions) &&
    matchesFilter(fact.category, filters.categories) &&
    matchesFilter(fact.lineItem, filters.lineItems)
  );
}

function filterFacts(dataset: MisDataset, filters: MisFilters) {
  return dataset.facts.filter((fact) => factMatchesFilters(fact, filters));
}

function uniqueMonths(facts: MisFact[]) {
  return Array.from(
    new Map(
      facts
        .filter((fact) => fact.periodType === "MTD")
        .map((fact) => [fact.monthKey, { key: fact.monthKey, label: fact.month }]),
    ).values(),
  ).sort((left, right) => left.key.localeCompare(right.key));
}

function sumFacts(
  facts: MisFact[],
  {
    scenario,
    categories,
    lineItems,
  }: {
    scenario: Scenario;
    categories?: string[];
    lineItems?: string[];
  },
) {
  return facts
    .filter((fact) => fact.scenario === scenario)
    .filter((fact) => !categories || categories.includes(fact.category))
    .filter((fact) => !lineItems || lineItems.includes(fact.lineItem))
    .reduce((sum, fact) => sum + fact.amountLacs, 0);
}

function metricValue(facts: MisFact[], scenario: Scenario, metric: MetricKey) {
  const revenue = sumFacts(facts, { scenario, categories: ["Sales"] });
  const cogs1 = sumFacts(facts, { scenario, categories: ["COGS1"] });
  const cogs2 = sumFacts(facts, { scenario, categories: ["COGS2"] });
  const opex = sumFacts(facts, { scenario, categories: OPEX_CATEGORIES });

  switch (metric) {
    case "revenue":
      return revenue;
    case "gm1":
      return revenue - cogs1;
    case "gm2":
      return revenue - cogs1 - cogs2;
    case "ebit":
      return revenue - cogs1 - cogs2 - opex;
    default:
      return 0;
  }
}

function scenarioComparison(facts: MisFact[], metric: MetricKey) {
  const actual = metricValue(facts, "Actual", metric);
  const aop = metricValue(facts, "AOP", metric);
  const py = metricValue(facts, "PY", metric);
  return {
    actual,
    aop,
    py,
    vsAopPct: aop ? ((actual - aop) / aop) * 100 : 0,
    vsPyPct: py ? ((actual - py) / py) * 100 : 0,
  };
}

function marginPct(facts: MisFact[], metric: Exclude<MetricKey, "revenue">, scenario: Scenario = "Actual") {
  const revenue = metricValue(facts, scenario, "revenue");
  const metricAmount = metricValue(facts, scenario, metric);
  return safeDivide(metricAmount, revenue) * 100;
}

function metricSeries(facts: MisFact[], metric: MetricKey, scenario: Scenario): SeriesPoint[] {
  return uniqueMonths(facts).map((month) => {
    const monthFacts = facts.filter((fact) => fact.monthKey === month.key);
    return {
      label: month.label,
      key: month.key,
      value: metricValue(monthFacts, scenario, metric),
    };
  });
}

function marginSeries(
  facts: MisFact[],
  metric: Exclude<MetricKey, "revenue">,
  scenario: Scenario,
): SeriesPoint[] {
  return uniqueMonths(facts).map((month) => {
    const monthFacts = facts.filter((fact) => fact.monthKey === month.key);
    return {
      label: month.label,
      key: month.key,
      value: marginPct(monthFacts, metric, scenario),
    };
  });
}

function groupedMetric(facts: MisFact[], metric: MetricKey, scenario: Scenario, groupField: "type" | "div") {
  return Array.from(new Set(facts.map((fact) => fact[groupField]).filter(Boolean)))
    .map((groupValue) => {
      const groupFacts = facts.filter((fact) => fact[groupField] === groupValue);
      return {
        label: groupValue,
        key: groupValue,
        value: metricValue(groupFacts, scenario, metric),
      };
    })
    .filter((entry) => entry.value !== 0)
    .sort((left, right) => right.value - left.value);
}

function achievementByType(facts: MisFact[]) {
  return Array.from(new Set(facts.map((fact) => fact.type).filter(Boolean)))
    .map((type) => {
      const typeFacts = facts.filter((fact) => fact.type === type);
      const actual = metricValue(typeFacts, "Actual", "revenue");
      const aop = metricValue(typeFacts, "AOP", "revenue");
      return {
        label: type,
        key: type,
        value: safeDivide(actual, aop) * 100,
        actual,
        aop,
      };
    })
    .filter((entry) => entry.aop !== 0 || entry.actual !== 0)
    .sort((left, right) => right.value - left.value);
}

function getOptions(dataset: MisDataset) {
  const monthKeys = dataset.facts
    .filter((fact) => fact.periodType === "MTD")
    .map((fact) => ({ label: fact.month, key: fact.monthKey }));

  return {
    months: Array.from(new Map(monthKeys.map((item) => [item.key, item])).values()).sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
    scenarios: DEFAULT_SCENARIOS,
    types: Array.from(new Set(dataset.facts.map((fact) => fact.type).filter(Boolean))).sort(),
    divisions: Array.from(new Set(dataset.facts.map((fact) => fact.div).filter(Boolean))).sort(),
    subDivisions: Array.from(new Set(dataset.facts.map((fact) => fact.subDivision).filter(Boolean))).sort(),
    categories: Array.from(new Set(dataset.facts.map((fact) => fact.category).filter(Boolean))).sort(),
    lineItems: Array.from(new Set(dataset.facts.map((fact) => fact.lineItem).filter(Boolean))).sort(),
  };
}

function variancePct(actual: number, base: number) {
  return base ? ((actual - base) / base) * 100 : 0;
}

function buildPlSummary(facts: MisFact[]): PlSummaryRow[] {
  const lineItemGroups = PNL_CATEGORY_ORDER.flatMap((category) => {
    const lineItems = Array.from(
      new Set(
        facts
          .filter((fact) => fact.category === category)
          .map((fact) => fact.lineItem)
          .filter(Boolean),
      ),
    ).sort();

    return lineItems.map((lineItem) => {
      const actual = sumFacts(facts, { scenario: "Actual", categories: [category], lineItems: [lineItem] });
      const aop = sumFacts(facts, { scenario: "AOP", categories: [category], lineItems: [lineItem] });
      return {
        section: category,
        lineItem,
        actual,
        aop,
        varianceDisplay: formatVariance(variancePct(actual, aop)),
        variancePct: variancePct(actual, aop),
        rowType: "detail" as const,
      };
    });
  }).filter((row) => row.actual !== 0 || row.aop !== 0);

  const revenue = scenarioComparison(facts, "revenue");
  const gm1 = scenarioComparison(facts, "gm1");
  const gm2 = scenarioComparison(facts, "gm2");
  const ebit = scenarioComparison(facts, "ebit");

  return [
    ...lineItemGroups.filter((row) => row.section === "Sales"),
    {
      section: "Revenue",
      lineItem: "Total Revenue",
      actual: revenue.actual,
      aop: revenue.aop,
      varianceDisplay: formatVariance(revenue.vsAopPct),
      variancePct: revenue.vsAopPct,
      rowType: "total",
    },
    ...lineItemGroups.filter((row) => row.section === "COGS1"),
    {
      section: "COGS1",
      lineItem: "GM1",
      actual: gm1.actual,
      aop: gm1.aop,
      varianceDisplay: formatVariance(gm1.vsAopPct),
      variancePct: gm1.vsAopPct,
      rowType: "total",
    },
    ...lineItemGroups.filter((row) => row.section === "COGS2"),
    {
      section: "COGS2",
      lineItem: "GM2",
      actual: gm2.actual,
      aop: gm2.aop,
      varianceDisplay: formatVariance(gm2.vsAopPct),
      variancePct: gm2.vsAopPct,
      rowType: "total",
    },
    ...lineItemGroups.filter((row) => OPEX_CATEGORIES.includes(row.section)),
    {
      section: "Operating Expenses",
      lineItem: "EBIT",
      actual: ebit.actual,
      aop: ebit.aop,
      varianceDisplay: formatVariance(ebit.vsAopPct),
      variancePct: ebit.vsAopPct,
      rowType: "total",
    },
  ];
}

function getVarianceTable(plSummary: PlSummaryRow[]): DetailRow[] {
  return plSummary.map((row) => ({
    label: row.lineItem,
    actual: row.actual,
    aop: row.aop,
    variancePct: row.variancePct,
    note: row.section,
  }));
}

function buildRecommendations(dataset: MisDataset, facts: MisFact[]): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const revenue = scenarioComparison(facts, "revenue");
  const ebit = scenarioComparison(facts, "ebit");
  const gm1Margin = marginPct(facts, "gm1");
  const gm2Margin = marginPct(facts, "gm2");
  const ebitMargin = marginPct(facts, "ebit");

  if (revenue.vsAopPct < -10) {
    recommendations.push({
      id: "revenue-vs-aop",
      title: "Revenue below AOP threshold",
      severity: "Critical",
      affectedDimension: "Consolidated revenue",
      explanation: "Actual YTD revenue is materially below the AOP baseline from the workbook.",
      supportingMetrics: [
        `Actual: ${formatLacs(revenue.actual)}`,
        `AOP: ${formatLacs(revenue.aop)}`,
        `Variance: ${formatVariance(revenue.vsAopPct)}`,
      ],
      recommendedAction:
        "Review the weakest business units and create a month-wise catch-up plan anchored to open orders and shipment conversion.",
    });
  }

  if (ebitMargin < 8) {
    recommendations.push({
      id: "ebit-margin",
      title: "EBIT margin below target",
      severity: "Critical",
      affectedDimension: "Profitability",
      explanation: "EBIT margin remains below the target corridor implied by the planning baseline.",
      supportingMetrics: [
        `EBIT: ${formatLacs(ebit.actual)}`,
        `EBIT margin: ${formatPercent(ebitMargin)}`,
        `GM2 margin: ${formatPercent(gm2Margin)}`,
      ],
      recommendedAction:
        "Prioritize cost containment on opex-heavy units and validate whether margin dilution is caused by mix, recovery lag, or overhead absorption.",
    });
  }

  const worstTypeVsPy = Array.from(new Set(facts.map((fact) => fact.type).filter(Boolean)))
    .map((type) => {
      const typeFacts = facts.filter((fact) => fact.type === type);
      const actual = metricValue(typeFacts, "Actual", "revenue");
      const py = metricValue(typeFacts, "PY", "revenue");
      return { type, actual, py, variance: variancePct(actual, py) };
    })
    .filter((item) => item.py !== 0)
    .sort((left, right) => left.variance - right.variance)[0];

  if (worstTypeVsPy && worstTypeVsPy.variance < -5) {
    recommendations.push({
      id: "division-underperforming-py",
      title: "Business unit underperforming vs PY",
      severity: "Watchlist",
      affectedDimension: worstTypeVsPy.type,
      explanation: "One business unit is trailing its prior-year revenue baseline.",
      supportingMetrics: [
        `Actual: ${formatLacs(worstTypeVsPy.actual)}`,
        `PY: ${formatLacs(worstTypeVsPy.py)}`,
        `Variance: ${formatVariance(worstTypeVsPy.variance)}`,
      ],
      recommendedAction:
        "Review product-level mix and channel performance for this unit to determine whether the gap is volume-driven or margin-protective.",
    });
  }

  const revenueGrowthVsPy = revenue.vsPyPct;
  const costEscalation = Array.from(
    new Set(
      facts
        .filter((fact) => OPEX_CATEGORIES.includes(fact.category))
        .map((fact) => fact.lineItem)
        .filter(Boolean),
    ),
  )
    .map((lineItem) => {
      const actual = sumFacts(facts, { scenario: "Actual", lineItems: [lineItem] });
      const py = sumFacts(facts, { scenario: "PY", lineItems: [lineItem] });
      return { lineItem, actual, py, variance: variancePct(actual, py) };
    })
    .filter((item) => item.py > 0)
    .sort((left, right) => right.variance - left.variance)[0];

  if (costEscalation && costEscalation.variance > revenueGrowthVsPy + 10) {
    recommendations.push({
      id: "cost-line-rising",
      title: "Cost line rising disproportionately",
      severity: "Watchlist",
      affectedDimension: costEscalation.lineItem,
      explanation: "A key opex line is growing faster than revenue growth versus prior year.",
      supportingMetrics: [
        `Cost growth: ${formatVariance(costEscalation.variance)}`,
        `Revenue growth vs PY: ${formatVariance(revenueGrowthVsPy)}`,
      ],
      recommendedAction:
        "Validate whether this cost is strategic investment, timing related, or requires immediate corrective action.",
    });
  }

  const zeroRows = dataset.facts.filter(
    (fact) => fact.scenario === "Actual" && fact.periodType === "MTD" && fact.amountLacs === 0,
  );
  if (zeroRows.length > 0) {
    recommendations.push({
      id: "zero-values",
      title: "Anomalous zero-value rows detected",
      severity: "Watchlist",
      affectedDimension: "Workbook data quality",
      explanation: "The Excel extract includes actual rows with zero values that may need validation.",
      supportingMetrics: [`Rows flagged: ${zeroRows.length}`],
      recommendedAction:
        "Review whether the zero rows are valid placeholders or missing loads before the executive pack is published.",
    });
  }

  const missingRows = dataset.facts.filter(
    (fact) => !fact.type || !fact.div || !fact.subDivision || !fact.category || !fact.month,
  );
  if (missingRows.length > 0) {
    recommendations.push({
      id: "missing-values",
      title: "Missing or invalid dimension values",
      severity: "Critical",
      affectedDimension: "Data completeness",
      explanation: "Some fact rows have blank dimension values and can distort grouped analysis.",
      supportingMetrics: [`Rows impacted: ${missingRows.length}`],
      recommendedAction:
        "Enforce mandatory mappings for type, division, sub-division, category, and month in the extract process.",
    });
  } else {
    recommendations.push({
      id: "workbook-connected",
      title: "Workbook-driven MIS is active",
      severity: "Opportunity",
      affectedDimension: "Data pipeline",
      explanation: "The dashboard is now driven by the Excel extract rather than static HTML values.",
      supportingMetrics: [
        `Fact rows: ${dataset.facts.length}`,
        `Commentary rows: ${dataset.commentary.length}`,
      ],
      recommendedAction:
        "Automate the monthly workbook drop and regeneration step so the executive dashboard refreshes on each close.",
    });
  }

  if (revenue.vsPyPct > 0 && ebitMargin < gm1Margin / 6) {
    recommendations.push({
      id: "margin-erosion",
      title: "Margin erosion despite revenue growth",
      severity: "Opportunity",
      affectedDimension: "Revenue to EBIT bridge",
      explanation: "Revenue is up versus prior year, but EBIT conversion remains muted.",
      supportingMetrics: [
        `Revenue vs PY: ${formatVariance(revenue.vsPyPct)}`,
        `GM1 margin: ${formatPercent(gm1Margin)}`,
        `EBIT margin: ${formatPercent(ebitMargin)}`,
      ],
      recommendedAction:
        "Track the conversion loss from GM1 to EBIT and isolate which opex lines are diluting profitability.",
    });
  }

  return recommendations;
}

export function buildDashboardModel(dataset: MisDataset, filters: MisFilters) {
  const filteredFacts = filterFacts(dataset, filters);
  const revenue = scenarioComparison(filteredFacts, "revenue");
  const gm1 = scenarioComparison(filteredFacts, "gm1");
  const gm2 = scenarioComparison(filteredFacts, "gm2");
  const ebit = scenarioComparison(filteredFacts, "ebit");
  const plSummary = buildPlSummary(filteredFacts);

  const metricCards: MetricCardValue[] = [
    {
      label: "YTD Revenue",
      value: formatLacs(revenue.actual),
      detail: `${formatVariance(revenue.vsAopPct)} vs AOP`,
      tone: revenue.vsAopPct < -5 ? "danger" : "brand",
    },
    {
      label: "GM1 Margin",
      value: formatPercent(marginPct(filteredFacts, "gm1")),
      detail: `${formatLacs(gm1.actual)} GM1`,
      tone: "success",
    },
    {
      label: "GM2 Margin",
      value: formatPercent(marginPct(filteredFacts, "gm2")),
      detail: `${formatLacs(gm2.actual)} GM2`,
      tone: "warning",
    },
    {
      label: "EBIT Margin",
      value: formatPercent(marginPct(filteredFacts, "ebit")),
      detail: `${formatLacs(ebit.actual)} EBIT`,
      tone: ebit.actual < 0 ? "danger" : "brand",
    },
  ];

  const achievement = achievementByType(filteredFacts);
  const bestDivision = achievement[0];
  const worstDivision = achievement.at(-1);
  const geographySplit = groupedMetric(filteredFacts, "revenue", "Actual", "div");
  const geographyTotal = geographySplit.reduce((sum, item) => sum + item.value, 0);

  return {
    options: getOptions(dataset),
    selectedScenarios: filters.scenarios,
    metricCards,
    revenueSummary: revenue,
    gm1Summary: gm1,
    gm2Summary: gm2,
    ebitSummary: ebit,
    achievementPct: safeDivide(revenue.actual, revenue.aop) * 100,
    monthlyRevenue: {
      actual: metricSeries(filteredFacts, "revenue", "Actual"),
      aop: metricSeries(filteredFacts, "revenue", "AOP"),
      py: metricSeries(filteredFacts, "revenue", "PY"),
    },
    monthlyEbit: metricSeries(filteredFacts, "ebit", "Actual"),
    monthlyMargins: {
      gm1: marginSeries(filteredFacts, "gm1", "Actual"),
      ebit: marginSeries(filteredFacts, "ebit", "Actual"),
      ebitAop: marginSeries(filteredFacts, "ebit", "AOP"),
    },
    divisionContribution: groupedMetric(filteredFacts, "revenue", "Actual", "type"),
    geographySplit: geographySplit.map((item) => ({
      ...item,
      sharePct: safeDivide(item.value, geographyTotal) * 100,
    })),
    achievementByDivision: achievement,
    plSummary,
    varianceTable: getVarianceTable(plSummary),
    commentary: dataset.commentary.filter(
      (item) =>
        matchesFilter(item.type, filters.types) &&
        matchesFilter(item.div, filters.divisions) &&
        matchesFilter(item.subDivision, filters.subDivisions) &&
        matchesFilter(item.category, filters.categories),
    ),
    recommendations: buildRecommendations(dataset, filteredFacts),
    strategicSummary: [
      `Revenue achievement is at ${formatPercent(safeDivide(revenue.actual, revenue.aop) * 100)} against current plan.`,
      `Revenue is ${formatVariance(revenue.vsPyPct)} versus prior year while EBIT margin sits at ${formatPercent(marginPct(filteredFacts, "ebit"))}.`,
      bestDivision
        ? `${bestDivision.label} is the strongest business unit on achievement at ${formatPercent(bestDivision.value)}.`
        : "Business unit achievement data is not available.",
      worstDivision
        ? `${worstDivision.label} is the weakest tracked business unit on achievement at ${formatPercent(worstDivision.value)}.`
        : "A weakest business unit could not be determined from the current dataset.",
    ],
    bestDivision,
    worstDivision,
    waterfall: [
      { label: "Revenue", key: "revenue", value: revenue.actual },
      {
        label: "- COGS1",
        key: "cogs1",
        value: -sumFacts(filteredFacts, { scenario: "Actual", categories: ["COGS1"] }),
      },
      { label: "GM1", key: "gm1", value: gm1.actual },
      {
        label: "- COGS2",
        key: "cogs2",
        value: -sumFacts(filteredFacts, { scenario: "Actual", categories: ["COGS2"] }),
      },
      { label: "GM2", key: "gm2", value: gm2.actual },
      {
        label: "- Opex",
        key: "opex",
        value: -sumFacts(filteredFacts, { scenario: "Actual", categories: OPEX_CATEGORIES }),
      },
      { label: "EBIT", key: "ebit", value: ebit.actual },
    ],
  };
}

export function buildDefaultFilters(dataset: MisDataset): MisFilters {
  const months = dataset.facts
    .filter((fact) => fact.periodType === "MTD")
    .map((fact) => fact.monthKey);

  return {
    monthKeys: Array.from(new Set(months)).sort(),
    scenarios: ["Actual", "AOP", "PY"],
    types: [],
    divisions: [],
    subDivisions: [],
    categories: [],
    lineItems: [],
  };
}
