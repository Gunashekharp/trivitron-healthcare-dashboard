export type Scenario = "Actual" | "AOP" | "PY";
export type Unit = "lacs" | "percent";
export type ExecutiveView = "ceo" | "cfo" | "chairman";

export interface MisFact {
  month: string;
  monthKey: string;
  scenario: Scenario;
  div: string;
  subDivision: string;
  category: string;
  lineItem: string;
  type: string;
  unit: Unit;
  periodType: "MTD" | "YTD";
  fiscalYear: string;
  amountLacs: number;
  sharePct?: number;
  source: string;
}

export interface CommentaryItem {
  id: string;
  type: string;
  div: string;
  subDivision: string;
  category: string;
  comment: string;
  source: string;
}

export interface PlSummaryRow {
  section: string;
  lineItem: string;
  actual: number;
  aop: number;
  varianceDisplay: string;
  variancePct: number;
  rowType: "detail" | "total";
}

export interface DatasetMeta {
  title: string;
  generatedAt: string;
  sourceFiles: {
    html: string | null;
    pbix: string | null;
    xlsx: string | null;
  };
  sourceMode: string;
  limitations: string[];
  schemaUnderstanding: {
    requestedCoreFields: string[];
    pbixModel: {
      tableName: string | null;
      columns: string[];
      measures: string[];
      pages: string[];
      dataSourceMode: string | null;
    };
    xlsxSchema: {
      available: boolean;
      sheets: Array<{ name: string; columns: string[] }>;
      columns: string[];
      error?: string;
      primarySheet?: string;
      profile?: {
        scenarios: string[];
        types: string[];
        divisions: string[];
        subDivisions: string[];
        categories: string[];
        lineItems: string[];
      };
    };
  };
  dataQuality?: {
    totalFactRows: number;
    zeroValueRows: number;
    blankDimensionRows: number;
  };
}

export interface MisDataset {
  meta: DatasetMeta;
  facts: MisFact[];
  commentary: CommentaryItem[];
  plSummary: PlSummaryRow[];
}

export interface MisFilters {
  monthKeys: string[];
  scenarios: Scenario[];
  types: string[];
  divisions: string[];
  subDivisions: string[];
  categories: string[];
  lineItems: string[];
}

export interface MetricCardValue {
  label: string;
  value: string;
  detail: string;
  tone: "brand" | "success" | "warning" | "danger";
}

export interface DetailRow {
  label: string;
  actual?: number;
  aop?: number;
  py?: number;
  variancePct?: number;
  note?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  severity: "Critical" | "Watchlist" | "Opportunity";
  affectedDimension: string;
  explanation: string;
  supportingMetrics: string[];
  recommendedAction: string;
}

export interface SeriesPoint {
  label: string;
  key: string;
  value: number;
}
