import { randomUUID } from "crypto";
import { parseExcelToDataset } from "@/lib/mis/excel-parser";
import { saveUploadedDataset } from "@/lib/mis/runtime-dataset";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
    return Response.json(
      { error: "Only .xlsx and .xls files are supported" },
      { status: 400 },
    );
  }

  const buffer = await file.arrayBuffer();
  const result = parseExcelToDataset(buffer, file.name);

  if (!result.success) {
    return Response.json(
      { error: result.error, availableSheets: result.availableSheets },
      { status: 422 },
    );
  }

  const datasetId = randomUUID();
  await saveUploadedDataset(datasetId, result.dataset);

  return Response.json({
    datasetId,
    sheetName: result.sheetName,
    factCount: result.dataset.facts.length,
    commentaryCount: result.dataset.commentary.length,
  });
}
