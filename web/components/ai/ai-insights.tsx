"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Radar,
  ShieldAlert,
  CalendarRange,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
  Zap,
  Shield,
  Eye,
  Clock,
  BarChart3,
  Lightbulb,
} from "lucide-react";
import { AiChatbotLogo } from "@/components/icons/ai-chatbot-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatLacs } from "@/lib/mis/utils";
import type { ExecutiveView, MisFilters } from "@/lib/mis/types";

interface AiInsightsProps {
  view: ExecutiveView;
  filters: MisFilters;
  datasetId?: string;
}

interface Anomaly {
  severity: "Critical" | "Warning" | "Info";
  title: string;
  dimension: string;
  detail: string;
  action: string;
  impactLacs?: number;
  confidence?: number;
  trend?: "worsening" | "stable" | "improving";
}

interface ForecastRisk {
  risk: string;
  probability: "Low" | "Medium" | "High";
  impact: "Low" | "Medium" | "High";
}

interface Forecast {
  nextQuarterRevenue: { low: number; base: number; high: number };
  aopAchievementProbability: number;
  forecastConfidence?: number;
  marginOutlook: string;
  marginTrend?: "expanding" | "stable" | "compressing";
  keyRisks: ForecastRisk[] | string[];
  scenarios: { best: string; base: string; stress: string };
  topActions?: string[];
}

type SourceState = "ai" | "rule-based" | "";

const VIEW_LABELS: Record<ExecutiveView, string> = {
  ceo: "CEO",
  cfo: "CFO",
  chairman: "Chairman",
};

const VIEW_DESCRIPTIONS: Record<ExecutiveView, string> = {
  ceo: "Growth & market positioning",
  cfo: "Financial control & margins",
  chairman: "Strategic governance",
};

function parseCommentary(commentary: string) {
  if (!commentary) return [];
  return commentary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\*\*/g, ""))
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function extractLabel(item: string): { label: string; body: string } {
  const clean = item.replace(/\*+/g, "").trim();
  const colonIdx = clean.indexOf(":");
  if (colonIdx > 0 && colonIdx < 40) {
    return {
      label: clean.slice(0, colonIdx).trim(),
      body: clean.slice(colonIdx + 1).trim(),
    };
  }
  return { label: "", body: clean };
}

function summarizeFilterScope(filters: MisFilters) {
  const parts = [`${filters.monthKeys.length}mo`, `${filters.scenarios.length} scn`];
  if (filters.types.length > 0) parts.push(`${filters.types.length} BU`);
  if (filters.divisions.length > 0) parts.push(`${filters.divisions.length} geo`);
  if (filters.subDivisions.length > 0) parts.push(`${filters.subDivisions.length} sub`);
  if (filters.categories.length > 0) parts.push(`${filters.categories.length} cat`);
  if (filters.lineItems.length > 0) parts.push(`${filters.lineItems.length} items`);
  return parts.join(" · ");
}

function SourceBadge({ source }: { source: SourceState }) {
  if (!source) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
        source === "ai"
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-slate-500/10 text-slate-500",
      )}
    >
      <div
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          source === "ai" ? "bg-emerald-500 animate-pulse" : "bg-slate-400",
        )}
      />
      {source === "ai" ? "Live AI" : "Built-in"}
    </div>
  );
}

function ConfidenceMeter({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const segments = 5;
  const filled = Math.round((value / 100) * segments);
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full transition-all",
              size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
              i < filled ? color : "bg-slate-200",
            )}
          />
        ))}
      </div>
      <span className="text-[9px] font-bold tabular-nums text-slate-400">{value}%</span>
    </div>
  );
}

function TrendIndicator({ trend }: { trend?: "worsening" | "stable" | "improving" | "expanding" | "compressing" }) {
  if (!trend) return null;

  const config = {
    worsening: { icon: ArrowDownRight, color: "text-rose-500", label: "Worsening" },
    stable: { icon: Minus, color: "text-slate-400", label: "Stable" },
    improving: { icon: ArrowUpRight, color: "text-emerald-500", label: "Improving" },
    expanding: { icon: ArrowUpRight, color: "text-emerald-500", label: "Expanding" },
    compressing: { icon: ArrowDownRight, color: "text-rose-500", label: "Compressing" },
  };

  const { icon: Icon, color, label } = config[trend];

  return (
    <div className={cn("flex items-center gap-1 text-[9px] font-bold", color)}>
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}

function ImpactBar({ value, maxValue }: { value: number; maxValue: number }) {
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="min-w-[50px] text-right text-[10px] font-bold tabular-nums text-slate-600">
        {formatLacs(value)}
      </span>
    </div>
  );
}

function ProbabilityDot({ level }: { level: "Low" | "Medium" | "High" }) {
  const color = level === "High" ? "bg-rose-500" : level === "Medium" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-1">
      <div className={cn("h-1.5 w-1.5 rounded-full", color)} />
      <span className="text-[9px] font-semibold text-slate-500">{level}</span>
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-violet-500">
        <div className="relative">
          <Loader2 className="h-4 w-4 animate-spin" />
          <div className="absolute inset-0 animate-ping opacity-20">
            <Loader2 className="h-4 w-4" />
          </div>
        </div>
        {label}
      </div>
      <div className="space-y-2.5">
        {[0, 1, 2].map((index) => (
          <div key={index} className="overflow-hidden rounded-xl border border-slate-100/80 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-100" style={{ animationDelay: `${index * 150}ms` }} />
                <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-50" style={{ animationDelay: `${index * 150 + 50}ms` }} />
                <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-50" style={{ animationDelay: `${index * 150 + 100}ms` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const LABEL_ICONS: Record<string, typeof Brain> = {
  "Revenue Gap": TrendingDown,
  "Margin Alert": AlertTriangle,
  "Margin Conversion": BarChart3,
  "Growth Signal": TrendingUp,
  "Portfolio Spread": Target,
  "Momentum Signal": Activity,
  "Priority Action": Zap,
  "Stability": Shield,
  "90-Day Focus": Eye,
};

function getInsightIcon(label: string) {
  for (const [key, Icon] of Object.entries(LABEL_ICONS)) {
    if (label.toLowerCase().includes(key.toLowerCase())) return Icon;
  }
  return ArrowRight;
}

export function AiInsightsPanel({ view, filters, datasetId }: AiInsightsProps) {
  const [commentary, setCommentary] = useState<string>("");
  const [commentarySource, setCommentarySource] = useState<SourceState>("");
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [anomaliesSource, setAnomaliesSource] = useState<SourceState>("");
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [forecastSource, setForecastSource] = useState<SourceState>("");
  const [loading, setLoading] = useState({ commentary: false, anomalies: false, forecast: false });
  const [activeTab, setActiveTab] = useState<"commentary" | "anomalies" | "forecast">("commentary");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchCommentary = useCallback(async () => {
    setLoading((s) => ({ ...s, commentary: true }));
    try {
      const res = await fetch("/api/ai/commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view, filters, datasetId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCommentary(data.commentary ?? "");
      setCommentarySource(data.source ?? "");
      setLastRefresh(new Date());
    } catch {
      setCommentary("Failed to generate commentary.");
      setCommentarySource("");
    } finally {
      setLoading((s) => ({ ...s, commentary: false }));
    }
  }, [datasetId, view, filters]);

  const fetchAnomalies = useCallback(async () => {
    setLoading((s) => ({ ...s, anomalies: true }));
    try {
      const res = await fetch("/api/ai/anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, datasetId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAnomalies(data.anomalies ?? []);
      setAnomaliesSource(data.source ?? "");
      setLastRefresh(new Date());
    } catch {
      setAnomalies([]);
      setAnomaliesSource("");
    } finally {
      setLoading((s) => ({ ...s, anomalies: false }));
    }
  }, [datasetId, filters]);

  const fetchForecast = useCallback(async () => {
    setLoading((s) => ({ ...s, forecast: true }));
    try {
      const res = await fetch("/api/ai/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, datasetId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setForecast(data.forecast ?? null);
      setForecastSource(data.source ?? "");
      setLastRefresh(new Date());
    } catch {
      setForecast(null);
      setForecastSource("");
    } finally {
      setLoading((s) => ({ ...s, forecast: false }));
    }
  }, [datasetId, filters]);

  useEffect(() => {
    fetchCommentary();
  }, [fetchCommentary]);

  const tabs = [
    { id: "commentary" as const, label: "Commentary", icon: Brain, hint: "Narrative view", color: "violet" },
    { id: "anomalies" as const, label: "Anomalies", icon: Radar, hint: "Risk scan", color: "rose" },
    { id: "forecast" as const, label: "Forecast", icon: TrendingUp, hint: "Forward outlook", color: "blue" },
  ];

  const severityConfig = {
    Critical: { color: "rose", icon: ShieldAlert, bgClass: "bg-rose-50 border-rose-200/60", textClass: "text-rose-700", iconBg: "bg-rose-100 text-rose-600" },
    Warning: { color: "amber", icon: AlertTriangle, bgClass: "bg-amber-50 border-amber-200/60", textClass: "text-amber-700", iconBg: "bg-amber-100 text-amber-600" },
    Info: { color: "blue", icon: ChevronRight, bgClass: "bg-blue-50 border-blue-200/60", textClass: "text-blue-700", iconBg: "bg-blue-100 text-blue-600" },
  };

  const commentaryItems = useMemo(() => parseCommentary(commentary), [commentary]);
  const scopeSummary = useMemo(() => summarizeFilterScope(filters), [filters]);
  const anomalyCounts = useMemo(
    () => ({
      Critical: anomalies.filter((item) => item.severity === "Critical").length,
      Warning: anomalies.filter((item) => item.severity === "Warning").length,
      Info: anomalies.filter((item) => item.severity === "Info").length,
    }),
    [anomalies],
  );
  const maxImpact = useMemo(
    () => Math.max(1, ...anomalies.map((a) => a.impactLacs ?? 0)),
    [anomalies],
  );
  const currentSource =
    activeTab === "commentary"
      ? commentarySource
      : activeTab === "anomalies"
        ? anomaliesSource
        : forecastSource;
  const currentLoading =
    activeTab === "commentary"
      ? loading.commentary
      : activeTab === "anomalies"
        ? loading.anomalies
        : loading.forecast;

  return (
    <Card className="flex h-full flex-col overflow-hidden border-0 bg-gradient-to-b from-white to-slate-50/50 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_32px_rgba(15,23,42,0.06)]">
      {/* Header */}
      <CardHeader className="gap-3 border-b border-slate-100/80 bg-gradient-to-br from-violet-50/50 via-white to-slate-50/30 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 p-2 text-white shadow-lg shadow-violet-500/20">
                <AiChatbotLogo className="h-4 w-4" />
              </div>
              <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-[13px] font-extrabold tracking-tight text-slate-900">
                AI Intelligence
              </CardTitle>
              <div className="mt-0.5 flex items-center gap-2">
                <SourceBadge source={currentSource} />
                {lastRefresh && (
                  <span className="flex items-center gap-1 text-[9px] font-medium text-slate-400">
                    <Clock className="h-2.5 w-2.5" />
                    {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (activeTab === "commentary") fetchCommentary();
              else if (activeTab === "anomalies") fetchAnomalies();
              else fetchForecast();
            }}
            className="h-7 gap-1 rounded-lg border border-slate-200/80 bg-white px-2 text-[10px] font-bold text-slate-600 shadow-sm hover:bg-slate-50 hover:shadow"
            disabled={currentLoading}
          >
            <RefreshCw className={cn("h-3 w-3", currentLoading && "animate-spin")} />
            {currentLoading ? "Analyzing" : "Refresh"}
          </Button>
        </div>

        {/* Lens + Scope badges */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-bold text-white">
            <Eye className="h-2.5 w-2.5" />
            {VIEW_LABELS[view]}
          </div>
          <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
            {VIEW_DESCRIPTIONS[view]}
          </div>
          <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold tabular-nums text-slate-500">
            {scopeSummary}
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === "anomalies" && anomalies.length === 0 && !loading.anomalies) fetchAnomalies();
                  if (tab.id === "forecast" && !forecast && !loading.forecast) fetchForecast();
                }}
                className={cn(
                  "group relative rounded-xl border px-2.5 py-2 text-left transition-all duration-200",
                  isActive
                    ? "border-violet-200/80 bg-white shadow-[0_2px_12px_rgba(124,58,237,0.08)]"
                    : "border-transparent bg-transparent hover:bg-white/60",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-x-0 -bottom-[1px] mx-auto h-0.5 w-8 rounded-full bg-violet-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "rounded-lg p-1 transition-colors",
                      isActive
                        ? tab.color === "rose"
                          ? "bg-rose-100 text-rose-600"
                          : tab.color === "blue"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-violet-100 text-violet-600"
                        : "bg-slate-100/60 text-slate-400 group-hover:text-slate-500",
                    )}
                  >
                    <tab.icon className="h-3 w-3" />
                  </div>
                  <div className="min-w-0">
                    <div className={cn(
                      "text-[10px] font-bold leading-tight",
                      isActive ? "text-slate-800" : "text-slate-500",
                    )}>
                      {tab.label}
                    </div>
                    <div className="text-[9px] font-medium text-slate-400">{tab.hint}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-3 pb-4 pt-3">
          <AnimatePresence mode="wait">
            {/* ── COMMENTARY TAB ────────────────────────────── */}
            {activeTab === "commentary" && (
              <motion.div
                key="commentary"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-2.5"
              >
                {loading.commentary ? (
                  <LoadingPanel label="Generating executive commentary..." />
                ) : commentaryItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8">
                    <div className="rounded-xl bg-violet-50 p-3">
                      <Brain className="h-5 w-5 text-violet-400" />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-slate-700">Ready to analyze</div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Commentary will appear here after analysis is generated.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Executive Takeaways header */}
                    <div className="relative overflow-hidden rounded-xl border border-violet-100/80 bg-gradient-to-br from-violet-50/60 via-white to-purple-50/30 p-3.5">
                      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-violet-100/30 blur-2xl" />
                      <div className="relative">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-violet-600">
                            <div className="rounded-lg bg-violet-100 p-1">
                              <Brain className="h-3 w-3" />
                            </div>
                            Executive Takeaways
                          </div>
                          <div className="flex items-center gap-1 rounded-full bg-violet-100/60 px-2 py-0.5 text-[9px] font-bold text-violet-600">
                            <Sparkles className="h-2.5 w-2.5" />
                            {commentaryItems.length} insights
                          </div>
                        </div>
                        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                          Prioritized narrative for the {VIEW_LABELS[view]} view, optimized for quick board-level scanning.
                        </p>
                      </div>
                    </div>

                    {/* Commentary cards */}
                    <div className="space-y-1.5">
                      {commentaryItems.map((item, index) => {
                        const { label, body } = extractLabel(item);
                        const InsightIcon = label ? getInsightIcon(label) : ArrowRight;
                        return (
                          <motion.div
                            key={`${item.slice(0, 30)}-${index}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.06, duration: 0.25 }}
                            className="group rounded-xl border border-slate-100/80 bg-white p-3 transition-all hover:border-slate-200/80 hover:shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="mt-0.5 rounded-lg bg-violet-50 p-1.5 text-violet-500 transition-colors group-hover:bg-violet-100 group-hover:text-violet-600">
                                <InsightIcon className="h-3 w-3" />
                              </div>
                              <div className="min-w-0 flex-1">
                                {label && (
                                  <div className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-600">
                                    {label}
                                  </div>
                                )}
                                <p className="text-[11px] leading-[1.6] text-slate-600">
                                  {body || item}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ── ANOMALIES TAB ────────────────────────────── */}
            {activeTab === "anomalies" && (
              <motion.div
                key="anomalies"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-2.5"
              >
                {loading.anomalies ? (
                  <LoadingPanel label="Scanning for anomalies and risk signals..." />
                ) : (
                  <>
                    {/* Severity summary strip */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { label: "Critical", count: anomalyCounts.Critical, color: "rose", icon: ShieldAlert },
                        { label: "Warning", count: anomalyCounts.Warning, color: "amber", icon: AlertTriangle },
                        { label: "Info", count: anomalyCounts.Info, color: "slate", icon: ChevronRight },
                      ] as const).map((item) => (
                        <div
                          key={item.label}
                          className={cn(
                            "rounded-xl border p-2.5 text-center transition-all",
                            item.count > 0
                              ? item.color === "rose"
                                ? "border-rose-200/60 bg-rose-50/50"
                                : item.color === "amber"
                                  ? "border-amber-200/60 bg-amber-50/50"
                                  : "border-slate-200/60 bg-slate-50/50"
                              : "border-slate-100 bg-white",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "mx-auto h-3.5 w-3.5",
                              item.count > 0
                                ? item.color === "rose"
                                  ? "text-rose-500"
                                  : item.color === "amber"
                                    ? "text-amber-500"
                                    : "text-slate-400"
                                : "text-slate-300",
                            )}
                          />
                          <div className={cn(
                            "mt-1 text-lg font-black tabular-nums",
                            item.count > 0 ? "text-slate-800" : "text-slate-300",
                          )}>
                            {item.count}
                          </div>
                          <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {anomalies.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/30 px-4 py-8">
                        <div className="rounded-xl bg-emerald-100 p-3">
                          <Shield className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-slate-700">All clear</div>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                            No material anomalies detected. Refresh after changing filters to rescan.
                          </p>
                        </div>
                      </div>
                    ) : (
                      anomalies.map((a, i) => {
                        const config = severityConfig[a.severity] ?? severityConfig.Info;
                        const Icon = config.icon;
                        return (
                          <motion.div
                            key={`${a.title}-${i}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.25 }}
                            className={cn(
                              "overflow-hidden rounded-xl border bg-white transition-all hover:shadow-[0_2px_8px_rgba(15,23,42,0.04)]",
                              a.severity === "Critical"
                                ? "border-rose-200/50"
                                : a.severity === "Warning"
                                  ? "border-amber-200/50"
                                  : "border-slate-100/80",
                            )}
                          >
                            {/* Severity accent line */}
                            <div
                              className={cn(
                                "h-0.5",
                                a.severity === "Critical"
                                  ? "bg-gradient-to-r from-rose-500 to-rose-300"
                                  : a.severity === "Warning"
                                    ? "bg-gradient-to-r from-amber-500 to-amber-300"
                                    : "bg-gradient-to-r from-blue-400 to-blue-200",
                              )}
                            />
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-start gap-2">
                                  <div className={cn("mt-0.5 rounded-lg p-1.5", config.iconBg)}>
                                    <Icon className="h-3 w-3" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-bold text-slate-800">{a.title}</div>
                                    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                      {a.dimension}
                                    </div>
                                  </div>
                                </div>
                                <Badge variant={
                                  a.severity === "Critical" ? "critical" : a.severity === "Warning" ? "warning" : "default"
                                }>
                                  {a.severity}
                                </Badge>
                              </div>

                              <p className="mt-2 text-[10px] leading-[1.6] text-slate-500">{a.detail}</p>

                              {/* Impact + Confidence + Trend row */}
                              {(a.impactLacs || a.confidence || a.trend) && (
                                <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50/70 px-2.5 py-1.5">
                                  {a.impactLacs != null && a.impactLacs > 0 && (
                                    <div className="flex items-center gap-1">
                                      <BarChart3 className="h-2.5 w-2.5 text-slate-400" />
                                      <span className="text-[9px] font-bold text-slate-500">
                                        Impact: {formatLacs(a.impactLacs)}
                                      </span>
                                    </div>
                                  )}
                                  {a.confidence != null && (
                                    <ConfidenceMeter value={a.confidence} />
                                  )}
                                  {a.trend && <TrendIndicator trend={a.trend} />}
                                </div>
                              )}

                              {/* Impact bar */}
                              {a.impactLacs != null && a.impactLacs > 0 && (
                                <div className="mt-2">
                                  <ImpactBar value={a.impactLacs} maxValue={maxImpact} />
                                </div>
                              )}

                              {/* Action */}
                              <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2">
                                <div className="flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                                  <Zap className="h-2.5 w-2.5" />
                                  Recommended Action
                                </div>
                                <div className="mt-1 text-[10px] font-medium leading-[1.6] text-slate-600">
                                  {a.action}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* ── FORECAST TAB ────────────────────────────── */}
            {activeTab === "forecast" && (
              <motion.div
                key="forecast"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-2.5"
              >
                {loading.forecast ? (
                  <LoadingPanel label="Building forward outlook..." />
                ) : !forecast ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8">
                    <div className="rounded-xl bg-blue-50 p-3">
                      <TrendingUp className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-slate-700">Forecast ready</div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Generate a forecast to see range, risks, and scenario planning.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* AOP Achievement probability hero */}
                    <div className="relative overflow-hidden rounded-xl border border-blue-100/80 bg-gradient-to-br from-blue-50/80 via-violet-50/40 to-white p-4">
                      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-100/20 blur-2xl" />
                      <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                              AOP Achievement
                            </div>
                            <div className="mt-1 flex items-baseline gap-1.5">
                              <span className="text-3xl font-black tabular-nums tracking-tight text-slate-900">
                                {forecast.aopAchievementProbability}
                              </span>
                              <span className="text-sm font-bold text-slate-400">%</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge
                              variant={
                                forecast.aopAchievementProbability >= 80
                                  ? "success"
                                  : forecast.aopAchievementProbability >= 60
                                    ? "warning"
                                    : "critical"
                              }
                            >
                              {forecast.aopAchievementProbability >= 80
                                ? "On track"
                                : forecast.aopAchievementProbability >= 60
                                  ? "Needs push"
                                  : "At risk"}
                            </Badge>
                            {forecast.forecastConfidence != null && (
                              <ConfidenceMeter value={forecast.forecastConfidence} size="md" />
                            )}
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80 shadow-inner">
                          <motion.div
                            className={cn(
                              "h-full rounded-full",
                              forecast.aopAchievementProbability >= 80
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                                : forecast.aopAchievementProbability >= 60
                                  ? "bg-gradient-to-r from-amber-500 to-amber-400"
                                  : "bg-gradient-to-r from-rose-500 to-rose-400",
                            )}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.max(6, Math.min(100, forecast.aopAchievementProbability))}%`,
                            }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Revenue range */}
                    <div className="rounded-xl border border-slate-100/80 bg-white p-3">
                      <div className="mb-2.5 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                        <BarChart3 className="h-3 w-3" />
                        Next Quarter Revenue Range
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          { k: "low" as const, label: "Downside", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
                          { k: "base" as const, label: "Base case", color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-100" },
                          { k: "high" as const, label: "Upside", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                        ] as const).map((item) => (
                          <div key={item.k} className={cn("rounded-lg border p-2.5 text-center", item.border, item.bg)}>
                            <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                              {item.label}
                            </div>
                            <div className={cn("mt-1 text-sm font-black tabular-nums", item.color)}>
                              {formatLacs(forecast.nextQuarterRevenue[item.k])}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Visual range bar */}
                      <div className="mt-2.5 px-1">
                        <div className="relative h-1.5 rounded-full bg-slate-100">
                          <motion.div
                            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-rose-300 via-violet-400 to-emerald-400"
                            style={{ left: "15%", right: "15%" }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-500 shadow-sm" />
                        </div>
                        <div className="mt-1 flex justify-between text-[8px] font-medium text-slate-400">
                          <span>Low</span>
                          <span>Base</span>
                          <span>High</span>
                        </div>
                      </div>
                    </div>

                    {/* Margin Outlook */}
                    <div className="rounded-xl border border-slate-100/80 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                          <CalendarRange className="h-3 w-3" />
                          Margin Outlook
                        </div>
                        {forecast.marginTrend && (
                          <TrendIndicator trend={forecast.marginTrend} />
                        )}
                      </div>
                      <p className="mt-2 text-[10px] leading-[1.6] text-slate-600">{forecast.marginOutlook}</p>
                    </div>

                    {/* Key Risks */}
                    {forecast.keyRisks.length > 0 && (
                      <div className="rounded-xl border border-slate-100/80 bg-white p-3">
                        <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                          <AlertTriangle className="h-3 w-3" />
                          Key Risks
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {forecast.keyRisks.map((riskItem, i) => {
                            const isStructured = typeof riskItem === "object" && "risk" in riskItem;
                            const riskText = isStructured ? (riskItem as ForecastRisk).risk : riskItem as string;
                            return (
                              <div key={`risk-${i}`} className="flex items-start gap-2 rounded-lg bg-slate-50/80 px-2.5 py-2">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] leading-[1.5] text-slate-600">{riskText}</div>
                                  {isStructured && (
                                    <div className="mt-1 flex items-center gap-3">
                                      <div className="flex items-center gap-1 text-[8px] font-bold uppercase text-slate-400">
                                        Prob: <ProbabilityDot level={(riskItem as ForecastRisk).probability} />
                                      </div>
                                      <div className="flex items-center gap-1 text-[8px] font-bold uppercase text-slate-400">
                                        Impact: <ProbabilityDot level={(riskItem as ForecastRisk).impact} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Top Actions */}
                    {forecast.topActions && forecast.topActions.length > 0 && (
                      <div className="rounded-xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/30 to-white p-3">
                        <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-600">
                          <Lightbulb className="h-3 w-3" />
                          Recommended Actions
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {forecast.topActions.map((action, i) => (
                            <div key={`action-${i}`} className="flex items-start gap-2">
                              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[8px] font-bold text-emerald-600">
                                {i + 1}
                              </div>
                              <div className="text-[10px] leading-[1.5] text-slate-600">{action}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scenarios */}
                    <div className="space-y-1.5">
                      {([
                        { label: "Best case", value: forecast.scenarios.best, icon: TrendingUp, color: "emerald", border: "border-emerald-100/60" },
                        { label: "Base case", value: forecast.scenarios.base, icon: Target, color: "violet", border: "border-violet-100/60" },
                        { label: "Stress case", value: forecast.scenarios.stress, icon: TrendingDown, color: "rose", border: "border-rose-100/60" },
                      ] as const).map((scenario) => (
                        <div key={scenario.label} className={cn("rounded-xl border bg-white p-3", scenario.border)}>
                          <div className="flex items-center gap-1.5">
                            <div className={cn(
                              "rounded-md p-1",
                              scenario.color === "emerald" ? "bg-emerald-50 text-emerald-500" :
                              scenario.color === "violet" ? "bg-violet-50 text-violet-500" :
                              "bg-rose-50 text-rose-500",
                            )}>
                              <scenario.icon className="h-2.5 w-2.5" />
                            </div>
                            <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                              {scenario.label}
                            </div>
                          </div>
                          <p className="mt-1.5 text-[10px] leading-[1.6] text-slate-600">{scenario.value}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
