import dataset from "@/data/generated/mis_dataset.json";
import type { MisDataset } from "@/lib/mis/types";

export function getMisDataset(): MisDataset {
  return dataset as MisDataset;
}
