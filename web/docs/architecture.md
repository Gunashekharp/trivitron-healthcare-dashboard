# Trivitron MIS Dashboard Architecture

## Current Source Understanding

This first working version is based on two provided references:

- `C:\Users\Guna\Downloads\MIS_Dashboard.html`
- `C:\Users\Guna\Downloads\Trivitron_MIS_V1.pbix`

The HTML file provides the current executive layout, KPI intent, chart groupings, division ranking, commentary, margin trends, and a consolidated P&L summary. The PBIX file exposes the semantic model structure and confirms the dashboard is an MIS / financial-performance model rather than a CRM or pipeline tracker.

## PBIX Model Signals

The PBIX model exposes a primary table named `Sales Report` with fields and measures that indicate the original business grain:

- Dimensions:
  - `Date`
  - `Division`
  - `Division Group`
  - `Category`
  - `Fiscal Year`
- Financial columns:
  - `MTD Actual`
  - `MTD AOP`
  - `YTD Actual`
  - `YTD AOP`
  - `AOP (Plan)`
  - `COGS Today`
  - `COGS Month`
  - `COGS Year`
- Ratio / performance columns:
  - `MTD % Achievement`
  - `YTD % Achievement`
  - `MTD % Profit`
  - `YTD % Profit`
  - `Average Margin`
- Measures:
  - `Actual (Rs in Lakh)`
  - `Achieved %`

The PBIX also confirms that the report uses slicers such as `Type`, `Div`, and period selectors, which directly align with the requested filter architecture.

## Target Normalized Data Contract

The app centers on a normalized fact layer with these canonical fields:

- `month`
- `scenario`
- `div`
- `subDivision`
- `category`
- `lineItem`
- `type`
- `amountLacs`

The first version extends this with operational fields required for deterministic dashboarding:

- `unit`
- `periodType`
- `fiscalYear`
- `source`

## KPI Computation Plan

All KPIs are computed from normalized facts plus structured summary blocks:

- `YTD Revenue`
  - Sum `lineItem = Total Revenue`, `scenario = Actual`
- `Revenue vs AOP`
  - Compare `Actual` versus `AOP`
- `Revenue vs PY`
  - Compare `Actual` versus `PY`
- `GM1`, `GM2`, `EBIT`
  - Sum corresponding line items
- `GM1 margin`, `GM2 margin`, `EBIT margin`
  - Metric amount divided by revenue
- `Monthly revenue trend`
  - By month and scenario for `Total Revenue`
- `Monthly EBIT trend`
  - By month for `EBIT`
- `Division-wise revenue`
  - `type = Division Revenue`
- `Geography / business split`
  - `type = Geography Split`
- `Achievement %`
  - `Actual / AOP`
- `Variance analysis`
  - P&L row level actual versus plan deltas
- `Waterfall composition`
  - Revenue -> COGS -> GM1 -> Production Overheads -> GM2 -> Opex -> EBIT

## View Architecture

### CEO View

- KPI strip
- Revenue trend chart
- Division contribution chart
- Geography / business split chart
- Commentary panel
- Alerts and recommendations

### CFO View

- Consolidated P&L summary table
- EBIT trend
- Variance table
- Cost line-item analysis
- Margin diagnostics

### Chairman View

- Achievement cards
- Growth versus prior year
- Best / worst divisions
- Margin trend
- Strategic recommendation summary
- Waterfall composition

## UI and Component Architecture

### App Shell

- Sticky executive header
- Theme toggle
- View tabs
- Filter rail
- Responsive content grid

### Shared Components

- `MetricCard`
- `ChartCard`
- `FilterBar`
- `RecommendationCard`
- `DetailTable`
- `ExecutiveSection`

### Data Layer

- `lib/mis/types.ts`
- `lib/mis/dataset.ts`
- `lib/mis/engine.ts`
- `lib/mis/utils.ts`

### Ingestion Pipeline

- `scripts/build_mis_dataset.py`
  - Parses the provided HTML file into structured MIS data
  - Reads PBIX TMDL metadata to capture model signals
  - Supports a future workbook adapter through `pandas` + `openpyxl`
- `app/api/mis/route.ts`
  - Serves the processed dataset to the UI

## Folder Structure

```text
web/
  app/
    api/
      mis/
        route.ts
    globals.css
    layout.tsx
    page.tsx
  components/
    dashboard/
      mis-dashboard.tsx
    ui/
      chart.tsx
  data/
    generated/
      mis_dataset.json
  docs/
    architecture.md
  lib/
    mis/
      dataset.ts
      engine.ts
      types.ts
      utils.ts
  scripts/
    build_mis_dataset.py
  requirements.txt
```

## First-Version Delivery Notes

This version is production-oriented in structure, styling, and deterministic KPI calculation, but it is constrained by the currently available source assets:

- The PBIX file provides semantic-model metadata, not an easy row-level export.
- The HTML provides enough structured values to build a fully functioning first MIS dashboard.
- The Python pipeline is already prepared to switch to workbook ingestion once the original Excel source is supplied.
