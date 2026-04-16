"use client";

import { GeoDonutChart } from "@/components/charts/geo-donut";
import { HorizontalBarChart } from "@/components/charts/bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenericLineChart } from "@/components/dashboard/generic-line-chart";
import type { GenericChartConfig } from "@/lib/dashboard/generic-types";

export function GenericChartPanel({ chart }: { chart: GenericChartConfig }) {
  return (
    <Card className="min-h-[340px]">
      <CardHeader>
        <CardTitle>{chart.title}</CardTitle>
        <div className="text-xs font-medium text-slate-500">{chart.description}</div>
      </CardHeader>
      <CardContent className="h-[260px]">
        {chart.type === "line" ? <GenericLineChart points={chart.points} /> : null}
        {chart.type === "bar" ? (
          <HorizontalBarChart
            data={chart.points.map((point) => ({
              label: point.label,
              value: point.value,
            }))}
            valueFormatter={(value) => value.toLocaleString()}
          />
        ) : null}
        {chart.type === "donut" ? (
          <GeoDonutChart
            data={chart.points.map((point) => ({
              label: point.label,
              value: point.value,
              sharePct:
                chart.points.length > 0
                  ? (point.value /
                      chart.points.reduce((sum, item) => sum + item.value, 0)) *
                    100
                  : 0,
            }))}
            centerLabel="total"
            legendTitle={chart.categoryKey ?? "category"}
            valueFormatter={(value) => value.toLocaleString()}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
