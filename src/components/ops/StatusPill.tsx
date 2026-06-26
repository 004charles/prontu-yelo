import type { IncidentStatus, Severity } from "@/lib/types";

export function StatusPill({ status, severity }: { status: IncidentStatus; severity?: Severity }) {
  const map: Record<IncidentStatus, { label: string; cls: string; dot: string }> = {
    open: {
      label: "ABERTO",
      cls: "bg-critical/15 text-critical ring-critical/30",
      dot: "bg-critical pulse-critical",
    },
    acknowledged: {
      label: "EM CURSO",
      cls: "bg-warning/15 text-warning ring-warning/30",
      dot: "bg-warning",
    },
    resolved: {
      label: "RESOLVIDO",
      cls: "bg-success/15 text-success ring-success/30",
      dot: "bg-success",
    },
    escalated: {
      label: "ESCALADO",
      cls: "bg-primary/20 text-primary ring-primary/40",
      dot: "bg-primary",
    },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider ring-1 ${s.cls}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
      {severity === "high" && status === "open" ? (
        <span className="ml-1 font-mono text-[9px] opacity-70">P1</span>
      ) : null}
    </span>
  );
}
