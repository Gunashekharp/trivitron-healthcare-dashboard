import { create } from "zustand";
import type { ExecutiveView, MisFilters, Scenario } from "./mis/types";

interface DashboardState {
  view: ExecutiveView;
  setView: (view: ExecutiveView) => void;

  filters: MisFilters;
  setFilters: (filters: MisFilters | ((prev: MisFilters) => MisFilters)) => void;
  resetFilters: (defaults: MisFilters) => void;

  filtersOpen: boolean;
  toggleFilters: () => void;
  closeFilters: () => void;

  aiChatOpen: boolean;
  toggleAiChat: () => void;
  closeAiChat: () => void;

  aiInsightsOpen: boolean;
  toggleAiInsights: () => void;

  selectedDivision: string | null;
  setSelectedDivision: (div: string | null) => void;
}

const defaultFilters: MisFilters = {
  monthKeys: [],
  scenarios: ["Actual", "AOP", "PY"] as Scenario[],
  types: [],
  divisions: [],
  subDivisions: [],
  categories: [],
  lineItems: [],
};

export const useDashboardStore = create<DashboardState>((set) => ({
  view: "ceo",
  setView: (view) => set({ view }),

  filters: defaultFilters,
  setFilters: (filtersOrFn) =>
    set((state) => ({
      filters:
        typeof filtersOrFn === "function"
          ? filtersOrFn(state.filters)
          : filtersOrFn,
    })),
  resetFilters: (defaults) => set({ filters: defaults }),

  filtersOpen: false,
  toggleFilters: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
  closeFilters: () => set({ filtersOpen: false }),

  aiChatOpen: false,
  toggleAiChat: () => set((s) => ({ aiChatOpen: !s.aiChatOpen })),
  closeAiChat: () => set({ aiChatOpen: false }),

  aiInsightsOpen: false,
  toggleAiInsights: () => set((s) => ({ aiInsightsOpen: !s.aiInsightsOpen })),

  selectedDivision: null,
  setSelectedDivision: (div) => set({ selectedDivision: div }),
}));
