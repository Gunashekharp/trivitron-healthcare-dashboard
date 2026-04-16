import { loadAvailableMisDataset } from "@/lib/mis/runtime-dataset";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const datasetId = url.searchParams.get("datasetId") ?? undefined;
  const dataset = await loadAvailableMisDataset(datasetId);
  return Response.json(dataset);
}
