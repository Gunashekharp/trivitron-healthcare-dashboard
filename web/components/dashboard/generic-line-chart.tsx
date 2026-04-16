"use client";

import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { scaleLinear, scalePoint } from "@visx/scale";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";
import { COLORS, CHART_MARGIN } from "@/components/charts/chart-theme";
import type { GenericChartPoint } from "@/lib/dashboard/generic-types";

function Chart({
  width,
  height,
  points,
}: {
  width: number;
  height: number;
  points: GenericChartPoint[];
}) {
  const margin = CHART_MARGIN;
  const innerW = Math.max(width - margin.left - margin.right, 0);
  const innerH = Math.max(height - margin.top - margin.bottom, 0);

  const labels = points.map((d) => d.label);
  const maxVal = Math.max(...points.map((d) => d.value), 1);

  const xScale = scalePoint<string>({
    domain: labels,
    range: [0, innerW],
    padding: 0.5,
  });
  const yScale = scaleLinear<number>({
    domain: [0, maxVal * 1.1],
    range: [innerH, 0],
    nice: true,
  });

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        <AxisLeft
          scale={yScale}
          numTicks={5}
          stroke={COLORS.grid}
          tickStroke="transparent"
          tickLabelProps={{
            fill: COLORS.muted,
            fontSize: 10,
            fontWeight: 500,
            dx: -4,
          }}
        />
        <AxisBottom
          scale={xScale}
          top={innerH}
          stroke={COLORS.grid}
          tickStroke="transparent"
          tickLabelProps={{
            fill: COLORS.muted,
            fontSize: 10,
            fontWeight: 500,
            textAnchor: "middle",
          }}
        />
        <LinePath
          data={points}
          x={(d) => xScale(d.label) ?? 0}
          y={(d) => yScale(d.value)}
          curve={curveMonotoneX}
          stroke={COLORS.brand}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {points.map((d, i) => (
          <circle
            key={i}
            cx={xScale(d.label) ?? 0}
            cy={yScale(d.value)}
            r={4}
            fill={COLORS.brand}
            stroke="#fff"
            strokeWidth={2}
          />
        ))}
      </Group>
    </svg>
  );
}

export function GenericLineChart({ points }: { points: GenericChartPoint[] }) {
  return (
    <div className="relative h-full w-full">
      <ParentSize>
        {({ width, height }) =>
          width > 0 && height > 0 ? (
            <Chart width={width} height={height} points={points} />
          ) : null
        }
      </ParentSize>
    </div>
  );
}
