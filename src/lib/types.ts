export type PaymentStatus = "SUCCESS" | "PENDING" | "FAILED";
export type OrderStatus = "CREATED" | "ACCEPTED" | "DELIVERING" | "DELIVERED" | "CANCELLED";
export type IncidentStatus = "open" | "acknowledged" | "resolved" | "escalated";
export type Severity = "high" | "medium" | "low";

export interface Payment {
  id: string; // internal id
  prontu_payment_id: string;
  reference: string;
  customer_name: string;
  customer_contact: string; // phone or email
  amount: number; // in AOA
  currency: "AOA";
  status: PaymentStatus;
  paid_at: string; // ISO
}

export interface Order {
  id: string;
  yelo_order_id: string;
  reference: string;
  payment_ref: string; // joins to Payment.prontu_payment_id
  status: OrderStatus;
  created_at: string;
}

export interface IncidentEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  notes?: string;
}

export interface Incident {
  id: string;
  payment_id: string; // Payment.id
  severity: Severity;
  status: IncidentStatus;
  assigned_to?: string;
  created_at: string;
  resolved_at?: string;
  events: IncidentEvent[];
}

export function fmtAOA(n: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(n);
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

export function elapsedMinutes(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}
