import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { OpsShell } from "../components/ops/OpsShell";
import { TransactionsTable, type TransactionRow } from "../components/ops/TransactionsTable";
import { useOpsStore, type DateFilter } from "../lib/ops-store";
import { getTransactionsServer } from "../lib/incidents.functions";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/transactions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Transações · Sala OPS · Tupuca" },
      {
        name: "description",
        content: "Vista unificada de todos os pagamentos Prontu e pedidos Yelo. Ver correspondências e anomalias.",
      },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const navigate = useNavigate();
  const { jwt, initialize } = useOpsStore();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // Auth gate
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate({ to: "/auth" });
      } else {
        initialize(session.access_token);
      }
    });
  }, [navigate]);

  const fetchRows = useCallback(
    async (filter: DateFilter) => {
      if (!jwt) return;
      setLoading(true);
      try {
        let since: string | undefined;
        if (filter === "today") since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
        else if (filter === "7d")
          since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        else if (filter === "30d")
          since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const result = await getTransactionsServer({ data: { jwt, since } });
        setRows(result.rows as TransactionRow[]);
      } catch (err) {
        console.error("Error fetching transactions:", err);
      } finally {
        setLoading(false);
      }
    },
    [jwt],
  );

  useEffect(() => {
    if (jwt) {
      fetchRows(dateFilter);
    }
  }, [jwt, fetchRows, dateFilter]);

  const handleDateFilterChange = (f: DateFilter) => {
    setDateFilter(f);
    fetchRows(f);
  };

  const matched = rows.filter((r) => r.matched).length;
  const unmatched = rows.filter((r) => !r.matched).length;

  return (
    <OpsShell>
      <div className="bg-grid border-b border-border/40">
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                Operations Floor
              </div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">Transações</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Vista unificada de pagamentos Prontu e pedidos Yelo — com e sem correspondência.
              </p>
            </div>

            {/* Summary chips */}
            {!loading && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-success/15 text-success ring-1 ring-success/30">
                  <span className="size-1.5 rounded-full bg-success" />
                  {matched} com pedido
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-critical/15 text-critical ring-1 ring-critical/30">
                  <span className="size-1.5 rounded-full bg-critical pulse-critical" />
                  {unmatched} sem pedido
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <TransactionsTable
          rows={rows}
          loading={loading}
          dateFilter={dateFilter}
          onDateFilterChange={handleDateFilterChange}
        />
      </div>
    </OpsShell>
  );
}
