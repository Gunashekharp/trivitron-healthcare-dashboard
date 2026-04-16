export interface GenericChartPoint {
  label: string;
  value: number;
}

export interface GenericChartConfig {
  title: string;
  description?: string;
  type: "line" | "bar" | "donut";
  points: GenericChartPoint[];
  categoryKey?: string;
}
