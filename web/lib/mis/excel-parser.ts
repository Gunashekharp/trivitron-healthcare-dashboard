import * as XLSX from "xlsx";
import type { CommentaryItem, DatasetMeta, MisDataset, MisFact, PlSummaryRow } from "./types";

const PRIMARY_FACT_SHEET = "Updated skeleton";
const COMMENTS_SHEET = "Comments";

const REQUIRED_COLUMNS = [
  "Month",
  "Scenario",
  "Div",
  "SubDivision",
  "Category",
  "LineItem",
  "Type",
  "Amount_Lacs",
] as const;

const OPEX_CATEGORIES = ["Opex Exp1", "Opex Exp2", "Opex Exp3"];

function cleanText(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text && text.toLowerCase() !== "nan" ? text : fallback;
}

function parseMonthLabel(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const d = new Date(date.y, date.m - 1, date.d);
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
  }
  const date = new Date(String(value));
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return cleanText(value);
}

function parseMonthKey(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, "0")}`;
    }
  }
  const date = new Date(String(value));
  if (!isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return cleanText(value);
}

function fiscalYearForMonth(value: unknown): string {
  let year: number;
  let month: number;

  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      year = date.y;
      month = date.m;
    } else {
      return "Unknown";
    }
  } else {
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return "Unknown";
    year = date.getFullYear();
    month = date.getMonth() + 1;
  }

  const startYear = month >= 4 ? year : year - 1;
  return `FY${startYear}-${String(startYear + 1).slice(-2)}`;
}

function resolveColumns(
  headers: string[],
): Map<string, string> | null {
  const mapping = new Map<string, string>();
  const lowerHeaders = headers.map((h) => h.toLowerCase().replace(/[_\s]+/g, ""));

  for (const required of REQUIRED_COLUMNS) {
    const normalizedRequired = required.toLowerCase().replace(/[_\s]+/g, "");
    const idx = lowerHeaders.findIndex((h) => h === normalizedRequired);
    if (idx !== -1) {
      mapping.set(required, headers[idx]);
    }
  }

  if (mapping.size < REQUIRED_COLUMNS.length) {
    const aliases: Record<string, string[]> = {
      Month: ["month", "date", "period"],
      Scenario: ["scenario", "type_scenario", "plan"],
      Div: ["div", "division", "geography", "region"],
      SubDivision: ["subdivision", "sub_division", "subdiv", "sub division"],
      Category: ["category", "cat", "account_category"],
      LineItem: ["lineitem", "line_item", "line item", "account"],
      Type: ["type", "business_unit", "bu", "business unit"],
      Amount_Lacs: ["amount_lacs", "amountlacs", "amount", "value", "amt", "amount (lacs)", "amount_lakhs"],
    };

    for (const required of REQUIRED_COLUMNS) {
      if (mapping.has(required)) continue;
      const aliasList = aliases[required] ?? [];
      for (const alias of aliasList) {
        const normalizedAlias = alias.toLowerCase().replace(/[_\s]+/g, "");
        const idx = lowerHeaders.findIndex((h) => h === normalizedAlias);
        if (idx !== -1) {
          mapping.set(required, headers[idx]);
          break;
        }
      }
    }
  }

  return mapping.size >= REQUIRED_COLUMNS.length ? mapping : null;
}

function findFactSheet(
  workbook: XLSX.WorkBook,
): { sheetName: string; mapping: Map<string, string> } | null {
  if (workbook.SheetNames.includes(PRIMARY_FACT_SHEET)) {
    const sheet = workbook.Sheets[PRIMARY_FACT_SHEET];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const mapping = resolveColumns(headers);
      if (mapping) return { sheetName: PRIMARY_FACT_SHEET, mapping };
    }
  }

  for (const sheetName of workbook.SheetNames) {
    if (sheetName === PRIMARY_FACT_SHEET) continue;
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const mapping = resolveColumns(headers);
      if (mapping) return { sheetName, mapping };
    }
  }

  return null;
}

function buildFacts(
  rows: Record<string, unknown>[],
  mapping: Map<string, string>,
): MisFact[] {
  return rows.map((row) => {
    const rawAmount = row[mapping.get("Amount_Lacs")!];
    const amount = typeof rawAmount === "number" ? rawAmount : parseFloat(String(rawAmount));

    return {
      month: parseMonthLabel(row[mapping.get("Month")!]),
      monthKey: parseMonthKey(row[mapping.get("Month")!]),
      scenario: cleanText(row[mapping.get("Scenario")!]) as MisFact["scenario"],
      div: cleanText(row[mapping.get("Div")!]),
      subDivision: cleanText(row[mapping.get("SubDivision")!]),
      category: cleanText(row[mapping.get("Category")!]),
      lineItem: cleanText(row[mapping.get("LineItem")!]),
      type: cleanText(row[mapping.get("Type")!]),
      unit: "lacs" as const,
      periodType: "MTD" as const,
      fiscalYear: fiscalYearForMonth(row[mapping.get("Month")!]),
      amountLacs: isNaN(amount) ? 0 : Math.round(amount * 10000) / 10000,
      source: "xlsx-upload",
    };
  });
}

function buildCommentary(
  rows: Record<string, unknown>[],
): CommentaryItem[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  if (headers.length < 5) return [];

  const [typeCol, divCol, subDivCol, catCol, commentCol] = headers;

  return rows
    .filter((row) => cleanText(row[commentCol]))
    .map((row, i) => ({
      id: `comment-${i + 1}`,
      type: cleanText(row[typeCol]),
      div: cleanText(row[divCol]),
      subDivision: cleanText(row[subDivCol]),
      category: cleanText(row[catCol]),
      comment: cleanText(row[commentCol]),
      source: "xlsx-upload",
    }));
}

function variancePct(actual: number, base: number): number {
  return base ? ((actual - base) / base) * 100 : 0;
}

function buildPlSummary(facts: MisFact[]): PlSummaryRow[] {
  function sumByScenarioCategory(scenario: string, categories: string[]): number {
    return facts
      .filter((f) => f.scenario === scenario && categories.includes(f.category))
      .reduce((s, f) => s + f.amountLacs, 0);
  }

  function detailRows(section: string, categories: string[]): PlSummaryRow[] {
    const subset = facts.filter((f) => categories.includes(f.category));
    const lineItems = [...new Set(subset.map((f) => f.lineItem).filter(Boolean))].sort();

    const results: PlSummaryRow[] = [];
    for (const li of lineItems) {
      const actual = subset
        .filter((f) => f.scenario === "Actual" && f.lineItem === li)
        .reduce((s, f) => s + f.amountLacs, 0);
      const aop = subset
        .filter((f) => f.scenario === "AOP" && f.lineItem === li)
        .reduce((s, f) => s + f.amountLacs, 0);
      if (actual === 0 && aop === 0) continue;
      const vPct = variancePct(actual, aop);
      results.push({
        section,
        lineItem: li,
        actual: Math.round(actual * 100) / 100,
        aop: Math.round(aop * 100) / 100,
        varianceDisplay: `${vPct > 0 ? "+" : ""}${vPct.toFixed(1)}%`,
        variancePct: Math.round(vPct * 100) / 100,
        rowType: "detail",
      });
    }
    return results;
  }

  function totalRow(section: string, label: string, actual: number, aop: number): PlSummaryRow {
    const vPct = variancePct(actual, aop);
    return {
      section,
      lineItem: label,
      actual: Math.round(actual * 100) / 100,
      aop: Math.round(aop * 100) / 100,
      varianceDisplay: `${vPct > 0 ? "+" : ""}${vPct.toFixed(1)}%`,
      variancePct: Math.round(vPct * 100) / 100,
      rowType: "total",
    };
  }

  const revActual = sumByScenarioCategory("Actual", ["Sales"]);
  const revAop = sumByScenarioCategory("AOP", ["Sales"]);
  const cogs1Actual = sumByScenarioCategory("Actual", ["COGS1"]);
  const cogs1Aop = sumByScenarioCategory("AOP", ["COGS1"]);
  const cogs2Actual = sumByScenarioCategory("Actual", ["COGS2"]);
  const cogs2Aop = sumByScenarioCategory("AOP", ["COGS2"]);
  const opexActual = sumByScenarioCategory("Actual", OPEX_CATEGORIES);
  const opexAop = sumByScenarioCategory("AOP", OPEX_CATEGORIES);

  return [
    ...detailRows("Revenue", ["Sales"]),
    totalRow("Revenue", "Total Revenue", revActual, revAop),
    ...detailRows("COGS1", ["COGS1"]),
    totalRow("COGS1", "GM1", revActual - cogs1Actual, revAop - cogs1Aop),
    ...detailRows("COGS2", ["COGS2"]),
    totalRow("COGS2", "GM2", revActual - cogs1Actual - cogs2Actual, revAop - cogs1Aop - cogs2Aop),
    ...detailRows("Operating Expenses", OPEX_CATEGORIES),
    totalRow(
      "Operating Expenses",
      "EBIT",
      revActual - cogs1Actual - cogs2Actual - opexActual,
      revAop - cogs1Aop - cogs2Aop - opexAop,
    ),
  ];
}

export interface ParseResult {
  success: true;
  dataset: MisDataset;
  sheetName: string;
}

export interface ParseError {
  success: false;
  error: string;
  availableSheets: string[];
}

export function parseExcelToDataset(
  buffer: ArrayBuffer,
  fileName: string,
): ParseResult | ParseError {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });

  const factSheetResult = findFactSheet(workbook);
  if (!factSheetResult) {
    return {
      success: false,
      error: `Could not find a sheet with the required columns: ${REQUIRED_COLUMNS.join(", ")}. Please ensure your Excel has columns like Month, Scenario, Div, SubDivision, Category, LineItem, Type, and Amount_Lacs.`,
      availableSheets: workbook.SheetNames,
    };
  }

  const { sheetName, mapping } = factSheetResult;
  const factSheet = workbook.Sheets[sheetName];
  const factRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(factSheet, { defval: "" });
  const facts = buildFacts(factRows, mapping);

  let commentary: CommentaryItem[] = [];
  if (workbook.SheetNames.includes(COMMENTS_SHEET)) {
    const commentSheet = workbook.Sheets[COMMENTS_SHEET];
    const commentRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(commentSheet, { defval: "" });
    commentary = buildCommentary(commentRows);
  }

  const plSummary = buildPlSummary(facts);

  const scenarios = [...new Set(facts.map((f) => f.scenario).filter(Boolean))].sort();
  const types = [...new Set(facts.map((f) => f.type).filter(Boolean))].sort();
  const divisions = [...new Set(facts.map((f) => f.div).filter(Boolean))].sort();
  const subDivisions = [...new Set(facts.map((f) => f.subDivision).filter(Boolean))].sort();
  const categories = [...new Set(facts.map((f) => f.category).filter(Boolean))].sort();
  const lineItems = [...new Set(facts.map((f) => f.lineItem).filter(Boolean))].sort();

  const sheetSummaries = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", range: 0 });
    return { name, columns: rows.length > 0 ? Object.keys(rows[0]) : [] };
  });

  const zeroValueRows = facts.filter((f) => f.amountLacs === 0).length;
  const blankDimensionRows = facts.filter(
    (f) => !f.type || !f.div || !f.subDivision || !f.category || !f.lineItem,
  ).length;

  const meta: DatasetMeta = {
    title: "Trivitron Healthcare Executive MIS",
    generatedAt: new Date().toISOString(),
    sourceFiles: { html: null, pbix: null, xlsx: fileName },
    sourceMode: "xlsx-upload",
    limitations: [
      "Dashboard driven by the uploaded Excel workbook.",
      `Data sheet: ${sheetName}`,
    ],
    schemaUnderstanding: {
      requestedCoreFields: [...REQUIRED_COLUMNS],
      pbixModel: {
        tableName: null,
        columns: [],
        measures: [],
        pages: [],
        dataSourceMode: null,
      },
      xlsxSchema: {
        available: true,
        sheets: sheetSummaries,
        columns: [...mapping.values()].sort(),
        primarySheet: sheetName,
        profile: { scenarios, types, divisions, subDivisions, categories, lineItems },
      },
    },
    dataQuality: {
      totalFactRows: facts.length,
      zeroValueRows,
      blankDimensionRows,
    },
  };

  return {
    success: true,
    dataset: { meta, facts, commentary, plSummary },
    sheetName,
  };
}
