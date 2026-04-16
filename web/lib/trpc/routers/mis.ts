import { z } from "zod";

import { buildDashboardModel, buildDefaultFilters } from "@/lib/mis/engine";
import { loadAvailableMisDataset } from "@/lib/mis/runtime-dataset";
import type { MisFilters, Scenario } from "@/lib/mis/types";
import { publicProcedure, router } from "../server";

const filtersSchema = z.object({
  monthKeys: z.array(z.string()),
  scenarios: z.array(z.string()),
  types: z.array(z.string()),
  divisions: z.array(z.string()),
  subDivisions: z.array(z.string()),
  categories: z.array(z.string()),
  lineItems: z.array(z.string()),
});

export const misRouter = router({
  getDataset: publicProcedure
    .input(z.object({ datasetId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return loadAvailableMisDataset(input?.datasetId);
    }),

  getDefaultFilters: publicProcedure
    .input(z.object({ datasetId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const dataset = await loadAvailableMisDataset(input?.datasetId);
      return buildDefaultFilters(dataset);
    }),

  getDashboardModel: publicProcedure
    .input(
      z.object({
        datasetId: z.string().optional(),
        filters: filtersSchema,
      }),
    )
    .query(async ({ input }) => {
      const dataset = await loadAvailableMisDataset(input.datasetId);
      const filters: MisFilters = {
        ...input.filters,
        scenarios: input.filters.scenarios as Scenario[],
      };
      return buildDashboardModel(dataset, filters);
    }),
});
