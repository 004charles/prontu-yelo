import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { OpsShell } from "../components/ops/OpsShell";
import { KpiCards } from "../components/ops/KpiCards";
import { IncidentTable } from "../components/ops/IncidentTable";
import { useOpsStore, type DateFilter } from "../lib/ops-store";
import { fmtAOA } from "../lib/types";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sala OPS · Tupuca × Prontu" },
      {
        name: "description",
        content:
          "Dashboard de reconciliação entre pagamentos Prontu e pedidos Yelo/Tupuca em tempo real.",
      },
    ],
  }),
  component: DashboardPage,
});

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "all", label: "Todos" },
];

function DashboardPage() {
  const navigate = useNavigate();
  const store = useOpsStore();
  const { dateFilter, setDateFilter } = store;

  // Auth Gate using real Supabase sessions
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate({ to: "/auth" });
      } else {
        store.initialize(session.access_token);
      }
    });
  }, [navigate]);

  return (
    <OpsShell>
      <div className="bg-grid border-b border-border/40">
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                Operations Floor
              </div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                Reconciliação Prontu ↔ Yelo
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Cada pagamento confirmado deve ter um pedido correspondente. Inconsistências geram
                alertas críticos imediatamente no ecrã da sala.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Date filter */}
              <div className="flex items-center gap-1 bg-surface rounded-lg p-1 ring-1 ring-border/40">
                {DATE_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    id={`date-filter-${f.key}`}
                    onClick={() => setDateFilter(f.key)}
                    className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
                      dateFilter === f.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <LiveTicker />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">
        <KpiCards />
        <IncidentTable />
      </div>
    </OpsShell>
  );
}

function LiveTicker() {
  const { incidents, payments } = useOpsStore();
  const latest = incidents
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  if (!latest) return null;

  // Find payment, handling either string UUID or Payment objects
  const pay = payments.find(
    (p) => p.id === latest.payment_id || p.prontu_payment_id === latest.payment_id,
  );
  if (!pay) return null;

  return (
    <div className="rounded-lg bg-card ring-1 ring-critical/30 px-4 py-2 min-w-[240px] relative overflow-hidden hidden xl:block">
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{ background: "var(--gradient-critical)" }}
      />
      <div className="relative text-[9px] uppercase tracking-wider text-critical font-semibold flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-critical pulse-critical" />
        Último incidente
      </div>
      <div className="relative mt-0.5 text-xs font-medium truncate">{pay.customer_name}</div>
      <div className="relative flex items-center justify-between text-[11px] font-mono">
        <span className="text-muted-foreground truncate max-w-[100px]">
          {pay.prontu_payment_id}
        </span>
        <span className="tabular-nums font-medium">{fmtAOA(pay.amount)}</span>
      </div>
    </div>
  );
}
