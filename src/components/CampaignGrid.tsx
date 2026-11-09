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

// Colours come from the app palette (globals.css) so the grid follows light and dark mode.
const STATUS_COLOR: Record<string, string> = {
  draft: "var(--muted)",
  agreed: "var(--accent)",
  funded: "var(--hold)",
  awaiting_post: "var(--hold)",
  live_checking: "var(--ok)",
  partially_released: "var(--ok)",
  fix_window: "var(--warn)",
  disputed: "var(--warn)",
  released: "var(--ok)",
  refunded: "var(--bad)",
  closed: "var(--muted)",
};
const VERDICT_COLOR = { pass: "var(--ok)", fail: "var(--bad)", needs_review: "var(--warn)" } as const;

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-5"
    >
      {text}
    </span>
  );
}

const isTotals = (p: ICellRendererParams<GridRow>) => Boolean(p.node.rowPinned);
const StatusCell = (p: ICellRendererParams<GridRow, DealStatus>) => (isTotals(p) || !p.value ? null : <Chip text={statusLabel(p.value)} color={STATUS_COLOR[p.value] ?? "var(--muted)"} />);
const VerdictCell = (p: ICellRendererParams<GridRow, GridRow["verdict"]>) =>
  isTotals(p) ? null : p.value ? <Chip text={{ pass: "Pass", fail: "Fail", needs_review: "Review" }[p.value]} color={VERDICT_COLOR[p.value]} /> : <span className="text-xs opacity-50">—</span>;
const BoolCell = (p: ICellRendererParams<GridRow, boolean | null>) =>
  isTotals(p) ? null : p.value == null ? <span className="text-xs opacity-50">—</span> : p.value ? <span style={{ color: "var(--ok)" }}>✓</span> : <span style={{ color: "var(--bad)" }}>✕</span>;
const TitleCell = (p: ICellRendererParams<GridRow, string>) =>
  isTotals(p) ? (
    <span className="font-semibold">{p.value}</span>
  ) : (
    <a href={`/deals/${p.data?.id}`} className="font-medium underline-offset-2 hover:underline" style={{ color: "inherit" }}>
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
      { field: "price", headerName: "Creator fee", valueFormatter: money, width: 120, type: "rightAligned" },
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
        accentColor: "var(--accent)",
        backgroundColor: "var(--card)",
        foregroundColor: "var(--foreground)",
        borderColor: "var(--border)",
        headerBackgroundColor: "var(--background)",
        headerTextColor: "var(--muted)",
        rowHoverColor: "color-mix(in srgb, var(--accent) 6%, transparent)",
        borderRadius: 10,
        wrapperBorderRadius: 12,
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
        <span className="ml-auto text-xs text-muted">Sort by any column; filter Status and Last verdict from the header menus.</span>
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
