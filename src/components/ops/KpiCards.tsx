import { CheckCircle2, AlertOctagon, Wallet, Package, Clock } from "lucide-react";
import { useOpsStore } from "@/lib/ops-store";
import { elapsedMinutes } from "@/lib/types";

export function KpiCards() {
  const { payments, orders, incidents } = useOpsStore();

  const verified = payments.filter((p) => p.status === "SUCCESS").length;
  const created = orders.length;
  const inconsistencies = incidents.length;
  const active = incidents.filter((i) => i.status === "open" || i.status === "acknowledged").length;
  const avgDetection =
    incidents.length === 0
      ? 0
      : Math.round(
          incidents.reduce((acc, i) => acc + elapsedMinutes(i.created_at), 0) / incidents.length,
        );

  const cards = [
    {
      label: "Pagamentos verificados",
      value: verified,
      sub: "últimas 24h",
      icon: <Wallet className="size-4" />,
      tone: "default" as const,
    },
    {
      label: "Pedidos criados",
      value: created,
      sub:
        verified === 0
          ? "100% match rate"
          : `${Math.round((created / verified) * 100)}% match rate`,
      icon: <Package className="size-4" />,
      tone: "success" as const,
    },
    {
      label: "Inconsistências",
      value: inconsistencies,
      sub: "detectadas hoje",
      icon: <AlertOctagon className="size-4" />,
      tone: "warning" as const,
    },
    {
      label: "Incidentes ativos",
      value: active,
      sub: active > 0 ? "requer ação" : "tudo limpo",
      icon: active > 0 ? <AlertOctagon className="size-4" /> : <CheckCircle2 className="size-4" />,
      tone: active > 0 ? ("critical" as const) : ("success" as const),
    },
    {
      label: "Tempo médio de detecção",
      value: `${avgDetection}m`,
      sub: "do pagamento ao alerta",
      icon: <Clock className="size-4" />,
      tone: "default" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label} {...c} />
      ))}
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  tone: "default" | "success" | "warning" | "critical";
}) {
  const toneRing =
    tone === "critical"
      ? "ring-critical/40"
      : tone === "warning"
        ? "ring-warning/30"
        : tone === "success"
          ? "ring-success/30"
          : "ring-border/40";
  const toneIcon =
    tone === "critical"
      ? "bg-critical/15 text-critical"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : tone === "success"
          ? "bg-success/15 text-success"
          : "bg-muted text-muted-foreground";

  return (
    <div
      className={`relative rounded-lg bg-card p-4 ring-1 ${toneRing} overflow-hidden`}
      style={{ boxShadow: "var(--shadow-panel)" }}
    >
      {tone === "critical" && (
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ background: "var(--gradient-critical)" }}
        />
      )}
      <div className="relative flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`size-7 rounded grid place-items-center ${toneIcon}`}>{icon}</div>
      </div>
      <div className="relative mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      <div className="relative mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
