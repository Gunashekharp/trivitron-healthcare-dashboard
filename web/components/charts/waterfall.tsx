"use client";

import { useEffect, useRef } from "react";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { scaleLinear, scaleBand } from "@visx/scale";
import { AxisBottom } from "@visx/axis";
import { LinearGradient } from "@visx/gradient";
import { Text } from "@visx/text";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import type { SeriesPoint } from "@/lib/mis/types";
import { formatLacs } from "@/lib/mis/utils";
import { COLORS } from "./chart-theme";

interface WaterfallProps {
  data: SeriesPoint[];
}

function AnimatedWaterfallBar({
  x, targetY, width, targetH, fill, rx, delay, baseY,
  onMouseEnter, onMouseLeave,
}: {
  x: number; targetY: number; width: number; targetH: number; fill: string; rx: number;
  delay: number; baseY: number;
  onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler;
}) {
  const ref = useRef<SVGRectElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("y", String(baseY));
    el.setAttribute("height", "0");
    el.style.transition = "none";
    requestAnimationFrame(() => {
      el.style.transition = `y 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s, height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s`;
      el.setAttribute("y", String(targetY));
      el.setAttribute("height", String(targetH));
    });
  }, [targetY, targetH, baseY, delay]);
  return <rect ref={ref} x={x} y={baseY} width={width} height={0} fill={fill} rx={rx} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />;
}

function Chart({ width, height, data }: WaterfallProps & { width: number; height: number }) {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop, tooltipOpen } =
    useTooltip<SeriesPoint>();

  const margin = { top: 28, right: 12, bottom: 40, left: 12 };
  const innerW = Math.max(width - margin.left - margin.right, 0);
  const innerH = Math.max(height - margin.top - margin.bottom, 0);

  const maxAbsVal = Math.max(...data.map((d) => Math.abs(d.value)), 1) * 1.2;

  const xScale = scaleBand<string>({ domain: data.map((d) => d.label), range: [0, innerW], padding: 0.25 });
  const yScale = scaleLinear<number>({ domain: [0, maxAbsVal], range: [innerH, 0], nice: true });

  return (
    <>
      <svg width={width} height={height}>
        <defs>
          <LinearGradient id="wf-blue" from={COLORS.brand} to={COLORS.brandLight} />
          <LinearGradient id="wf-green" from={COLORS.success} to={COLORS.successLight} />
          <LinearGradient id="wf-red" from={COLORS.danger} to={COLORS.dangerLight} />
          <filter id="wf-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(15,23,42,0.08)" />
          </filter>
        </defs>
        <Group left={margin.left} top={margin.top}>
          <AxisBottom scale={xScale} top={innerH} stroke={COLORS.grid} tickStroke="transparent" tickLabelProps={{ fill: COLORS.text, fontSize: 9, fontWeight: 600, textAnchor: "middle", angle: -20 }} />

          {data.map((d, i) => {
            const barX = xScale(d.label) ?? 0;
            const barWidth = xScale.bandwidth();
            const isRevenue = d.label === "Revenue";
            const absH = Math.abs(yScale(Math.abs(d.value)) - yScale(0));
            const barY = yScale(Math.abs(d.value));
            const fill = isRevenue ? "url(#wf-blue)" : d.value < 0 ? "url(#wf-red)" : "url(#wf-green)";

            return (
              <g key={d.label}>
                <AnimatedWaterfallBar
                  x={barX} targetY={barY} width={barWidth} targetH={absH}
                  fill={fill} rx={4} delay={0.05 + i * 0.08} baseY={innerH}
                  onMouseEnter={() => showTooltip({ tooltipData: d, tooltipLeft: barX + margin.left + barWidth / 2, tooltipTop: barY + margin.top })}
                  onMouseLeave={hideTooltip}
                />
                <Text x={barX + barWidth / 2} y={barY - 8} textAnchor="middle" fontSize={10} fontWeight={800} fill={COLORS.muted}>
                  {formatLacs(d.value)}
                </Text>
              </g>
            );
          })}
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} className="!rounded-xl !bg-white/95 !px-4 !py-3 !shadow-2xl !border !border-slate-100 !backdrop-blur-md">
          <div className="text-[13px] font-extrabold text-slate-800">{tooltipData.label}</div>
          <div className="mt-1 text-[14px] font-black text-blue-600">{formatLacs(tooltipData.value)}</div>
        </TooltipWithBounds>
      )}
    </>
  );
}

export function WaterfallChart(props: WaterfallProps) {
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
