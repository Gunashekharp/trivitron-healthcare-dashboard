"use client";

import { useEffect, useRef } from "react";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { LinePath, AreaClosed } from "@visx/shape";
import { scaleLinear, scalePoint } from "@visx/scale";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { LinearGradient } from "@visx/gradient";
import { curveMonotoneX } from "@visx/curve";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import type { SeriesPoint } from "@/lib/mis/types";
import { COLORS, CHART_MARGIN } from "./chart-theme";
import { GlowFilter } from "./svg-filters";

interface MarginTrendProps {
  gm1: SeriesPoint[];
  ebit: SeriesPoint[];
}

function AnimatedDot({ cx, cy, r, fill, delay }: { cx: number; cy: number; r: number; fill: string; delay: number }) {
  const ref = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "scale(0)";
    el.style.transformOrigin = `${cx}px ${cy}px`;
    el.style.transition = "none";
    requestAnimationFrame(() => {
      el.style.transition = `transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s`;
      el.style.transform = "scale(1)";
    });
  }, [cx, cy, delay]);
  return <circle ref={ref} cx={cx} cy={cy} r={r} fill={fill} stroke="#fff" strokeWidth={2.5} style={{ cursor: "pointer" }} />;
}

function Chart({ width, height, gm1, ebit }: MarginTrendProps & { width: number; height: number }) {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop, tooltipOpen } =
    useTooltip<{ label: string; gm1: number; ebit: number }>();

  const margin = CHART_MARGIN;
  const innerW = Math.max(width - margin.left - margin.right, 0);
  const innerH = Math.max(height - margin.top - margin.bottom, 0);

  const labels = gm1.map((d) => d.label);
  const allVals = [...gm1, ...ebit].map((d) => d.value);
  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 1);

  const xScale = scalePoint<string>({ domain: labels, range: [0, innerW], padding: 0.5 });
  const yScale = scaleLinear<number>({ domain: [minVal - 2, maxVal + 5], range: [innerH, 0], nice: true });

  const getX = (d: SeriesPoint) => xScale(d.label) ?? 0;
  const getY = (d: SeriesPoint) => yScale(d.value);

  return (
    <>
      <svg width={width} height={height}>
        <defs>
          <LinearGradient id="gm1-area" from={COLORS.success} to={COLORS.success} fromOpacity={0.18} toOpacity={0} />
          <LinearGradient id="ebit-area" from={COLORS.brand} to={COLORS.brand} fromOpacity={0.15} toOpacity={0} />
          <GlowFilter id="glow-success" color={COLORS.success} stdDeviation={4} />
          <GlowFilter id="glow-brand-m" color={COLORS.brand} stdDeviation={4} />
        </defs>
        <Group left={margin.left} top={margin.top}>
          <AxisLeft scale={yScale} numTicks={5} tickFormat={(v) => `${v}%`} stroke={COLORS.grid} tickStroke="transparent" tickLabelProps={{ fill: COLORS.muted, fontSize: 10, fontWeight: 500, dx: -4 }} />
          <AxisBottom scale={xScale} top={innerH} stroke={COLORS.grid} tickStroke="transparent" tickLabelProps={{ fill: COLORS.muted, fontSize: 10, fontWeight: 500, textAnchor: "middle" }} />
          {[...Array(5)].map((_, i) => { const y = (innerH / 5) * i; return <line key={i} x1={0} x2={innerW} y1={y} y2={y} stroke={COLORS.grid} strokeDasharray="4 4" />; })}

          <AreaClosed data={gm1} x={getX} y={getY} yScale={yScale} curve={curveMonotoneX} fill="url(#gm1-area)">
            {({ path }) => <path d={path(gm1) ?? ""} fill="url(#gm1-area)"><animate attributeName="opacity" from="0" to="1" dur="0.8s" fill="freeze" /></path>}
          </AreaClosed>
          <LinePath data={gm1} x={getX} y={getY} curve={curveMonotoneX} stroke={COLORS.success} strokeWidth={2.5} filter="url(#glow-success)" />

          <AreaClosed data={ebit} x={getX} y={getY} yScale={yScale} curve={curveMonotoneX} fill="url(#ebit-area)">
            {({ path }) => <path d={path(ebit) ?? ""} fill="url(#ebit-area)"><animate attributeName="opacity" from="0" to="1" dur="0.8s" begin="0.2s" fill="freeze" /></path>}
          </AreaClosed>
          <LinePath data={ebit} x={getX} y={getY} curve={curveMonotoneX} stroke={COLORS.brand} strokeWidth={2.5} filter="url(#glow-brand-m)" />

          {gm1.map((d, i) => (
            <g key={`gm1-${i}`}
              onMouseEnter={() => showTooltip({ tooltipData: { label: d.label, gm1: d.value, ebit: ebit[i]?.value ?? 0 }, tooltipLeft: getX(d) + margin.left, tooltipTop: getY(d) + margin.top })}
              onMouseLeave={hideTooltip}
            >
              <AnimatedDot cx={getX(d)} cy={getY(d)} r={4.5} fill={COLORS.success} delay={0.3 + i * 0.06} />
            </g>
          ))}
          {ebit.map((d, i) => (
            <AnimatedDot key={`ebit-${i}`} cx={getX(d)} cy={getY(d)} r={4.5} fill={COLORS.brand} delay={0.4 + i * 0.06} />
          ))}
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} className="!rounded-xl !bg-white/95 !px-4 !py-3 !shadow-2xl !border !border-slate-100 !backdrop-blur-md">
          <div className="text-[13px] font-extrabold text-slate-800">{tooltipData.label}</div>
          <div className="mt-1.5 space-y-1 text-[12px]">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> <span className="font-bold text-emerald-600">GM1</span> <span className="ml-auto font-extrabold">{tooltipData.gm1.toFixed(1)}%</span></div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> <span className="font-bold text-blue-600">EBIT</span> <span className="ml-auto font-extrabold">{tooltipData.ebit.toFixed(1)}%</span></div>
          </div>
        </TooltipWithBounds>
      )}
    </>
  );
}

export function MarginTrendChart(props: MarginTrendProps) {
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
