"use client";

import { useEffect, useRef } from "react";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { scaleLinear, scaleBand } from "@visx/scale";
import { LinearGradient } from "@visx/gradient";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import { Text } from "@visx/text";
import { formatLacs } from "@/lib/mis/utils";
import { COLORS, BAR_CHART_MARGIN } from "./chart-theme";

export interface BarDatum {
  label: string;
  value: number;
}

interface HorizontalBarChartProps {
  data: BarDatum[];
  limit?: number;
  color?: string;
  valueFormatter?: (v: number) => string;
  semanticColor?: (d: BarDatum) => string;
  onClick?: (label: string) => void;
}

function AnimatedBar({
  x, y, targetWidth, height, fill, rx, delay, cursor, onClick, onMouseEnter, onMouseLeave,
}: {
  x: number; y: number; targetWidth: number; height: number; fill: string; rx: number;
  delay: number; cursor: string;
  onClick?: () => void; onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler;
}) {
  const ref = useRef<SVGRectElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("width", "0");
    el.style.transition = "none";
    requestAnimationFrame(() => {
      el.style.transition = `width 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s`;
      el.setAttribute("width", String(targetWidth));
    });
  }, [targetWidth, delay]);
  return (
    <rect
      ref={ref}
      x={x} y={y} width={0} height={height}
      fill={fill} rx={rx}
      style={{ cursor }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
}

function Chart({
  width, height, data, color = COLORS.brand,
  valueFormatter = formatLacs, semanticColor, onClick,
}: HorizontalBarChartProps & { width: number; height: number }) {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop, tooltipOpen } =
    useTooltip<BarDatum>();

  const margin = BAR_CHART_MARGIN;
  const innerW = Math.max(width - margin.left - margin.right, 0);
  const innerH = Math.max(height - margin.top - margin.bottom, 0);

  const sorted = [...data].sort((a, b) => a.value - b.value);
  const maxVal = Math.max(...sorted.map((d) => d.value), 1) * 1.2;

  const yScale = scaleBand<string>({ domain: sorted.map((d) => d.label), range: [innerH, 0], padding: 0.3 });
  const xScale = scaleLinear<number>({ domain: [0, maxVal], range: [0, innerW] });

  return (
    <>
      <svg width={width} height={height}>
        {sorted.map((d, i) => {
          const barColor = semanticColor?.(d) ?? color;
          return (
            <LinearGradient key={`grad-${i}`} id={`bar-grad-${i}`} from={barColor} to={barColor} fromOpacity={0.45} toOpacity={1} x1="0" y1="0" x2="1" y2="0" />
          );
        })}
        <Group left={margin.left} top={margin.top}>
          {sorted.map((d, i) => {
            const barWidth = xScale(d.value);
            const barHeight = yScale.bandwidth();
            const barY = yScale(d.label) ?? 0;
            const rank = i / Math.max(sorted.length - 1, 1);

            return (
              <g key={d.label}>
                <AnimatedBar
                  x={0} y={barY}
                  targetWidth={barWidth}
                  height={barHeight}
                  fill={`url(#bar-grad-${i})`}
                  rx={5}
                  delay={0.05 + rank * 0.08}
                  cursor={onClick ? "pointer" : "default"}
                  onClick={() => onClick?.(d.label)}
                  onMouseEnter={() => {
                    showTooltip({
                      tooltipData: d,
                      tooltipLeft: barWidth + margin.left,
                      tooltipTop: barY + margin.top + barHeight / 2,
                    });
                  }}
                  onMouseLeave={hideTooltip}
                />
                <Text
                  x={-8} y={barY + barHeight / 2}
                  textAnchor="end" verticalAnchor="middle"
                  fontSize={11} fontWeight={600} fill={COLORS.text}
                >
                  {d.label.length > 14 ? d.label.slice(0, 14) + "…" : d.label}
                </Text>
                <Text
                  x={barWidth + 6} y={barY + barHeight / 2}
                  verticalAnchor="middle" fontSize={10} fontWeight={700} fill={COLORS.muted}
                >
                  {valueFormatter(d.value)}
                </Text>
              </g>
            );
          })}
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} className="!rounded-xl !bg-white/95 !px-4 !py-3 !shadow-2xl !border !border-slate-100 !backdrop-blur-md">
          <div className="text-[13px] font-extrabold text-slate-800">{tooltipData.label}</div>
          <div className="mt-1 text-[14px] font-black" style={{ color: semanticColor?.(tooltipData) ?? color }}>
            {valueFormatter(tooltipData.value)}
          </div>
        </TooltipWithBounds>
      )}
    </>
  );
}

export function HorizontalBarChart(props: HorizontalBarChartProps) {
  return (
    <div className="relative h-full w-full">
      <ParentSize>
        {({ width, height }) =>
          width > 0 && height > 0 ? <Chart width={width} height={height} {...props} /> : null
        }
      </ParentSize>
    </div>
  );
}
