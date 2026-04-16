from __future__ import annotations

import argparse
import json
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd


PRIMARY_FACT_SHEET = "Updated skeleton"
COMMENTS_SHEET = "Comments"
PRODUCT_SHEET = "Product Wise"


@dataclass
class SourceInputs:
    html_path: Path | None
    pbix_path: Path | None
    xlsx_path: Path | None
    output_path: Path


def parse_args() -> SourceInputs:
    parser = argparse.ArgumentParser(description="Build Trivitron MIS dataset JSON.")
    parser.add_argument("--html", help="Optional HTML reference path")
    parser.add_argument("--pbix", help="Optional Power BI PBIX reference")
    parser.add_argument("--xlsx", help="Workbook source path")
    parser.add_argument("--out", required=True, help="Output path for generated JSON dataset")
    args = parser.parse_args()
    return SourceInputs(
        html_path=Path(args.html) if args.html else None,
        pbix_path=Path(args.pbix) if args.pbix else None,
        xlsx_path=Path(args.xlsx) if args.xlsx else None,
        output_path=Path(args.out),
    )


def clean_text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    if isinstance(value, float) and pd.isna(value):
        return fallback
    text = str(value).strip()
    return text if text and text.lower() != "nan" else fallback


def month_label(value: Any) -> str:
    timestamp = pd.to_datetime(value, errors="coerce")
    if pd.isna(timestamp):
        return clean_text(value)
    return timestamp.strftime("%b %Y")


def month_key(value: Any) -> str:
    timestamp = pd.to_datetime(value, errors="coerce")
    if pd.isna(timestamp):
        return clean_text(value)
    return timestamp.strftime("%Y-%m")


def fiscal_year_for_month(value: Any) -> str:
    timestamp = pd.to_datetime(value, errors="coerce")
    if pd.isna(timestamp):
        return "Unknown"
    start_year = timestamp.year if timestamp.month >= 4 else timestamp.year - 1
    return f"FY{start_year}-{str(start_year + 1)[-2:]}"


def parse_pbix_model(pbix_path: Path | None) -> dict[str, Any]:
    if not pbix_path or not pbix_path.exists():
        return {
            "tableName": None,
            "columns": [],
            "measures": [],
            "pages": [],
            "dataSourceMode": None,
        }

    with zipfile.ZipFile(pbix_path) as archive:
        tmdl = archive.read("TMDLScripts/Script%201.tmdl").decode("utf-16")
        layout = archive.read("Report/Layout").decode("utf-16")

    table_names = re.findall(r"^\s*table '([^']+)'", tmdl, re.MULTILINE)
    columns = re.findall(r"^\s*column '([^']+)'", tmdl, re.MULTILINE)
    columns += re.findall(r"^\s*column ([A-Za-z][A-Za-z0-9 %]+)$", tmdl, re.MULTILINE)
    measures = re.findall(r"^\s*measure '([^']+)'", tmdl, re.MULTILINE)
    pages = sorted(set(re.findall(r'"displayName":"([^"]+)"', layout)))
    data_source_mode = "Power BI Dataflow" if "PowerPlatform.Dataflows" in tmdl else "Unknown"

    return {
        "tableName": table_names[0] if table_names else None,
        "columns": sorted(set(column.strip() for column in columns if column.strip())),
        "measures": sorted(set(measure.strip() for measure in measures if measure.strip())),
        "pages": pages,
        "dataSourceMode": data_source_mode,
    }


def load_xlsx_frames(xlsx_path: Path) -> dict[str, pd.DataFrame]:
    workbook = pd.ExcelFile(xlsx_path)
    frames = {
        sheet_name: workbook.parse(sheet_name)
        for sheet_name in workbook.sheet_names
    }
    return frames


def parse_xlsx_schema(xlsx_path: Path | None) -> dict[str, Any]:
    if not xlsx_path or not xlsx_path.exists():
        return {"available": False, "sheets": [], "columns": []}

    workbook = pd.ExcelFile(xlsx_path)
    sheet_summaries = []
    all_columns: set[str] = set()
    for sheet_name in workbook.sheet_names:
        frame = workbook.parse(sheet_name, nrows=25)
        columns = [str(column) for column in frame.columns]
        all_columns.update(columns)
        sheet_summaries.append({"name": sheet_name, "columns": columns})

    schema: dict[str, Any] = {
        "available": True,
        "sheets": sheet_summaries,
        "columns": sorted(all_columns),
        "primarySheet": PRIMARY_FACT_SHEET if PRIMARY_FACT_SHEET in workbook.sheet_names else None,
    }

    if PRIMARY_FACT_SHEET in workbook.sheet_names:
        fact_df = workbook.parse(PRIMARY_FACT_SHEET)
        schema["profile"] = {
            "scenarios": sorted(fact_df["Scenario"].dropna().astype(str).unique().tolist()),
            "types": sorted(fact_df["Type"].dropna().astype(str).unique().tolist()),
            "divisions": sorted(fact_df["Div"].dropna().astype(str).unique().tolist()),
            "subDivisions": sorted(fact_df["SubDivision"].dropna().astype(str).unique().tolist()),
            "categories": sorted(fact_df["Category"].dropna().astype(str).unique().tolist()),
            "lineItems": sorted(fact_df["LineItem"].dropna().astype(str).unique().tolist()),
        }

    return schema


def build_facts(fact_df: pd.DataFrame) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []
    for row in fact_df.to_dict(orient="records"):
        amount = pd.to_numeric(row.get("Amount_Lacs"), errors="coerce")
        facts.append(
            {
                "month": month_label(row.get("Month")),
                "monthKey": month_key(row.get("Month")),
                "scenario": clean_text(row.get("Scenario")),
                "div": clean_text(row.get("Div")),
                "subDivision": clean_text(row.get("SubDivision")),
                "category": clean_text(row.get("Category")),
                "lineItem": clean_text(row.get("LineItem")),
                "type": clean_text(row.get("Type")),
                "unit": "lacs",
                "periodType": "MTD",
                "fiscalYear": fiscal_year_for_month(row.get("Month")),
                "amountLacs": round(float(amount), 4) if pd.notna(amount) else 0.0,
                "source": "xlsx",
            }
        )
    return facts


def build_commentary(comment_df: pd.DataFrame) -> list[dict[str, Any]]:
    comments: list[dict[str, Any]] = []
    expected_columns = list(comment_df.columns)
    if len(expected_columns) < 5:
        return comments

    type_column, div_column, sub_division_column, category_column, comment_column = expected_columns[:5]

    normalized = comment_df.rename(
        columns={
            type_column: "Type",
            div_column: "Div",
            sub_division_column: "SubDivision",
            category_column: "Category",
            comment_column: "Comments",
        }
    )

    normalized = normalized.dropna(how="all")
    normalized = normalized[normalized["Comments"].notna()]

    for index, row in enumerate(normalized.to_dict(orient="records"), start=1):
        comments.append(
            {
                "id": f"comment-{index}",
                "type": clean_text(row.get("Type")),
                "div": clean_text(row.get("Div")),
                "subDivision": clean_text(row.get("SubDivision")),
                "category": clean_text(row.get("Category")),
                "comment": clean_text(row.get("Comments")),
                "source": "xlsx",
            }
        )
    return comments


def build_pl_summary(fact_df: pd.DataFrame) -> list[dict[str, Any]]:
    scenario_summary = (
        fact_df.groupby(["Scenario", "Category", "LineItem"], dropna=False)["Amount_Lacs"]
        .sum()
        .reset_index()
    )

    def line_total(scenario: str, category: str, line_item: str) -> float:
        mask = (
            (scenario_summary["Scenario"] == scenario)
            & (scenario_summary["Category"] == category)
            & (scenario_summary["LineItem"] == line_item)
        )
        values = scenario_summary.loc[mask, "Amount_Lacs"]
        return round(float(values.iloc[0]), 2) if not values.empty else 0.0

    def category_total(scenario: str, category: str) -> float:
        mask = (
            (scenario_summary["Scenario"] == scenario)
            & (scenario_summary["Category"] == category)
        )
        return round(float(scenario_summary.loc[mask, "Amount_Lacs"].sum()), 2)

    def add_detail_rows(section: str, category_names: list[str], rows: list[dict[str, Any]]) -> None:
        subset = scenario_summary[scenario_summary["Category"].isin(category_names)]
        for line_item in sorted(subset["LineItem"].dropna().astype(str).unique().tolist()):
            actual = round(float(subset[(subset["Scenario"] == "Actual") & (subset["LineItem"] == line_item)]["Amount_Lacs"].sum()), 2)
            aop = round(float(subset[(subset["Scenario"] == "AOP") & (subset["LineItem"] == line_item)]["Amount_Lacs"].sum()), 2)
            if actual == 0 and aop == 0:
                continue
            variance_pct = round(((actual - aop) / aop) * 100, 2) if aop else 0
            rows.append(
                {
                    "section": section,
                    "lineItem": line_item,
                    "actual": actual,
                    "aop": aop,
                    "varianceDisplay": f"{variance_pct:+.1f}%",
                    "variancePct": variance_pct,
                    "rowType": "detail",
                }
            )

    rows: list[dict[str, Any]] = []
    add_detail_rows("Revenue", ["Sales"], rows)
    rows.append(
        total_row(
            "Revenue",
            "Total Revenue",
            category_total("Actual", "Sales"),
            category_total("AOP", "Sales"),
        )
    )

    add_detail_rows("COGS1", ["COGS1"], rows)
    rows.append(
        total_row(
            "COGS1",
            "GM1",
            category_total("Actual", "Sales") - category_total("Actual", "COGS1"),
            category_total("AOP", "Sales") - category_total("AOP", "COGS1"),
        )
    )

    add_detail_rows("COGS2", ["COGS2"], rows)
    rows.append(
        total_row(
            "COGS2",
            "GM2",
            category_total("Actual", "Sales")
            - category_total("Actual", "COGS1")
            - category_total("Actual", "COGS2"),
            category_total("AOP", "Sales")
            - category_total("AOP", "COGS1")
            - category_total("AOP", "COGS2"),
        )
    )

    add_detail_rows("Operating Expenses", ["Opex Exp1", "Opex Exp2", "Opex Exp3"], rows)
    rows.append(
        total_row(
            "Operating Expenses",
            "EBIT",
            category_total("Actual", "Sales")
            - category_total("Actual", "COGS1")
            - category_total("Actual", "COGS2")
            - category_total("Actual", "Opex Exp1")
            - category_total("Actual", "Opex Exp2")
            - category_total("Actual", "Opex Exp3"),
            category_total("AOP", "Sales")
            - category_total("AOP", "COGS1")
            - category_total("AOP", "COGS2")
            - category_total("AOP", "Opex Exp1")
            - category_total("AOP", "Opex Exp2")
            - category_total("AOP", "Opex Exp3"),
        )
    )
    return rows


def total_row(section: str, label: str, actual: float, aop: float) -> dict[str, Any]:
    variance_pct = round(((actual - aop) / aop) * 100, 2) if aop else 0
    return {
        "section": section,
        "lineItem": label,
        "actual": round(actual, 2),
        "aop": round(aop, 2),
        "varianceDisplay": f"{variance_pct:+.1f}%",
        "variancePct": variance_pct,
        "rowType": "total",
    }


def build_data_quality(facts: list[dict[str, Any]]) -> dict[str, Any]:
    zero_value_rows = sum(1 for fact in facts if fact["amountLacs"] == 0)
    blank_dimension_rows = sum(
        1
        for fact in facts
        if not fact["type"] or not fact["div"] or not fact["subDivision"] or not fact["category"] or not fact["lineItem"]
    )
    return {
        "totalFactRows": len(facts),
        "zeroValueRows": zero_value_rows,
        "blankDimensionRows": blank_dimension_rows,
    }


def build_dataset(inputs: SourceInputs) -> dict[str, Any]:
    if not inputs.xlsx_path or not inputs.xlsx_path.exists():
        raise FileNotFoundError("Workbook source is required for the Excel-driven dataset build.")

    frames = load_xlsx_frames(inputs.xlsx_path)
    if PRIMARY_FACT_SHEET not in frames:
        raise ValueError(f"Required sheet '{PRIMARY_FACT_SHEET}' not found in workbook.")

    fact_df = frames[PRIMARY_FACT_SHEET].copy()
    comment_df = frames.get(COMMENTS_SHEET, pd.DataFrame())

    pbix_model = parse_pbix_model(inputs.pbix_path)
    xlsx_schema = parse_xlsx_schema(inputs.xlsx_path)
    facts = build_facts(fact_df)
    comments = build_commentary(comment_df) if not comment_df.empty else []
    pl_rows = build_pl_summary(fact_df)
    data_quality = build_data_quality(facts)

    dataset = {
        "meta": {
            "title": "Trivitron Healthcare Executive MIS",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "sourceFiles": {
                "html": str(inputs.html_path) if inputs.html_path else None,
                "pbix": str(inputs.pbix_path) if inputs.pbix_path else None,
                "xlsx": str(inputs.xlsx_path),
            },
            "sourceMode": "xlsx-primary-with-pbix-reference",
            "limitations": [
                "The dashboard is now driven by the Excel extract in the Updated skeleton sheet.",
                "PBIX is retained as a semantic-reference source for field validation and report alignment.",
            ],
            "schemaUnderstanding": {
                "requestedCoreFields": [
                    "Month",
                    "Scenario",
                    "Div",
                    "SubDivision",
                    "LineItem",
                    "Category",
                    "Type",
                    "AmountLacs",
                ],
                "pbixModel": pbix_model,
                "xlsxSchema": xlsx_schema,
            },
            "dataQuality": data_quality,
        },
        "facts": facts,
        "commentary": comments,
        "plSummary": pl_rows,
    }
    return dataset


def main() -> None:
    inputs = parse_args()
    inputs.output_path.parent.mkdir(parents=True, exist_ok=True)
    dataset = build_dataset(inputs)
    inputs.output_path.write_text(json.dumps(dataset, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
