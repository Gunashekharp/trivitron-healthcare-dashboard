export const COLORS = {
  brand: "#3b82f6",
  brandLight: "#93bbfd",
  success: "#10b981",
  successLight: "#6ee7b7",
  warning: "#f59e0b",
  warningLight: "#fcd34d",
  danger: "#ef4444",
  dangerLight: "#fca5a5",
  cyan: "#06b6d4",
  violet: "#8b5cf6",
  text: "#0f172a",
  muted: "#64748b",
  grid: "rgba(148,163,184,0.10)",
  surface: "#ffffff",
} as const;

export const PALETTE = [
  COLORS.brand,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.cyan,
  COLORS.violet,
];

export const CHART_MARGIN = { top: 24, right: 16, bottom: 40, left: 56 };
export const BAR_CHART_MARGIN = { top: 8, right: 64, bottom: 8, left: 100 };
