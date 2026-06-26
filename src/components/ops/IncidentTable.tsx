import { Link } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useOpsStore } from "@/lib/ops-store";
import { fmtAOA, timeAgo, type IncidentStatus } from "@/lib/types";
import { StatusPill } from "./StatusPill";

const STATUS_FILTERS: { key: "all" | IncidentStatus; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "open", label: "Abertos" },
  { key: "acknowledged", label: "Em curso" },
  { key: "escalated", label: "Escalados" },
  { key: "resolved", label: "Resolvidos" },
];

export function IncidentTable() {
  const { incidents, payments, orders } = useOpsStore();
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["key"]>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return incidents
      .map((i) => ({
        incident: i,
        payment: payments.find(
          (p) => p.id === i.payment_id || p.prontu_payment_id === i.payment_id,
        )!,
      }))
      .filter(({ incident, payment }) => {
        if (filter !== "all" && incident.status !== filter) return false;
        if (!q) return true;
        const needle = q.toLowerCase();
        return (
          payment.customer_name.toLowerCase().includes(needle) ||
          payment.prontu_payment_id.toLowerCase().includes(needle) ||
          payment.reference.toLowerCase().includes(needle)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.incident.created_at).getTime() - new Date(a.incident.created_at).getTime(),
      );
  }, [incidents, payments, filter, q]);

  return (
    <section
      className="rounded-lg bg-card ring-1 ring-border/60 overflow-hidden"
      style={{ boxShadow: "var(--shadow-panel)" }}
    >
      <header className="px-4 py-3 border-b border-border/60 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-critical pulse-critical" />
          <h2 className="text-sm font-semibold">Incidentes</h2>
          <span className="text-xs text-muted-foreground font-mono">
            {rows.length} {rows.length === 1 ? "registo" : "registos"}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                filter === f.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cliente, payment_id, ref…"
            className="h-8 pl-8 text-xs bg-surface-2 border-border/60"
          />
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th>Cliente</Th>
              <Th>Pagamento (Prontu)</Th>
              <Th>Pedido (Yelo)</Th>
              <Th className="text-right">Valor</Th>
              <Th>Há</Th>
              <Th>Status</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  Nada por aqui. Sistema em consistência.
                </td>
              </tr>
            ) : (
              rows.map(({ incident, payment }) => {
                const order = orders.find(
                  (o) =>
                    o.payment_ref === payment.prontu_payment_id ||
                    o.reference === payment.reference,
                );
                const critical = incident.status === "open";
                return (
                  <tr
                    key={incident.id}
                    className={`border-t border-border/40 hover:bg-accent/30 transition-colors ${
                      critical ? "tick" : ""
                    }`}
                  >
                    <Td>
                      <div className="font-medium">{payment.customer_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {payment.customer_contact}
                      </div>
                    </Td>
                    <Td>
                      <div className="font-mono text-xs">{payment.prontu_payment_id}</div>
                      <div className="text-[11px] text-muted-foreground">
                        ref {payment.reference}
                      </div>
                    </Td>
                    <Td>
                      {order ? (
                        <>
                          <div className="font-mono text-xs">{order.yelo_order_id}</div>
                          <div className="text-[11px] text-success">{order.status}</div>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-critical font-medium">
                          <span className="size-1.5 rounded-full bg-critical" />
                          não existe
                        </span>
                      )}
                    </Td>
                    <Td className="text-right font-mono tabular-nums">{fmtAOA(payment.amount)}</Td>
                    <Td className="text-xs text-muted-foreground">
                      {timeAgo(incident.created_at)}
                    </Td>
                    <Td>
                      <StatusPill status={incident.status} severity={incident.severity} />
                    </Td>
                    <Td>
                      <Link
                        to="/incidents/$id"
                        params={{ id: incident.id }}
                        className="inline-flex items-center justify-center size-7 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowRight className="size-4" />
                      </Link>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left font-medium px-4 py-2.5 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
