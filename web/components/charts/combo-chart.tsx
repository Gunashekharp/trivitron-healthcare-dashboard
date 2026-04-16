"use client";

import { useEffect, useRef } from "react";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { scaleLinear, scaleBand } from "@visx/scale";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { LinearGradient } from "@visx/gradient";
import { curveMonotoneX } from "@visx/curve";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import type { SeriesPoint, Scenario } from "@/lib/mis/types";
import { COLORS, CHART_MARGIN } from "./chart-theme";
import { GlowFilter } from "./svg-filters";

interface ComboChartProps {
  barData: SeriesPoint[];
  lineData: SeriesPoint[];
  barLabel?: string;
  lineLabel?: string;
  formatValue?: (v: number) => string;
  selectedScenarios: Scenario[];
}

function AnimatedVerticalBar({
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
      el.style.transition = `y 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s, height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s`;
      el.setAttribute("y", String(targetY));
      el.setAttribute("height", String(targetH));
    });
  }, [targetY, targetH, baseY, delay]);
  return (
    <rect ref={ref} x={x} y={baseY} width={width} height={0} fill={fill} rx={rx} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />
  );
}

function Chart({
  width, height, barData, lineData, formatValue = (v) => `${v.toFixed(1)}%`, selectedScenarios,
}: ComboChartProps & { width: number; height: number }) {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop, tooltipOpen } =
    useTooltip<{ label: string; bar: number; line: number }>();

  const margin = CHART_MARGIN;
  const innerW = Math.max(width - margin.left - margin.right, 0);
  const innerH = Math.max(height - margin.top - margin.bottom, 0);

  const labels = barData.map((d) => d.label);
  const allValues = [...barData, ...lineData].map((d) => d.value);
  const minVal = Math.min(...allValues, 0);
  const maxVal = Math.max(...allValues, 1);
  const padding = (maxVal - minVal) * 0.15;

  const xScale = scaleBand<string>({ domain: labels, range: [0, innerW], padding: 0.35 });
  const yScale = scaleLinear<number>({ domain: [minVal - padding, maxVal + padding], range: [innerH, 0], nice: true });

  const showActual = selectedScenarios.includes("Actual");
  const showAop = selectedScenarios.includes("AOP");

  return (
    <>
      <svg width={width} height={height}>
        <defs>
          <LinearGradient id="combo-bar-pos" from={COLORS.brand} to={COLORS.brandLight} />
          <LinearGradient id="combo-bar-neg" from={COLORS.danger} to={COLORS.dangerLight} />
          <GlowFilter id="glow-warning" color={COLORS.warning} stdDeviation={3} />
        </defs>
        <Group left={margin.left} top={margin.top}>
          <AxisLeft scale={yScale} numTicks={5} tickFormat={(v) => `${v}%`} stroke={COLORS.grid} tickStroke="transparent" tickLabelProps={{ fill: COLORS.muted, fontSize: 10, fontWeight: 500, dx: -4 }} />
          <AxisBottom scale={xScale} top={innerH} stroke={COLORS.grid} tickStroke="transparent" tickLabelProps={{ fill: COLORS.muted, fontSize: 10, fontWeight: 500, textAnchor: "middle" }} />
          {[...Array(5)].map((_, i) => { const y = (innerH / 5) * i; return <line key={i} x1={0} x2={innerW} y1={y} y2={y} stroke={COLORS.grid} strokeDasharray="4 4" />; })}
          {minVal < 0 && <line x1={0} x2={innerW} y1={yScale(0)} y2={yScale(0)} stroke={COLORS.muted} strokeWidth={1} opacity={0.3} />}

          {showActual && barData.map((d, i) => {
            const barX = xScale(d.label) ?? 0;
            const barWidth = xScale.bandwidth();
            const barY = d.value >= 0 ? yScale(d.value) : yScale(0);
            const barH = Math.abs(yScale(d.value) - yScale(0));

            return (
              <AnimatedVerticalBar
                key={`bar-${i}`}
                x={barX} targetY={barY} width={barWidth} targetH={barH}
                fill={d.value >= 0 ? "url(#combo-bar-pos)" : "url(#combo-bar-neg)"}
                rx={4} delay={0.05 + i * 0.04} baseY={yScale(0)}
                onMouseEnter={() => {
                  showTooltip({
                    tooltipData: { label: d.label, bar: d.value, line: lineData[i]?.value ?? 0 },
                    tooltipLeft: barX + margin.left + barWidth / 2,
                    tooltipTop: barY + margin.top,
                  });
                }}
                onMouseLeave={hideTooltip}
              />
            );
          })}

          {showAop && lineData.length > 0 && (
            <>
              <LinePath
                data={lineData}
                x={(d) => (xScale(d.label) ?? 0) + xScale.bandwidth() / 2}
                y={(d) => yScale(d.value)}
                curve={curveMonotoneX}
                stroke={COLORS.warning} strokeWidth={2.5} strokeDasharray="6 4"
                filter="url(#glow-warning)"
              />
              {lineData.map((d, i) => (
                <circle key={`lp-${i}`} cx={(xScale(d.label) ?? 0) + xScale.bandwidth() / 2} cy={yScale(d.value)} r={4.5} fill={COLORS.warning} stroke="#fff" strokeWidth={2.5} />
              ))}
            </>
          )}
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} className="!rounded-xl !bg-white/95 !px-4 !py-3 !shadow-2xl !border !border-slate-100 !backdrop-blur-md">
          <div className="text-[13px] font-extrabold text-slate-800">{tooltipData.label}</div>
          <div className="mt-1.5 space-y-1 text-[12px]">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> <span className="font-bold text-blue-600">Actual</span> <span className="ml-auto font-extrabold">{formatValue(tooltipData.bar)}</span></div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> <span className="font-bold text-amber-600">AOP</span> <span className="ml-auto font-extrabold">{formatValue(tooltipData.line)}</span></div>
          </div>
        </TooltipWithBounds>
      )}
    </>
  );
}

export function ComboChart(props: ComboChartProps) {
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
