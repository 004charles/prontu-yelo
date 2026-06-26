import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  PackagePlus,
  Phone,
  RefreshCw,
  ShieldCheck,
  Siren,
  FileText,
} from "lucide-react";
import { useState, useEffect } from "react";
import { OpsShell } from "../components/ops/OpsShell";
import { StatusPill } from "../components/ops/StatusPill";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { fmtAOA, timeAgo } from "../lib/types";
import { useOpsStore } from "../lib/ops-store";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/incidents/$id")({
  ssr: false,
  head: ({ params }) => ({
    meta: [{ title: `Incidente ${params.id} · Sala OPS` }],
  }),
  component: IncidentDetailPage,
  notFoundComponent: () => (
    <OpsShell>
      <div className="mx-auto max-w-2xl py-20 text-center">
        <h1 className="text-xl font-semibold">Incidente não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pode já ter sido resolvido ou o link está incorreto.
        </p>
        <Link to="/" className="inline-block mt-6 text-primary hover:underline text-sm">
          ← Voltar à dashboard
        </Link>
      </div>
    </OpsShell>
  ),
});

function IncidentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const store = useOpsStore();
  const { jwt } = store;

  const [actor, setActor] = useState("Você (OPS)");
  const [note, setNote] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Auth Gate
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate({ to: "/auth" });
      } else {
        await store.initialize(session.access_token);
        setActor(session.user.email || "Operador");
        setIsReady(true);
      }
    });
  }, [navigate]);

  if (!isReady || store.loading) {
    return (
      <OpsShell>
        <div className="mx-auto max-w-2xl py-20 text-center flex flex-col items-center justify-center gap-4">
          <div className="size-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-mono">
            A carregar detalhes do incidente...
          </p>
        </div>
      </OpsShell>
    );
  }

  const incident = store.incidents.find((i) => i.id === id);
  if (!incident) throw notFound();

  // Find payment by its internal ID (or uuid match)
  const payment = store.payments.find(
    (p) => p.id === incident.payment_id || p.prontu_payment_id === incident.payment_id,
  );
  if (!payment) throw notFound();

  // Find order associated with payment ref or reference
  const order = store.orders.find(
    (o) => o.payment_ref === payment.prontu_payment_id || o.reference === payment.reference,
  );

  const isResolved = incident.status === "resolved";

  const runAction = async (actionName: string, fn: () => Promise<void>) => {
    setLoadingAction(actionName);
    try {
      await fn();
    } catch (err: any) {
      console.error(`Error running ${actionName}:`, err);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <OpsShell>
      <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
          <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                  Incidente
                </span>
                <span className="font-mono text-sm truncate max-w-[150px]" title={incident.id}>
                  {incident.id}
                </span>
                <StatusPill status={incident.status} severity={incident.severity} />
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Pagamento confirmado sem pedido no Yelo
              </h1>
              <p className="mt-2 text-sm text-muted-foreground font-mono">
                Detectado {timeAgo(incident.created_at)} · <span>{payment.prontu_payment_id}</span>
              </p>
            </div>

            {!isResolved && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 border-border/60"
                  disabled={incident.status === "acknowledged" || loadingAction !== null}
                  onClick={() =>
                    runAction("acknowledge", () => store.acknowledge(incident.id, actor))
                  }
                >
                  <ShieldCheck className="size-3.5" />
                  {loadingAction === "acknowledge" ? "A processar..." : "Reconhecer"}
                </Button>
                <Button
                  size="sm"
                  className="gap-2 bg-success text-success-foreground hover:bg-success/90"
                  disabled={loadingAction !== null}
                  onClick={() =>
                    runAction("resolve", () =>
                      store.resolve(incident.id, actor, "Resolvido manualmente por operador"),
                    )
                  }
                >
                  <CheckCircle2 className="size-3.5" />
                  {loadingAction === "resolve" ? "A fechar..." : "Marcar resolvido"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column — facts */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Panel title="Pagamento — Prontu" tone="success">
                <Row k="ID" v={<span className="font-mono">{payment.prontu_payment_id}</span>} />
                <Row k="Referência" v={<span className="font-mono">{payment.reference}</span>} />
                <Row
                  k="Valor"
                  v={
                    <span className="font-mono tabular-nums font-medium">
                      {fmtAOA(payment.amount)}
                    </span>
                  }
                />
                <Row
                  k="Status"
                  v={
                    <span className="inline-flex items-center gap-1.5 text-success text-xs font-semibold">
                      <span className="size-1.5 rounded-full bg-success animate-pulse" /> SUCCESS
                    </span>
                  }
                />
                <Row k="Pago" v={timeAgo(payment.paid_at)} />
              </Panel>

              <Panel title="Pedido — Yelo (Tupuca)" tone={order ? "success" : "critical"}>
                {order ? (
                  <>
                    <Row k="ID" v={<span className="font-mono">{order.yelo_order_id}</span>} />
                    <Row
                      k="Referência"
                      v={<span className="font-mono">{order.reference || "--"}</span>}
                    />
                    <Row
                      k="Status"
                      v={<span className="text-success font-medium">{order.status}</span>}
                    />
                    <Row k="Criado" v={timeAgo(order.created_at)} />
                  </>
                ) : (
                  <div className="py-6 text-center">
                    <div className="mx-auto size-10 rounded-full bg-critical/15 grid place-items-center text-critical">
                      <Siren className="size-5" />
                    </div>
                    <div className="mt-3 text-sm font-medium text-critical">
                      Nenhum pedido encontrado
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Esperado: <span className="font-mono">{payment.reference}</span>
                    </div>
                  </div>
                )}
              </Panel>
            </div>

            <Panel title="Cliente">
              <Row k="Nome" v={payment.customer_name || "Desconhecido"} />
              <Row
                k="Contacto"
                v={
                  payment.customer_contact ? (
                    <a
                      href={
                        payment.customer_contact.includes("@")
                          ? `mailto:${payment.customer_contact}`
                          : `tel:${payment.customer_contact.replace(/\s/g, "")}`
                      }
                      className="text-primary hover:underline"
                    >
                      {payment.customer_contact}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Nenhum contacto fornecido</span>
                  )
                }
              />
            </Panel>

            <Panel title="Audit Trail (Histórico do Incidente)">
              <ol className="relative ml-2">
                {incident.events && incident.events.length > 0 ? (
                  incident.events
                    .slice()
                    .reverse()
                    .map((ev: any, idx: number) => (
                      <li key={ev.id} className="relative pl-5 pb-4 last:pb-0">
                        <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
                        {idx !== incident.events.length - 1 && (
                          <span className="absolute left-[3px] top-3 bottom-0 w-px bg-border/40" />
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-primary/80">{ev.action}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground font-medium">{ev.actor}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                            {timeAgo(ev.at)}
                          </span>
                        </div>
                        {ev.notes && (
                          <div className="mt-1 text-xs text-muted-foreground bg-surface-2/40 p-2 rounded border border-border/20 max-w-xl">
                            {ev.notes}
                          </div>
                        )}
                      </li>
                    ))
                ) : (
                  <div className="text-xs text-muted-foreground font-mono">
                    Nenhum evento registado.
                  </div>
                )}
              </ol>
            </Panel>
          </div>

          {/* Right column — actions */}
          <aside className="space-y-4">
            <Panel title="Ações da sala">
              <div className="space-y-2">
                <ActionBtn
                  icon={<PackagePlus className="size-4" />}
                  label="Criar pedido no Yelo"
                  description="Reconstruir o pedido a partir do pagamento."
                  onClick={() =>
                    runAction("createOrder", () => store.createOrderManually(incident.id, actor))
                  }
                  disabled={!!order || isResolved || loadingAction !== null}
                  loading={loadingAction === "createOrder"}
                  primary
                />
                <ActionBtn
                  icon={<RefreshCw className="size-4" />}
                  label="Forçar sincronização"
                  description="Re-pull Prontu + Yelo para este ID."
                  onClick={() => runAction("forceSync", () => store.forceSync(incident.id, actor))}
                  disabled={isResolved || loadingAction !== null}
                  loading={loadingAction === "forceSync"}
                />
                <ActionBtn
                  icon={<Phone className="size-4" />}
                  label="Contactar cliente"
                  description="Registar contacto e abrir tel/email."
                  onClick={() =>
                    runAction("contactCustomer", () => store.contactCustomer(incident.id, actor))
                  }
                  disabled={isResolved || loadingAction !== null}
                  loading={loadingAction === "contactCustomer"}
                />
                <ActionBtn
                  icon={<ShieldCheck className="size-4" />}
                  label="Validar pagamento"
                  description="Confirmar contra extrato Prontu."
                  onClick={() =>
                    runAction("validatePayment", () => store.validatePayment(incident.id, actor))
                  }
                  disabled={isResolved || loadingAction !== null}
                  loading={loadingAction === "validatePayment"}
                />
                <ActionBtn
                  icon={<Siren className="size-4" />}
                  label="Escalar para equipa técnica"
                  description="Aumentar prioridade e notificar engenharia."
                  onClick={() => runAction("escalate", () => store.escalate(incident.id, actor))}
                  disabled={isResolved || incident.status === "escalated" || loadingAction !== null}
                  loading={loadingAction === "escalate"}
                  danger
                />
              </div>
            </Panel>

            <Panel title="Nota interna">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: cliente confirmou que o saldo foi debitado..."
                disabled={isResolved}
                className="bg-surface-2 border-border/60 min-h-[88px] text-xs focus-visible:ring-primary/50"
              />
              <Button
                size="sm"
                className="mt-2 w-full text-xs"
                disabled={!note.trim() || isResolved || loadingAction !== null}
                onClick={() => {
                  runAction("addNote", async () => {
                    await store.addNote(incident.id, note.trim(), actor);
                    setNote("");
                  });
                }}
              >
                {loadingAction === "addNote" ? "A gravar..." : "Adicionar ao audit trail"}
              </Button>
            </Panel>
          </aside>
        </div>
      </div>
    </OpsShell>
  );
}

function Panel({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "success" | "critical";
}) {
  const ring =
    tone === "critical"
      ? "ring-critical/40 border-critical/30"
      : tone === "success"
        ? "ring-success/20 border-success/15"
        : "ring-border/40 border-border/20";
  return (
    <div
      className={`rounded-lg bg-card/60 backdrop-blur-md ring-1 ${ring} overflow-hidden border`}
      style={{ boxShadow: "var(--shadow-panel)" }}
    >
      <div className="px-4 py-2.5 border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-surface-2/20">
        {title}
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs py-1 border-b border-border/20 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  description,
  onClick,
  disabled,
  primary,
  danger,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  loading?: boolean;
}) {
  const tone = danger
    ? "hover:bg-critical/10 hover:ring-critical/30 border-critical/20 text-critical"
    : primary
      ? "hover:bg-primary/10 hover:ring-primary/35 border-primary/20 text-foreground"
      : "hover:bg-accent/80 border-border/40 text-foreground";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group w-full text-left rounded-md border bg-surface-2/20 p-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${tone}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span
          className={`size-6.5 rounded grid place-items-center ${
            danger
              ? "bg-critical/10 text-critical"
              : primary
                ? "bg-primary/10 text-primary"
                : "bg-accent text-muted-foreground"
          }`}
        >
          {loading ? (
            <span className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            icon
          )}
        </span>
        {label}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground pl-8">{description}</div>
    </button>
  );
}
