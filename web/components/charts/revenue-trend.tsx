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
import type { SeriesPoint, Scenario } from "@/lib/mis/types";
import { formatLacs } from "@/lib/mis/utils";
import { COLORS, CHART_MARGIN } from "./chart-theme";
import { GlowFilter } from "./svg-filters";

interface RevenueTrendProps {
  actual: SeriesPoint[];
  aop: SeriesPoint[];
  py: SeriesPoint[];
  selectedScenarios: Scenario[];
}

function AnimatedLine({ d, stroke, width, dasharray, opacity, delay = 0, glow }: {
  d: string; stroke: string; width: number; dasharray?: string; opacity?: number; delay?: number; glow?: string;
}) {
  const ref = useRef<SVGPathElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    el.style.transition = "none";
    requestAnimationFrame(() => {
      el.style.transition = `stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1) ${delay}s`;
      el.style.strokeDashoffset = "0";
    });
  }, [d, delay]);
  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={dasharray}
      opacity={opacity}
      filter={glow}
    />
  );
}

function AnimatedDot({ cx, cy, r, fill, delay, onMouseEnter, onMouseLeave }: {
  cx: number; cy: number; r: number; fill: string; delay: number;
  onMouseEnter?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler;
}) {
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
  return (
    <circle
      ref={ref}
      cx={cx} cy={cy} r={r} fill={fill}
      stroke="#fff" strokeWidth={2.5}
      style={{ cursor: "pointer" }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
    />
  );
}

function Chart({
  width, height, actual, aop, py, selectedScenarios,
}: RevenueTrendProps & { width: number; height: number }) {
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop, tooltipOpen } =
    useTooltip<{ label: string; actual: number; aop: number; py: number }>();

  const margin = CHART_MARGIN;
  const innerW = Math.max(width - margin.left - margin.right, 0);
  const innerH = Math.max(height - margin.top - margin.bottom, 0);

  const labels = actual.map((d) => d.label);
  const allValues = [...actual, ...aop, ...py].map((d) => d.value);
  const maxVal = Math.max(...allValues, 1);

  const xScale = scalePoint<string>({ domain: labels, range: [0, innerW], padding: 0.5 });
  const yScale = scaleLinear<number>({ domain: [0, maxVal * 1.1], range: [innerH, 0], nice: true });

  const getX = (d: SeriesPoint) => xScale(d.label) ?? 0;
  const getY = (d: SeriesPoint) => yScale(d.value);

  const showActual = selectedScenarios.includes("Actual");
  const showAop = selectedScenarios.includes("AOP");
  const showPy = selectedScenarios.includes("PY");

  return (
    <>
      <svg width={width} height={height}>
        <defs>
          <GlowFilter id="glow-brand" color={COLORS.brand} stdDeviation={5} />
          <LinearGradient id="area-gradient" from={COLORS.brand} to={COLORS.brand} fromOpacity={0.22} toOpacity={0} />
        </defs>
        <Group left={margin.left} top={margin.top}>
          <AxisLeft
            scale={yScale} numTicks={5} tickFormat={(v) => `${v}L`}
            stroke={COLORS.grid} tickStroke="transparent"
            tickLabelProps={{ fill: COLORS.muted, fontSize: 10, fontWeight: 500, dx: -4 }}
          />
          <AxisBottom
            scale={xScale} top={innerH} stroke={COLORS.grid} tickStroke="transparent"
            tickLabelProps={{ fill: COLORS.muted, fontSize: 10, fontWeight: 500, textAnchor: "middle" }}
          />
          {[...Array(5)].map((_, i) => {
            const y = (innerH / 5) * i;
            return <line key={i} x1={0} x2={innerW} y1={y} y2={y} stroke={COLORS.grid} strokeDasharray="4 4" />;
          })}

          {showActual && (
            <AreaClosed data={actual} x={getX} y={getY} yScale={yScale} curve={curveMonotoneX} fill="url(#area-gradient)">
              {({ path }) => (
                <path d={path(actual) ?? ""} fill="url(#area-gradient)" opacity={0.9}>
                  <animate attributeName="opacity" from="0" to="0.9" dur="1s" fill="freeze" />
                </path>
              )}
            </AreaClosed>
          )}

          {showActual && (
            <AnimatedLine
              d={LinePath({ data: actual, x: getX, y: getY, curve: curveMonotoneX }) as unknown as string || actual.map((d, i) => `${i === 0 ? "M" : "L"}${getX(d)},${getY(d)}`).join(" ")}
              stroke={COLORS.brand} width={3} glow="url(#glow-brand)"
            />
          )}
          {showActual && (
            <LinePath data={actual} x={getX} y={getY} curve={curveMonotoneX} stroke={COLORS.brand} strokeWidth={3} strokeLinecap="round" filter="url(#glow-brand)" />
          )}
          {showAop && (
            <LinePath data={aop} x={getX} y={getY} curve={curveMonotoneX} stroke={COLORS.warning} strokeWidth={2} strokeDasharray="8 4" strokeLinecap="round" />
          )}
          {showPy && (
            <LinePath data={py} x={getX} y={getY} curve={curveMonotoneX} stroke={COLORS.muted} strokeWidth={2} strokeDasharray="3 3" strokeLinecap="round" opacity={0.7} />
          )}

          {showActual && actual.map((d, i) => (
            <AnimatedDot
              key={`dot-a-${i}`}
              cx={getX(d)} cy={getY(d)} r={5.5} fill={COLORS.brand}
              delay={0.3 + i * 0.06}
              onMouseEnter={() => {
                showTooltip({
                  tooltipData: { label: d.label, actual: d.value, aop: aop[i]?.value ?? 0, py: py[i]?.value ?? 0 },
                  tooltipLeft: getX(d) + margin.left,
                  tooltipTop: getY(d) + margin.top,
                });
              }}
              onMouseLeave={hideTooltip}
            />
          ))}
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} className="!rounded-xl !bg-white/95 !px-4 !py-3 !shadow-2xl !border !border-slate-100 !backdrop-blur-md">
          <div className="text-[13px] font-extrabold text-slate-800">{tooltipData.label}</div>
          <div className="mt-1.5 space-y-1 text-[12px]">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> <span className="font-bold text-blue-600">Actual</span> <span className="ml-auto font-extrabold">{formatLacs(tooltipData.actual)}</span></div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> <span className="font-bold text-amber-600">AOP</span> <span className="ml-auto font-extrabold">{formatLacs(tooltipData.aop)}</span></div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-400" /> <span className="font-bold text-slate-500">PY</span> <span className="ml-auto font-extrabold">{formatLacs(tooltipData.py)}</span></div>
          </div>
        </TooltipWithBounds>
      )}
    </>
  );
}

export function RevenueTrendChart(props: RevenueTrendProps) {
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
