import { promises as fs } from "fs";
import path from "path";
import type { MisDataset } from "./types";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const DEFAULT_DATASET_PATH = path.join(process.cwd(), "data", "generated", "mis_dataset.json");

export async function loadAvailableMisDataset(
  datasetId?: string,
): Promise<MisDataset> {
  if (datasetId) {
    const uploadPath = path.join(UPLOADS_DIR, datasetId, "processed.json");
    try {
      const raw = await fs.readFile(uploadPath, "utf-8");
      return JSON.parse(raw) as MisDataset;
    } catch {
      // fall through to default
    }
  }

  const raw = await fs.readFile(DEFAULT_DATASET_PATH, "utf-8");
  return JSON.parse(raw) as MisDataset;
}

export async function saveUploadedDataset(
  datasetId: string,
  dataset: MisDataset,
): Promise<void> {
  const dir = path.join(UPLOADS_DIR, datasetId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "processed.json"),
    JSON.stringify(dataset),
    "utf-8",
  );
}
