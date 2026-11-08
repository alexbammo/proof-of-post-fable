"use client";

import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams, type ValueFormatterParams } from "ag-grid-community";
import type { DealStatus } from "@/lib/db/schema";
import { statusLabel } from "./StatusChip";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface GridRow {
  id: string;
  title: string;
  creator: string;
  platform: string;
  status: DealStatus;
  price: number;
  fee: number;
  paid: number;
  held: number;
  released: number;
  refunded: number;
  verdict: "pass" | "fail" | "needs_review" | null;
  confidence: number | null;
  disclosure: boolean | null;
  live: boolean | null;
  postBy: string;
  stayUpDays: number;
  lastCheck: string | null;
  created: string;
}

const money = (p: ValueFormatterParams<GridRow, number>) => (p.value == null ? "" : p.value.toLocaleString("en-US", { style: "currency", currency: "USD" }));

const STATUS_COLOR: Record<string, string> = {
  draft: "#6b7280",
  agreed: "#0b5fff",
  funded: "#6d4ed8",
  awaiting_post: "#6d4ed8",
  live_checking: "#118a4e",
  partially_released: "#118a4e",
  fix_window: "#b7791f",
  disputed: "#b7791f",
  released: "#118a4e",
  refunded: "#c2362f",
  closed: "#6b7280",
};

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ background: color + "1a", color, border: `1px solid ${color}55` }} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-5">
      {text}
    </span>
  );
}

const StatusCell = (p: ICellRendererParams<GridRow, DealStatus>) => (p.value ? <Chip text={statusLabel(p.value)} color={STATUS_COLOR[p.value] ?? "#6b7280"} /> : null);
const VerdictCell = (p: ICellRendererParams<GridRow, GridRow["verdict"]>) =>
  p.value ? <Chip text={{ pass: "Pass", fail: "Fail", needs_review: "Review" }[p.value]} color={{ pass: "#118a4e", fail: "#c2362f", needs_review: "#b7791f" }[p.value]} /> : <span className="text-xs opacity-50">—</span>;
const BoolCell = (p: ICellRendererParams<GridRow, boolean | null>) => (p.value == null ? <span className="text-xs opacity-50">—</span> : p.value ? <span style={{ color: "#118a4e" }}>✓</span> : <span style={{ color: "#c2362f" }}>✕</span>);
const TitleCell = (p: ICellRendererParams<GridRow, string>) => (
  <a href={`/deals/${p.data?.id}`} className="underline-offset-2 hover:underline" style={{ color: "inherit" }}>
    {p.value}
  </a>
);

export function CampaignGrid({ rows }: { rows: GridRow[] }) {
  const [quick, setQuick] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const data = useMemo(() => (onlyFlagged ? rows.filter((r) => r.status === "fix_window" || r.verdict === "needs_review" || r.verdict === "fail") : rows), [rows, onlyFlagged]);

  const cols = useMemo<ColDef<GridRow>[]>(
    () => [
      { field: "title", headerName: "Deal", cellRenderer: TitleCell, minWidth: 220, flex: 2, pinned: "left" },
      { field: "creator", headerName: "Creator", minWidth: 130, flex: 1 },
      { field: "platform", headerName: "Platform", width: 110, valueFormatter: (p) => ({ youtube: "YouTube", twitch: "Twitch", bluesky: "Bluesky", manual: "Manual" })[p.value as string] ?? p.value },
      { field: "status", headerName: "Status", cellRenderer: StatusCell, width: 150, filter: true },
      { field: "verdict", headerName: "Last verdict", cellRenderer: VerdictCell, width: 130, filter: true },
      { field: "disclosure", headerName: "#ad", cellRenderer: BoolCell, width: 80, cellClass: "text-center" },
      { field: "live", headerName: "Live", cellRenderer: BoolCell, width: 80, cellClass: "text-center" },
      { field: "price", headerName: "Creator fee", valueFormatter: money, width: 120, type: "rightAligned", aggFunc: "sum" },
      { field: "fee", headerName: "Platform fee", valueFormatter: money, width: 120, type: "rightAligned" },
      { field: "paid", headerName: "Paid in", valueFormatter: money, width: 110, type: "rightAligned" },
      { field: "held", headerName: "Held", valueFormatter: money, width: 110, type: "rightAligned" },
      { field: "released", headerName: "Released", valueFormatter: money, width: 110, type: "rightAligned" },
      { field: "refunded", headerName: "Refunded", valueFormatter: money, width: 110, type: "rightAligned" },
      { field: "confidence", headerName: "Confidence", width: 110, valueFormatter: (p) => (p.value == null ? "" : `${Math.round((p.value as number) * 100)}%`), type: "rightAligned" },
      { field: "postBy", headerName: "Post by", width: 110 },
      { field: "stayUpDays", headerName: "Stay up", width: 90, valueFormatter: (p) => `${p.value}d`, type: "rightAligned" },
      { field: "lastCheck", headerName: "Last check", width: 160, valueFormatter: (p) => (p.value ? new Date(p.value as string).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "") },
      { field: "created", headerName: "Created", width: 110, valueFormatter: (p) => new Date(p.value as string).toLocaleDateString("en-GB"), sort: "desc" },
    ],
    [],
  );

  const totals = useMemo(() => {
    const t = data.reduce((a, r) => ({ price: a.price + r.price, fee: a.fee + r.fee, paid: a.paid + r.paid, held: a.held + r.held, released: a.released + r.released, refunded: a.refunded + r.refunded }), { price: 0, fee: 0, paid: 0, held: 0, released: 0, refunded: 0 });
    return [{ id: "total", title: `Totals (${data.length})`, creator: "", platform: "", status: "closed" as DealStatus, ...t, verdict: null, confidence: null, disclosure: null, live: null, postBy: "", stayUpDays: 0, lastCheck: null, created: "" } as GridRow];
  }, [data]);

  const theme = useMemo(
    () =>
      themeQuartz.withParams({
        accentColor: "#0b5fff",
        borderRadius: 10,
        wrapperBorderRadius: 16,
        fontFamily: "inherit",
        headerFontWeight: 600,
      }),
    [],
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-3 px-2 pb-3">
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Search deals, creators…" className="input max-w-xs" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Flagged only
        </label>
        <span className="ml-auto text-xs text-muted">Click a column header to sort, use the filter menus to slice by status or verdict.</span>
      </div>
      <div style={{ height: Math.min(640, 120 + Math.max(rows.length, 3) * 44) }}>
        <AgGridReact<GridRow>
          theme={theme}
          rowData={data}
          columnDefs={cols}
          defaultColDef={{ sortable: true, resizable: true, filter: false }}
          quickFilterText={quick}
          pinnedBottomRowData={totals}
          animateRows
          getRowId={(p) => p.data.id}
          rowHeight={44}
          headerHeight={40}
          suppressCellFocus
        />
      </div>
    </div>
  );
}
