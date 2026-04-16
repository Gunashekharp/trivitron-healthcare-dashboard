"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { ParentSize } from "@visx/responsive";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import { pie as d3Pie, arc as d3Arc } from "d3-shape";
import type { PieArcDatum } from "d3-shape";
import gsap from "gsap";
import { formatLacs } from "@/lib/mis/utils";
import { COLORS } from "./chart-theme";

const DONUT_PALETTE = ["#eb6a2f", "#7a19a8", "#2536a7", "#0ea5e9", "#10b981", "#f43f5e"];

interface DonutDatum {
  label: string;
  value: number;
  sharePct?: number;
}

interface GeoDonutProps {
  data: DonutDatum[];
  onClick?: (label: string) => void;
  legendTitle?: string;
  centerLabel?: string;
  valueFormatter?: (value: number) => string;
}

function fmtVal(v: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number) {
  const r = Math.round(v);
  return Math.abs(v - r) < 0.01 ? `${r}%` : `${v.toFixed(2)}%`;
}

interface LabelPos {
  startX: number;
  startY: number;
  elbowX: number;
  dotX: number;
  anchorY: number;
  textX: number;
  isRight: boolean;
}

function resolveOverlaps(items: LabelPos[], bound: number) {
  const GAP = 22;
  for (const side of [true, false] as const) {
    const group = items.filter((l) => l.isRight === side);
    group.sort((a, b) => a.anchorY - b.anchorY);
    for (let j = 1; j < group.length; j++) {
      if (group[j].anchorY - group[j - 1].anchorY < GAP) {
        group[j].anchorY = group[j - 1].anchorY + GAP;
      }
    }
    if (group.length && group[group.length - 1].anchorY > bound) {
      const shift = group[group.length - 1].anchorY - bound;
      for (const l of group) l.anchorY -= shift;
      for (let j = 1; j < group.length; j++) {
        if (group[j].anchorY - group[j - 1].anchorY < GAP) {
          group[j].anchorY = group[j - 1].anchorY + GAP;
        }
      }
    }
    for (const l of group) {
      l.anchorY = Math.max(-bound, Math.min(bound, l.anchorY));
    }
  }
}

function Chart({
  width,
  height,
  data,
  onClick,
  legendTitle = "geography",
  centerLabel = "total lacs",
  valueFormatter = formatLacs,
}: GeoDonutProps & { width: number; height: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<SVGTSpanElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const prevDataKey = useRef("");
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop, tooltipOpen } =
    useTooltip<DonutDatum>();

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const stacked = width < 500;
  const legendW = stacked ? 0 : Math.min(Math.max(width * 0.26, 130), 176);
  const legendH = stacked ? data.length * 26 + 28 : 0;
  const chartW = width - legendW;
  const chartH = height - legendH;
  const cx = chartW / 2;
  const cy = chartH / 2;

  const labelTexts = useMemo(
    () =>
      data.map((d) => {
        const pct = d.sharePct ?? (total ? (d.value / total) * 100 : 0);
        return `${fmtVal(d.value)} (${fmtPct(pct)})`;
      }),
    [data, total],
  );

  const maxTextW = useMemo(
    () => Math.max(...labelTexts.map((t) => t.length * 6.5 + 8), 80),
    [labelTexts],
  );

  const labelReserve = maxTextW + 38;
  const outerR = Math.max(Math.min(chartW / 2 - labelReserve, chartH / 2 - 24, 110), 36);
  const innerR = outerR * 0.62;

  const pieGen = useMemo(
    () => d3Pie<DonutDatum>().value((d) => d.value).sort(null).padAngle(0.025),
    [],
  );
  const arcs = useMemo(() => pieGen(data), [pieGen, data]);

  const arcPath = useMemo(
    () =>
      d3Arc<PieArcDatum<DonutDatum>>()
        .innerRadius(innerR)
        .outerRadius(outerR)
        .cornerRadius(6),
    [innerR, outerR],
  );

  const labels: LabelPos[] = useMemo(() => {
    const elbowR = outerR + 16;
    const dotDist = outerR + 24;
    const items = arcs.map((arc) => {
      const mid = (arc.startAngle + arc.endAngle) / 2 - Math.PI / 2;
      const cos = Math.cos(mid);
      const sin = Math.sin(mid);
      const isRight = cos >= 0;
      return {
        startX: cos * (outerR + 3),
        startY: sin * (outerR + 3),
        elbowX: cos * elbowR,
        dotX: isRight ? dotDist : -dotDist,
        anchorY: sin * elbowR,
        textX: isRight ? dotDist + 8 : -(dotDist + 8),
        isRight,
      };
    });
    resolveOverlaps(items, chartH / 2 - 14);
    return items;
  }, [arcs, outerR, chartH]);

  // GSAP entrance animation (replays when data changes)
  useEffect(() => {
    const key = data.map((d) => `${d.label}:${d.value}`).join("|");
    if (key === prevDataKey.current) return;
    prevDataKey.current = key;

    const el = wrapRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        "[data-arc]",
        { scale: 0, opacity: 0, rotation: -90, transformOrigin: "center center" },
        { scale: 1, opacity: 1, rotation: 0, duration: 0.65, stagger: 0.1, ease: "back.out(1.6)" },
      );

      const counter = { v: 0 };
      tl.to(
        counter,
        {
          v: total,
          duration: 1.0,
          ease: "power2.out",
          onUpdate() {
            if (counterRef.current) {
              counterRef.current.textContent = fmtVal(Math.round(counter.v));
            }
          },
        },
        0.15,
      );

      tl.fromTo(
        "[data-leader]",
        { strokeDashoffset: 600, strokeDasharray: 600 },
        { strokeDashoffset: 0, duration: 0.55, stagger: 0.08, ease: "power2.inOut" },
        0.35,
      );

      tl.fromTo(
        "[data-dot]",
        { scale: 0, transformOrigin: "center center" },
        { scale: 1, duration: 0.3, stagger: 0.06, ease: "back.out(3)" },
        0.55,
      );

      tl.fromTo(
        "[data-callout]",
        { opacity: 0, x: (_i: number, el: Element) => (el.getAttribute("data-side") === "r" ? 14 : -14) },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.06 },
        0.6,
      );

      tl.fromTo(
        "[data-legend-item]",
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.05 },
        0.65,
      );
    }, el);

    return () => ctx.revert();
  }, [data, total]);

  const hover = useCallback((idx: number | null) => {
    setHoverIdx(idx);
    const el = wrapRef.current;
    if (!el) return;
    el.querySelectorAll<SVGPathElement>("[data-arc]").forEach((path, i) => {
      gsap.to(path, {
        scale: idx === null ? 1 : i === idx ? 1.07 : 0.96,
        opacity: idx === null ? 1 : i === idx ? 1 : 0.28,
        duration: 0.28,
        ease: "power2.out",
        transformOrigin: "center center",
        overwrite: "auto",
      });
    });
  }, []);

  if (!data.length) {
    return (
      <div className="grid h-full w-full place-items-center text-center">
        <div>
          <div className="text-sm font-bold text-slate-700">No data to plot</div>
          <div className="mt-1 text-xs font-medium text-slate-400">
            Adjust filters to populate this chart.
          </div>
        </div>
      </div>
    );
  }

  const activeLabel = hoverIdx !== null ? data[hoverIdx]?.label : centerLabel;
  const activeColor =
    hoverIdx !== null ? DONUT_PALETTE[hoverIdx % DONUT_PALETTE.length] : COLORS.muted;

  return (
    <div
      ref={wrapRef}
      className="relative flex h-full w-full"
      style={{ flexDirection: stacked ? "column" : "row" }}
    >
      <div className="relative flex-1" style={{ minWidth: 0, minHeight: stacked ? chartH : undefined }}>
        <svg
          width={chartW}
          height={chartH}
          viewBox={`0 0 ${chartW} ${chartH}`}
          style={{ overflow: "visible" }}
        >
          <g transform={`translate(${cx},${cy})`}>
            <circle
              r={(outerR + innerR) / 2}
              fill="none"
              stroke="rgba(148,163,184,0.07)"
              strokeWidth={outerR - innerR}
            />

            {arcs.map((arc, i) => {
              const color = DONUT_PALETTE[i % DONUT_PALETTE.length];
              const mid = (arc.startAngle + arc.endAngle) / 2 - Math.PI / 2;
              return (
                <path
                  key={arc.data.label}
                  data-arc=""
                  d={arcPath(arc) ?? ""}
                  fill={color}
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={2.5}
                  style={{ cursor: onClick ? "pointer" : "default", willChange: "transform, opacity" }}
                  onClick={() => onClick?.(arc.data.label)}
                  onMouseEnter={() => {
                    hover(i);
                    showTooltip({
                      tooltipData: arc.data,
                      tooltipLeft: cx + Math.cos(mid) * outerR,
                      tooltipTop: cy + Math.sin(mid) * outerR,
                    });
                  }}
                  onMouseLeave={() => {
                    hover(null);
                    hideTooltip();
                  }}
                />
              );
            })}

            <circle r={innerR - 1.5} fill="white" />

            <text textAnchor="middle" dominantBaseline="auto" y={-3} className="select-none">
              <tspan
                ref={counterRef}
                fontSize={outerR > 70 ? 32 : 24}
                fontWeight={900}
                fill={COLORS.text}
              >
                {fmtVal(total)}
              </tspan>
            </text>
            <text textAnchor="middle" dominantBaseline="hanging" y={outerR > 70 ? 10 : 6} className="select-none">
              <tspan fontSize={11} fontWeight={700} fill={activeColor}>
                {activeLabel}
              </tspan>
            </text>

            {labels.map((lbl, i) => {
              const arc = arcs[i];
              const color = DONUT_PALETTE[i % DONUT_PALETTE.length];
              const hi = hoverIdx === i;
              return (
                <g key={`lbl-${arc.data.label}`}>
                  <polyline
                    data-leader=""
                    points={`${lbl.startX},${lbl.startY} ${lbl.elbowX},${lbl.anchorY} ${lbl.dotX},${lbl.anchorY}`}
                    fill="none"
                    stroke={hi ? color : "rgba(148,163,184,0.4)"}
                    strokeWidth={hi ? 2 : 1.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
                  />
                  <circle data-dot="" cx={lbl.dotX} cy={lbl.anchorY} r={3} fill={color} />
                  <text
                    data-callout=""
                    data-side={lbl.isRight ? "r" : "l"}
                    x={lbl.textX}
                    y={lbl.anchorY}
                    textAnchor={lbl.isRight ? "start" : "end"}
                    dominantBaseline="middle"
                    fontSize={11}
                    fontWeight={hi ? 800 : 600}
                    fill={hi ? COLORS.text : COLORS.muted}
                    style={{ transition: "fill 0.2s" }}
                  >
                    {labelTexts[i]}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {tooltipOpen && tooltipData && (
          <TooltipWithBounds
            left={tooltipLeft}
            top={tooltipTop}
            className="!rounded-xl !border !border-slate-100 !bg-white/95 !px-4 !py-3 !shadow-2xl !backdrop-blur-md"
          >
            <div className="text-[13px] font-extrabold text-slate-800">{tooltipData.label}</div>
            <div className="mt-1 text-[14px] font-black text-blue-600">
              {valueFormatter(tooltipData.value)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500">
              {fmtPct(tooltipData.sharePct ?? (total ? (tooltipData.value / total) * 100 : 0))} share
            </div>
          </TooltipWithBounds>
        )}
      </div>

      <div
        className={
          stacked
            ? "flex flex-wrap gap-x-4 gap-y-0.5 px-3 pt-1"
            : "flex flex-col justify-center pr-1"
        }
        style={stacked ? {} : { width: legendW, minWidth: legendW }}
      >
        <div
          className={`text-[10px] font-extrabold uppercase tracking-[1.4px] text-slate-900 ${stacked ? "w-full" : "mb-2.5"}`}
        >
          {legendTitle}
        </div>
        {data.map((d, i) => {
          const pct = d.sharePct ?? (total ? (d.value / total) * 100 : 0);
          const active = hoverIdx === null || hoverIdx === i;
          return (
            <div
              key={d.label}
              data-legend-item=""
              className="flex items-center gap-2 py-1 transition-opacity duration-200"
              style={{
                cursor: onClick ? "pointer" : "default",
                opacity: active ? 1 : 0.28,
              }}
              onClick={() => onClick?.(d.label)}
              onMouseEnter={() => hover(i)}
              onMouseLeave={() => hover(null)}
            >
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }}
              />
              <span
                className={`flex-1 text-[11px] font-semibold ${hoverIdx === i ? "text-slate-900" : "text-slate-500"}`}
              >
                {d.label}
              </span>
              <span className="text-[10px] font-extrabold text-slate-900">{fmtPct(pct)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GeoDonutChart(props: GeoDonutProps) {
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
