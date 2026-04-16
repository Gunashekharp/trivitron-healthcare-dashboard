"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  ArrowRight,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MisDashboard } from "@/components/dashboard/mis-dashboard";
import { parseExcelToDataset } from "@/lib/mis/excel-parser";
import type { MisDataset } from "@/lib/mis/types";
import { cn } from "@/lib/mis/utils";

type Stage = "idle" | "parsing" | "success" | "error" | "dashboard";

interface UploadState {
  stage: Stage;
  dataset: MisDataset | null;
  datasetId: string | undefined;
  fileName: string;
  sheetName: string;
  factCount: number;
  error: string;
  dragOver: boolean;
}

const initialState: UploadState = {
  stage: "idle",
  dataset: null,
  datasetId: undefined,
  fileName: "",
  sheetName: "",
  factCount: 0,
  error: "",
  dragOver: false,
};

export function UploadLanding() {
  const [state, setState] = useState<UploadState>(initialState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setState((s) => ({
        ...s,
        stage: "error",
        error: "Please upload an Excel file (.xlsx or .xls)",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      stage: "parsing",
      fileName: file.name,
      error: "",
    }));

    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelToDataset(buffer, file.name);

      if (!result.success) {
        setState((s) => ({ ...s, stage: "error", error: result.error }));
        return;
      }

      // Also persist to server in the background
      let datasetId: string | undefined;
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        if (res.ok) {
          const json = await res.json();
          datasetId = json.datasetId;
        }
      } catch {
        // server persistence is optional; client-parsed data is sufficient
      }

      setState((s) => ({
        ...s,
        stage: "success",
        dataset: result.dataset,
        datasetId,
        sheetName: result.sheetName,
        factCount: result.dataset.facts.length,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        stage: "error",
        error:
          err instanceof Error
            ? err.message
            : "Failed to parse the Excel file. Please check the format.",
      }));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setState((s) => ({ ...s, dragOver: false }));
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile],
  );

  const handleReset = useCallback(() => {
    setState(initialState);
  }, []);

  const handleLaunchDashboard = useCallback(() => {
    setState((s) => ({ ...s, stage: "dashboard" }));
  }, []);

  if (state.stage === "dashboard" && state.dataset) {
    return <MisDashboard dataset={state.dataset} datasetId={state.datasetId} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--background)] text-slate-900">
      {/* Ambient background — same as dashboard */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_10%_0%,rgba(59,130,246,0.08),transparent),radial-gradient(ellipse_50%_40%_at_90%_0%,rgba(6,182,212,0.06),transparent),radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(139,92,246,0.03),transparent)]" />
      <div className="animate-shimmer pointer-events-none fixed inset-0 -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 px-6"
      >
        {/* Logo / brand */}
        <div className="flex flex-col items-center gap-3">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
            className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-3.5 text-white shadow-lg shadow-blue-500/30"
          >
            <Building2 className="h-7 w-7" />
          </motion.div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Enterprise MIS Dashboard
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Trivitron Healthcare — Upload your MIS workbook to begin
            </p>
          </div>
        </div>

        {/* Upload zone */}
        <AnimatePresence mode="wait">
          {(state.stage === "idle" || state.stage === "error") && (
            <motion.div
              key="upload-zone"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setState((s) => ({ ...s, dragOver: true }));
                }}
                onDragLeave={() => setState((s) => ({ ...s, dragOver: false }))}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "group relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300",
                  state.dragOver
                    ? "border-blue-400 bg-blue-50/60 shadow-[0_0_40px_rgba(59,130,246,0.12)]"
                    : "border-slate-200/80 bg-white/60 hover:border-blue-300/60 hover:bg-blue-50/30 hover:shadow-[0_4px_24px_rgba(59,130,246,0.06)]",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <motion.div
                  animate={state.dragOver ? { scale: 1.08, y: -4 } : { scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div
                    className={cn(
                      "rounded-xl p-3 transition-colors duration-300",
                      state.dragOver
                        ? "bg-blue-100 text-blue-600"
                        : "bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500",
                    )}
                  >
                    <Upload className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      Drop your Excel file here, or{" "}
                      <span className="text-blue-600">browse</span>
                    </p>
                    <p className="mt-1.5 text-xs font-medium text-slate-400">
                      Supports .xlsx and .xls — expects columns: Month, Scenario, Div,
                      SubDivision, Category, LineItem, Type, Amount_Lacs
                    </p>
                  </div>
                </motion.div>
              </div>

              {state.stage === "error" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-rose-700">{state.error}</p>
                    {state.fileName && (
                      <p className="mt-0.5 text-[11px] text-rose-500">
                        File: {state.fileName}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="text-rose-400 hover:text-rose-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {state.stage === "parsing" && (
            <motion.div
              key="parsing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex w-full flex-col items-center gap-4 rounded-2xl border border-blue-200/50 bg-blue-50/40 p-10"
            >
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">
                  Processing {state.fileName}...
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Parsing sheets, building dataset, validating columns
                </p>
              </div>
            </motion.div>
          )}

          {state.stage === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-white p-8"
            >
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600"
                >
                  <CheckCircle2 className="h-7 w-7" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-800">
                    Workbook processed successfully
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{state.fileName}</p>
                </div>

                {/* Stats row */}
                <div className="flex w-full gap-3">
                  <StatChip label="Sheet" value={state.sheetName} />
                  <StatChip label="Fact Rows" value={String(state.factCount)} />
                  <StatChip
                    label="Commentary"
                    value={String(state.dataset?.commentary.length ?? 0)}
                  />
                </div>

                <div className="flex w-full gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    Upload different file
                  </Button>
                  <Button
                    onClick={handleLaunchDashboard}
                    className="flex-1 gap-2 bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
                  >
                    Launch Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expected format hint */}
        {(state.stage === "idle" || state.stage === "error") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="w-full rounded-xl border border-slate-100 bg-white/70 p-4"
          >
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Expected Workbook Format
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5">
              {[
                { col: "Month", desc: "Date or month label" },
                { col: "Scenario", desc: "Actual / AOP / PY" },
                { col: "Div", desc: "Division / Geography" },
                { col: "SubDivision", desc: "Sub-division" },
                { col: "Category", desc: "Sales, COGS1, COGS2, Opex..." },
                { col: "LineItem", desc: "Account detail" },
                { col: "Type", desc: "Business unit" },
                { col: "Amount_Lacs", desc: "Value in Lakhs" },
              ].map((item) => (
                <div key={item.col} className="flex items-baseline gap-1.5">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-600">
                    {item.col}
                  </code>
                  <span className="text-[11px] text-slate-400">{item.desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Primary sheet: <span className="font-semibold">&quot;Updated skeleton&quot;</span> — or any sheet
              with these columns will be detected automatically.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-center">
      <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-black text-slate-800">{value}</div>
    </div>
  );
}
