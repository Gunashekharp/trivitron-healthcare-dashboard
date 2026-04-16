"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { RevenueTrendChart } from "@/components/charts/revenue-trend";
import { HorizontalBarChart } from "@/components/charts/bar-chart";
import { GeoDonutChart } from "@/components/charts/geo-donut";
import { ComboChart } from "@/components/charts/combo-chart";
import { MarginTrendChart } from "@/components/charts/margin-trend";
import { WaterfallChart } from "@/components/charts/waterfall";

import { AiChatPanel } from "@/components/ai/ai-chat-panel";
import { AiInsightsPanel } from "@/components/ai/ai-insights";
import { AiChatbotLogo } from "@/components/icons/ai-chatbot-logo";

import { buildDashboardModel, buildDefaultFilters } from "@/lib/mis/engine";
import { useDashboardStore } from "@/lib/store";
import type {
  ExecutiveView,
  MetricCardValue,
  MisDataset,
  MisFilters,
  Recommendation,
} from "@/lib/mis/types";
import {
  cn,
  formatLacs,
  formatPercent,
  formatSignedLacs,
  formatVariance,
} from "@/lib/mis/utils";

const VIEW_TITLES: Record<ExecutiveView, string> = {
  ceo: "CEO View",
  cfo: "CFO View",
  chairman: "Chairman View",
};

const STAGGER_CHILDREN = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const FADE_UP = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const PAGE_TRANSITION = {
  initial: { opacity: 0, x: 12, filter: "blur(4px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit: { opacity: 0, x: -12, filter: "blur(4px)", transition: { duration: 0.25 } },
};

function toggleSelection(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

/* ─── Sub-components ─── */

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all duration-200",
        active
          ? "border-blue-400/50 bg-gradient-to-r from-blue-50 to-blue-100/60 text-blue-700 shadow-[0_2px_8px_rgba(59,130,246,0.15)]"
          : "border-slate-200/80 bg-white text-slate-500 hover:border-blue-300/60 hover:bg-blue-50/40",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function AnimatedValue({ value }: { value: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="inline-block"
    >
      {value}
    </motion.span>
  );
}

function MetricCard({ metric, index }: { metric: MetricCardValue; index: number }) {
  const accent = {
    brand: "from-blue-500 to-blue-600",
    success: "from-emerald-500 to-teal-500",
    warning: "from-amber-500 to-orange-500",
    danger: "from-rose-500 to-red-500",
  }[metric.tone];

  const softBg = {
    brand: "from-blue-50/60 via-white to-white",
    success: "from-emerald-50/50 via-white to-white",
    warning: "from-amber-50/50 via-white to-white",
    danger: "from-rose-50/50 via-white to-white",
  }[metric.tone];

  const glow = {
    brand: "rgba(59,130,246,0.15)",
    success: "rgba(16,185,129,0.15)",
    warning: "rgba(245,158,11,0.15)",
    danger: "rgba(239,68,68,0.15)",
  }[metric.tone];

  return (
    <motion.div
      variants={FADE_UP}
      whileHover={{ y: -3, boxShadow: `0 12px 40px ${glow}` }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="group relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white to-slate-50/40 backdrop-blur-sm"
    >
      <motion.div
        className={cn("absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r", accent)}
        initial={{ scaleX: 0, transformOrigin: "left" }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
      />
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-40", softBg)} />
      <div className="relative px-4 pb-3 pt-4">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">{metric.label}</div>
        <div className="mt-1.5 text-[26px] font-black leading-none tracking-tight text-slate-900">
          <AnimatedValue value={metric.value} />
        </div>
        <div className="mt-1.5 text-[11px] font-semibold text-slate-500">{metric.detail}</div>
      </div>
    </motion.div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={FADE_UP}
      whileHover={{ boxShadow: "0 12px 48px rgba(15,23,42,0.08)" }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group/panel relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white/95 to-slate-50/40 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_4px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover/panel:opacity-100" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.02) 0%, transparent 50%)" }} />
      <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3">
        <div className="flex items-center gap-2">
          {eyebrow && (
            <Badge variant="default" className="text-[9px] shadow-sm">
              {eyebrow}
            </Badge>
          )}
          <h3 className="text-[13px] font-extrabold tracking-tight text-slate-800">{title}</h3>
        </div>
        {action}
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">{children}</div>
    </motion.section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="flex-1 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100/50 px-2.5 py-1.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-slate-400">{label}</div>
      <div className="mt-0.5 text-[13px] font-black text-slate-800">
        <AnimatedValue value={value} />
      </div>
    </motion.div>
  );
}

function SortArrow({ direction }: { direction: "asc" | "desc" | null }) {
  return (
    <span className="ml-1 inline-flex flex-col text-[7px] leading-none">
      <span className={cn("transition-colors", direction === "asc" ? "text-blue-600" : "text-slate-300")}>▲</span>
      <span className={cn("-mt-[1px] transition-colors", direction === "desc" ? "text-blue-600" : "text-slate-300")}>▼</span>
    </span>
  );
}

type DetailCell = React.ReactNode | { display: React.ReactNode; sortValue?: number | string | null };

function isDetailCellObject(value: DetailCell): value is { display: React.ReactNode; sortValue?: number | string | null } {
  return typeof value === "object" && value !== null && "display" in value;
}

function getCellDisplay(value: DetailCell) {
  return isDetailCellObject(value) ? value.display : value;
}

function getCellSortValue(value: DetailCell) {
  if (isDetailCellObject(value)) {
    return value.sortValue ?? "";
  }
  return typeof value === "string" || typeof value === "number" ? value : "";
}

function DetailTable({
  columns,
  rows,
  compact,
}: {
  columns: string[];
  rows: Array<Record<string, DetailCell>>;
  compact?: boolean;
}) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const av = getCellSortValue(a[sortCol]);
      const bv = getCellSortValue(b[sortCol]);
      const aStr = typeof av === "string" ? av : typeof av === "number" ? String(av) : "";
      const bStr = typeof bv === "string" ? bv : typeof bv === "number" ? String(bv) : "";
      const aNum = parseFloat(aStr.replace(/[₹,%L\s]/g, ""));
      const bNum = parseFloat(bStr.replace(/[₹,%L\s]/g, ""));
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDir === "asc" ? aNum - bNum : bNum - aNum;
      }
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [rows, sortCol, sortDir]);

  return (
    <div className="h-full overflow-auto">
      <table className="min-w-full">
        <thead className="sticky top-0 z-10 bg-white/96 backdrop-blur-sm">
          <tr className="border-b border-slate-100">
            {columns.map((col) => (
              <th
                key={col}
                onClick={() => handleSort(col)}
                className={cn(
                  "cursor-pointer select-none text-left font-extrabold uppercase tracking-[0.15em] text-slate-400 transition-colors hover:text-slate-600",
                  compact ? "px-2 py-1.5 text-[9px]" : "px-3 py-2 text-[10px]",
                )}
              >
                <span className="inline-flex items-center">
                  {col}
                  <SortArrow direction={sortCol === col ? sortDir : null} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="popLayout">
            {sortedRows.map((row, i) => (
              <motion.tr
                key={`row-${columns.map((c) => String(getCellSortValue(row[c]))).join("-")}-${i}`}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-b border-slate-50 transition-colors hover:bg-blue-50/30 last:border-b-0"
              >
                {columns.map((col) => (
                  <td key={`${i}-${col}`} className={cn("font-semibold text-slate-700", compact ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-[12px]")}>
                    {getCellDisplay(row[col])}
                  </td>
                ))}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

function RecommendationCard({ item }: { item: Recommendation }) {
  const config = {
    Critical: { icon: AlertTriangle, variant: "critical" as const, glow: "rgba(239,68,68,0.08)" },
    Watchlist: { icon: ChevronRight, variant: "warning" as const, glow: "rgba(245,158,11,0.08)" },
    Opportunity: { icon: Sparkles, variant: "success" as const, glow: "rgba(16,185,129,0.08)" },
  }[item.severity];
  const Icon = config.icon;

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: `0 8px 28px ${config.glow}` }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/30 p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <motion.div
            whileHover={{ rotate: 5, scale: 1.1 }}
            className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/40 p-1.5 text-blue-600 shadow-sm"
          >
            <Icon className="h-3.5 w-3.5" />
          </motion.div>
          <div>
            <div className="text-[12px] font-extrabold text-slate-800">{item.title}</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{item.explanation}</div>
          </div>
        </div>
        <Badge variant={config.variant}>{item.severity}</Badge>
      </div>
      <div className="mt-2 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100/40 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
        {item.recommendedAction}
      </div>
    </motion.div>
  );
}

/* ─── Main Dashboard ─── */

export function MisDashboard({
  dataset,
  datasetId,
}: {
  dataset: MisDataset;
  datasetId?: string;
}) {
  const {
    view, setView,
    filters, setFilters, resetFilters,
    filtersOpen, toggleFilters, closeFilters,
    toggleAiChat,
  } = useDashboardStore();

  useEffect(() => {
    const defaults = buildDefaultFilters(dataset);
    if (filters.monthKeys.length === 0) {
      setFilters(defaults);
    }
  }, [dataset, filters.monthKeys.length, setFilters]);

  const model = useMemo(() => buildDashboardModel(dataset, filters), [dataset, filters]);
  const handleResetFilters = () => resetFilters(buildDefaultFilters(dataset));

  /* ─── View Layouts ─── */

  const ceoLayout = (
    <motion.div variants={STAGGER_CHILDREN} initial="hidden" animate="visible" key="ceo" className="grid h-full grid-cols-[1.4fr_1fr] grid-rows-2 gap-2.5">
      <Panel title="Monthly Revenue Trend" eyebrow="CEO" action={<span className="text-[10px] font-bold text-slate-400">Actual vs AOP vs PY</span>}>
        <div className="min-h-0 flex-1">
          <RevenueTrendChart
            actual={model.monthlyRevenue.actual}
            aop={model.monthlyRevenue.aop}
            py={model.monthlyRevenue.py}
            selectedScenarios={model.selectedScenarios}
          />
        </div>
        <div className="mt-1.5 flex shrink-0 gap-2">
          <MiniStat label="Revenue" value={formatLacs(model.revenueSummary.actual)} />
          <MiniStat label="Vs AOP" value={formatVariance(model.revenueSummary.vsAopPct)} />
          <MiniStat label="Vs PY" value={formatVariance(model.revenueSummary.vsPyPct)} />
        </div>
      </Panel>

      <Panel title="Business / Geography Split" eyebrow="CEO">
        <div className="min-h-0 flex-1">
          <GeoDonutChart
            data={model.geographySplit}
            onClick={(label) => setFilters((f) => ({ ...f, divisions: f.divisions.includes(label) ? f.divisions.filter((v) => v !== label) : [label] }))}
          />
        </div>
      </Panel>

      <Panel title="Division Contribution" eyebrow="CEO">
        <div className="min-h-0 flex-1">
          <HorizontalBarChart
            data={model.divisionContribution}
            limit={8}
            onClick={(label) => setFilters((f) => ({ ...f, types: f.types.includes(label) ? f.types.filter((v) => v !== label) : [label] }))}
          />
        </div>
      </Panel>

      <Panel title="AI Intelligence" eyebrow="AI">
        <div className="min-h-0 flex-1">
          <AiInsightsPanel view={view} filters={filters} datasetId={datasetId} />
        </div>
      </Panel>
    </motion.div>
  );

  const cfoLayout = (
    <motion.div variants={STAGGER_CHILDREN} initial="hidden" animate="visible" key="cfo" className="grid h-full grid-cols-[1.2fr_1fr] grid-rows-2 gap-2.5">
      <Panel title="Consolidated P&L Summary" eyebrow="CFO">
        <div className="min-h-0 flex-1">
          <DetailTable
            compact
            columns={["Section", "Line Item", "Actual", "AOP", "Var %"]}
            rows={model.plSummary.map((r) => ({
              Section: r.section,
              "Line Item": r.lineItem,
              Actual: formatLacs(r.actual),
              AOP: formatLacs(r.aop),
              "Var %": {
                display: <span className={cn("font-bold", r.variancePct >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatVariance(r.variancePct)}</span>,
                sortValue: r.variancePct,
              },
            }))}
          />
        </div>
      </Panel>

      <Panel title="Monthly EBIT Trend" eyebrow="CFO">
        <div className="min-h-0 flex-1">
          <ComboChart
            barData={model.monthlyMargins.ebit}
            lineData={model.monthlyMargins.ebitAop}
            barLabel="Actual EBIT %"
            lineLabel="AOP EBIT %"
            selectedScenarios={model.selectedScenarios}
          />
        </div>
      </Panel>

      <Panel title="Variance Analysis" eyebrow="CFO">
        <div className="min-h-0 flex-1">
          <DetailTable
            compact
            columns={["Line Item", "Actual", "AOP", "Variance", "Note"]}
            rows={model.varianceTable.map((r) => ({
              "Line Item": r.label,
              Actual: r.actual !== undefined ? formatLacs(r.actual) : "-",
              AOP: r.aop !== undefined ? formatLacs(r.aop) : "-",
              Variance:
                r.variancePct !== undefined
                  ? {
                      display: <span className={cn("font-bold", r.variancePct >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatVariance(r.variancePct)}</span>,
                      sortValue: r.variancePct,
                    }
                  : "-",
              Note: r.note ?? "-",
            }))}
          />
        </div>
      </Panel>

      <Panel title="Profitability Diagnostics" eyebrow="CFO">
        <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-2">
          {([
            { label: "GM1", value: formatLacs(model.gm1Summary.actual), detail: `${formatPercent((model.gm1Summary.actual / model.revenueSummary.actual) * 100)} margin`, gradient: "from-blue-50/80 to-white", shadow: "rgba(59,130,246,0.08)" },
            { label: "EBIT", value: formatLacs(model.ebitSummary.actual), detail: `${formatPercent((model.ebitSummary.actual / model.revenueSummary.actual) * 100)} margin`, gradient: "from-emerald-50/80 to-white", shadow: "rgba(16,185,129,0.08)" },
            { label: "Revenue Gap", value: formatSignedLacs(model.revenueSummary.actual - model.revenueSummary.aop), detail: "", gradient: "from-amber-50/60 to-white", shadow: "rgba(245,158,11,0.08)" },
            { label: "EBIT Gap", value: formatSignedLacs(model.ebitSummary.actual - model.ebitSummary.aop), detail: "", gradient: "from-rose-50/60 to-white", shadow: "rgba(239,68,68,0.08)" },
          ] as const).map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 25 }}
              whileHover={{ y: -2, boxShadow: `0 8px 24px ${item.shadow}` }}
              className={cn("rounded-xl bg-gradient-to-br p-3", item.gradient)}
            >
              <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-slate-400">{item.label}</div>
              <div className="mt-1.5 text-xl font-black text-slate-800">
                <AnimatedValue value={item.value} />
              </div>
              {item.detail && <div className="mt-0.5 text-[11px] font-bold text-slate-500">{item.detail}</div>}
            </motion.div>
          ))}
        </div>
      </Panel>
    </motion.div>
  );

  const chairmanLayout = (
    <motion.div variants={STAGGER_CHILDREN} initial="hidden" animate="visible" key="chairman" className="grid h-full grid-cols-[1.2fr_1fr] grid-rows-2 gap-2.5">
      <Panel title="Revenue Achievement by Division" eyebrow="Chairman">
        <div className="min-h-0 flex-1">
          <HorizontalBarChart
            data={model.achievementByDivision}
            limit={8}
            valueFormatter={(v) => formatPercent(v)}
            semanticColor={(d) =>
              d.value >= 100 ? "#10b981" : d.value >= 85 ? "#3b82f6" : "#f59e0b"
            }
          />
        </div>
      </Panel>

      <Panel title="Strategic Summary" eyebrow="Chairman">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {model.strategicSummary.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-2.5 rounded-xl bg-gradient-to-br from-emerald-50/40 to-white p-3 transition-colors hover:from-emerald-50/60"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <p className="text-[12px] font-semibold leading-relaxed text-slate-700">{line}</p>
            </motion.div>
          ))}
        </div>
      </Panel>

      <Panel title="Margin Trend" eyebrow="Chairman">
        <div className="min-h-0 flex-1">
          <MarginTrendChart gm1={model.monthlyMargins.gm1} ebit={model.monthlyMargins.ebit} />
        </div>
      </Panel>

      <Panel title="P&L Waterfall" eyebrow="Chairman">
        <div className="min-h-0 flex-1">
          <WaterfallChart data={model.waterfall} />
        </div>
      </Panel>
    </motion.div>
  );

  const layout = view === "ceo" ? ceoLayout : view === "cfo" ? cfoLayout : chairmanLayout;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[color:var(--background)] text-slate-900">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_10%_0%,rgba(59,130,246,0.08),transparent),radial-gradient(ellipse_50%_40%_at_90%_0%,rgba(6,182,212,0.06),transparent),radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(139,92,246,0.03),transparent)]" />
      <div className="animate-shimmer pointer-events-none fixed inset-0 -z-10" />

      {/* Header */}
      <header className="z-30 flex shrink-0 items-center justify-between border-b border-slate-200/50 bg-white/85 px-5 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] backdrop-blur-2xl">
        <div className="flex items-center gap-3.5">
          <motion.div
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-2 text-white shadow-lg shadow-blue-500/30"
          >
            <Building2 className="h-4 w-4" />
          </motion.div>
          <div>
            <h1 className="text-[16px] font-black tracking-tight text-slate-900">Enterprise MIS Dashboard</h1>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
              <span>Trivitron Healthcare</span>
              <span className="text-slate-200">·</span>
              <span>{dataset.meta.schemaUnderstanding.xlsxSchema.primarySheet ?? "Excel"}</span>
              <span className="text-slate-200">·</span>
              <span>{new Date(dataset.meta.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as ExecutiveView)}>
            <TabsList>
              {(Object.keys(VIEW_TITLES) as ExecutiveView[]).map((v) => (
                <TabsTrigger key={v} value={v}>{VIEW_TITLES[v]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Button variant="outline" size="sm" onClick={toggleFilters} className="gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </Button>

          <Button
            size="sm"
            onClick={toggleAiChat}
            className="gap-1.5 bg-gradient-to-r from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25"
          >
            <AiChatbotLogo className="h-3.5 w-3.5" />
            AI Chat
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex min-h-0 flex-1 flex-col gap-2.5 px-4 py-3">
        <motion.div
          variants={STAGGER_CHILDREN}
          initial="hidden"
          animate="visible"
          className="grid shrink-0 grid-cols-4 gap-2.5"
        >
          {model.metricCards.map((m, i) => (
            <MetricCard key={m.label} metric={m} index={i} />
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            className="min-h-0 flex-1"
            initial={PAGE_TRANSITION.initial}
            animate={PAGE_TRANSITION.animate}
            exit={PAGE_TRANSITION.exit}
          >
            {layout}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Filter Drawer */}
      <Sheet open={filtersOpen} onOpenChange={(open) => !open && closeFilters()}>
        <SheetContent side="left">
          <SheetHeader>
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 p-1.5 text-white shadow-sm">
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </div>
              <SheetTitle>Filters & Actions</SheetTitle>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-5 py-4">
            <div className="space-y-5">
              <FilterSection title="Month Range">
                {model.options.months.map((month) => (
                  <FilterChip
                    key={month.key}
                    active={filters.monthKeys.includes(month.key)}
                    label={month.label}
                    onClick={() => setFilters((c) => ({ ...c, monthKeys: toggleSelection(c.monthKeys, month.key) }))}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Scenario">
                {model.options.scenarios.map((s) => (
                  <FilterChip
                    key={s}
                    active={filters.scenarios.includes(s)}
                    label={s}
                    onClick={() => setFilters((c) => ({ ...c, scenarios: toggleSelection(c.scenarios, s) as MisFilters["scenarios"] }))}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Business Unit">
                {model.options.types.map((t) => (
                  <FilterChip
                    key={t}
                    active={filters.types.includes(t)}
                    label={t}
                    onClick={() => setFilters((c) => ({ ...c, types: toggleSelection(c.types, t) }))}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Geography">
                {model.options.divisions.map((d) => (
                  <FilterChip
                    key={d}
                    active={filters.divisions.includes(d)}
                    label={d}
                    onClick={() => setFilters((c) => ({ ...c, divisions: toggleSelection(c.divisions, d) }))}
                  />
                ))}
                {model.options.subDivisions.map((s) => (
                  <FilterChip
                    key={s}
                    active={filters.subDivisions.includes(s)}
                    label={s}
                    onClick={() => setFilters((c) => ({ ...c, subDivisions: toggleSelection(c.subDivisions, s) }))}
                  />
                ))}
              </FilterSection>

              <FilterSection title="Category / Line Item">
                {model.options.categories.slice(0, 8).map((cat) => (
                  <FilterChip
                    key={cat}
                    active={filters.categories.includes(cat)}
                    label={cat}
                    onClick={() => setFilters((c) => ({ ...c, categories: toggleSelection(c.categories, cat) }))}
                  />
                ))}
                {model.options.lineItems.slice(0, 10).map((li) => (
                  <FilterChip
                    key={li}
                    active={filters.lineItems.includes(li)}
                    label={li}
                    onClick={() => setFilters((c) => ({ ...c, lineItems: toggleSelection(c.lineItems, li) }))}
                  />
                ))}
              </FilterSection>

              <Button variant="outline" onClick={handleResetFilters} className="w-full">
                Reset all filters
              </Button>

              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                  Action Queue
                </div>
                {model.recommendations.slice(0, 4).map((item) => (
                  <RecommendationCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* AI Chat Panel */}
      <AiChatPanel datasetId={datasetId} />
    </div>
  );
}
