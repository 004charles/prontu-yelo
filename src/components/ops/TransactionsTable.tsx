import { ArrowUpDown, Search, CheckCircle2, XCircle, Download, CreditCard, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { fmtAOA } from "@/lib/types";
import type { DateFilter } from "@/lib/ops-store";

export interface TransactionRow {
  payment: {
    id: string;
    prontu_payment_id: string;
    reference: string;
    customer_name: string;
    customer_contact: string;
    amount: number;
    currency: string;
    paid_at: string;
  } | null;
  order: {
    yelo_order_id: string;
    reference: string;
    payment_ref: string;
    status: string;
    created_at: string;
    raw?: any;
  } | null;
  matched: boolean;
  matchType?: "exact" | "fuzzy" | "none";
  matchReason?: string;
  side?: "payment" | "order"; // "payment" = has Prontu payment; "order" = orphan Yelo order
}

const MATCH_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "matched", label: "✓ Com pedido" },
  { key: "unmatched", label: "✗ Sem pedido" },
] as const;

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "all", label: "Todos" },
];

interface Props {
  rows: TransactionRow[];
  loading: boolean;
  dateFilter: DateFilter;
  onDateFilterChange: (f: DateFilter) => void;
}

export function TransactionsTable({ rows, loading, dateFilter, onDateFilterChange }: Props) {
  const [matchFilter, setMatchFilter] = useState<"all" | "matched" | "unmatched">("all");
  const [q, setQ] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        if (matchFilter === "matched" && !r.matched) return false;
        if (matchFilter === "unmatched" && r.matched) return false;
        if (!q) return true;
        const needle = q.toLowerCase();
        const inPayment = r.payment
          ? r.payment.customer_name.toLowerCase().includes(needle) ||
            r.payment.prontu_payment_id.toLowerCase().includes(needle) ||
            r.payment.reference.toLowerCase().includes(needle) ||
            r.payment.customer_contact.toLowerCase().includes(needle)
          : false;
        const inOrder = r.order
          ? r.order.yelo_order_id.toLowerCase().includes(needle) ||
            r.order.reference.toLowerCase().includes(needle)
          : false;
        return inPayment || inOrder;
      })
      .sort((a, b) => {
        const dateA = a.payment?.paid_at || a.order?.created_at || "";
        const dateB = b.payment?.paid_at || b.order?.created_at || "";
        const diff = new Date(dateA).getTime() - new Date(dateB).getTime();
        return sortAsc ? diff : -diff;
      });
  }, [rows, matchFilter, q, sortAsc]);

  const totalValue = filtered.reduce(
    (sum, r) => sum + Number(r.payment?.amount || r.order?.raw?.total_amount || 0),
    0,
  );
  const matchedCount = filtered.filter((r) => r.matched).length;
  const unmatchedCount = filtered.filter((r) => !r.matched).length;

  function exportCsv() {
    const headers = [
      "Data/Hora",
      "Tipo",
      "Cliente",
      "Contacto",
      "Valor (AOA)",
      "ID Prontu",
      "Referência Prontu",
      "ID Yelo",
      "Status Pedido",
      "Correspondência",
      "Detalhes de Correspondência",
    ];
    const csvRows = filtered.map((r) => [
      new Date(r.payment?.paid_at || r.order?.created_at || "").toLocaleString("pt-PT"),
      r.side === "order" ? "Pedido Yelo" : "Pagamento Prontu",
      r.payment?.customer_name ?? r.order?.raw?.customer_username ?? "—",
      r.payment?.customer_contact ?? r.order?.raw?.job_pickup_phone ?? "—",
      r.payment?.amount ?? r.order?.raw?.total_amount ?? "—",
      r.payment?.prontu_payment_id ?? "—",
      r.payment?.reference ?? "—",
      r.order?.yelo_order_id ?? "—",
      r.order?.status ?? "—",
      r.matched ? "OK" : r.side === "order" ? "Sem pagamento" : "Sem pedido",
      r.matched ? (r.matchType === "exact" ? "Exata (ID/Ref)" : `Aproximada (${r.matchReason})`) : "Nenhuma",
    ]);
    const csv = [headers, ...csvRows].map((row) => row.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      className="rounded-lg bg-card ring-1 ring-border/60 overflow-hidden"
      style={{ boxShadow: "var(--shadow-panel)" }}
    >
      {/* Header */}
      <header className="px-4 py-3 border-b border-border/60 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <h2 className="text-sm font-semibold">Transações</h2>
          <span className="text-xs text-muted-foreground font-mono">
            {filtered.length} {filtered.length === 1 ? "registo" : "registos"}
          </span>
          {totalValue > 0 && (
            <span className="text-xs text-muted-foreground font-mono">
              · {fmtAOA(totalValue)}
            </span>
          )}
        </div>

        {/* Summary chips */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/15 text-success ring-1 ring-success/20">
              <CheckCircle2 className="size-3" />
              {matchedCount} OK
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-critical/15 text-critical ring-1 ring-critical/20">
              <XCircle className="size-3" />
              {unmatchedCount} anomalia
            </span>
          </div>
        )}

        {/* Date filter */}
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1 ring-1 ring-border/40 ml-auto">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.key}
              id={`tx-date-filter-${f.key}`}
              onClick={() => onDateFilterChange(f.key)}
              className={`text-xs px-3 py-1 rounded-md transition-all font-medium ${
                dateFilter === f.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Match filter */}
        <div className="flex items-center gap-1">
          {MATCH_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setMatchFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                matchFilter === f.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-56">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cliente, ID, ref…"
            className="h-8 pl-8 text-xs bg-surface-2 border-border/60"
          />
        </div>

        {/* Export */}
        <button
          onClick={exportCsv}
          title="Exportar CSV"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border border-border/40"
        >
          <Download className="size-3.5" />
          CSV
        </button>
      </header>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  Data/Hora
                  <ArrowUpDown className="size-3" />
                </button>
              </Th>
              <Th>Tipo</Th>
              <Th>Cliente</Th>
              <Th>Pagamento (Prontu)</Th>
              <Th>Pedido (Yelo)</Th>
              <Th className="text-right">Valor</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    A carregar transações…
                  </span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma transação encontrada para este período.
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <TxRow key={row.payment?.prontu_payment_id || row.order?.yelo_order_id || i} row={row} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TxRow({ row }: { row: TransactionRow }) {
  const { payment, order, matched, side, matchType, matchReason } = row;
  const date = payment?.paid_at || order?.created_at || "";
  const isOrphanOrder = side === "order"; // Yelo order without Prontu payment

  return (
    <tr className="border-t border-border/40 hover:bg-accent/30 transition-colors">
      {/* Date */}
      <Td>
        <div className="font-mono text-xs tabular-nums">
          {date ? new Date(date).toLocaleDateString("pt-PT") : "—"}
        </div>
        <div className="text-[11px] text-muted-foreground font-mono">
          {date
            ? new Date(date).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
            : ""}
        </div>
      </Td>

      {/* Type */}
      <Td>
        {isOrphanOrder ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning ring-1 ring-warning/20 font-medium">
            <Package className="size-3" />
            Pedido Yelo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary ring-1 ring-primary/20 font-medium">
            <CreditCard className="size-3" />
            Pagamento
          </span>
        )}
      </Td>

      {/* Customer */}
      <Td>
        {payment ? (
          <>
            <div className="font-medium">{payment.customer_name}</div>
            <div className="text-xs text-muted-foreground">{payment.customer_contact}</div>
            {order?.raw?.customer_username && order.raw.customer_username.trim().toLowerCase() !== payment.customer_name.trim().toLowerCase() && (
              <div className="text-[10px] text-muted-foreground mt-0.5 italic">
                No Yelo: {order.raw.customer_username}
              </div>
            )}
          </>
        ) : order?.raw?.customer_username ? (
          <>
            <div className="font-medium">{order.raw.customer_username}</div>
            <div className="text-xs text-muted-foreground">
              {order.raw.job_pickup_phone || "—"}
            </div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground italic">— sem pagamento</span>
        )}
      </Td>

      {/* Prontu Payment */}
      <Td>
        {payment ? (
          <>
            <div className="font-mono text-xs">{payment.prontu_payment_id.slice(0, 16)}…</div>
            <div className="text-[11px] text-muted-foreground">
              ref {payment.reference.slice(0, 20)}
            </div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
      </Td>

      {/* Yelo Order */}
      <Td>
        {order ? (
          <>
            <div className="font-mono text-xs">{order.yelo_order_id}</div>
            <div className="text-[11px] text-success">{order.status}</div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
      </Td>

      {/* Value */}
      <Td className="text-right font-mono tabular-nums">
        {payment
          ? fmtAOA(Number(payment.amount))
          : order?.raw?.total_amount
            ? fmtAOA(Number(order.raw.total_amount))
            : "—"}
      </Td>

      {/* Status */}
      <Td>
        {matched ? (
          matchType === "exact" ? (
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCircle2 className="size-3.5" />
                OK (Exata)
              </span>
            </div>
          ) : (
            <div>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm"
                title={matchReason}
              >
                <CheckCircle2 className="size-3.5" />
                Aproximada
              </span>
              {matchReason && (
                <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[150px] leading-tight font-mono">
                  {matchReason}
                </div>
              )}
            </div>
          )
        ) : isOrphanOrder ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning">
            <XCircle className="size-3.5" />
            Sem pagamento
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-critical">
            <XCircle className="size-3.5" />
            Sem pedido
          </span>
        )}
      </Td>
    </tr>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left font-medium px-4 py-2.5 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
