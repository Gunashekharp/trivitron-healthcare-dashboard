import { z } from "zod";
import { publicProcedure, router } from "../server";
import { loadAvailableMisDataset } from "@/lib/mis/runtime-dataset";

export const uploadsRouter = router({
  getDataset: publicProcedure
    .input(z.object({ datasetId: z.string() }))
    .query(async ({ input }) => {
      return loadAvailableMisDataset(input.datasetId);
    }),
});
