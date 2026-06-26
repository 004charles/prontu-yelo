import { create } from "zustand";
import { supabase } from "./supabase";
import { toast } from "sonner";
import {
  getDashboardDataServer,
  acknowledgeIncidentServer,
  resolveIncidentServer,
  escalateIncidentServer,
  createOrderManuallyServer,
  forceSyncServer,
  contactCustomerServer,
  validatePaymentServer,
  addNoteServer,
} from "./incidents.functions";
import {
  getOpsKpisServer,
  runManualSyncServer,
  listUsersServer,
  createOperatorServer,
  updateUserRoleServer,
  deleteUserServer,
  type OpsKpis,
} from "./ops.functions";
import { type Incident, type Order, type Payment } from "./types";

export type DateFilter = "today" | "7d" | "30d" | "all";

interface OpsState {
  payments: Payment[];
  orders: Order[];
  incidents: Incident[];
  kpis: OpsKpis;
  lastSyncAt: string;
  syncing: boolean;
  loading: boolean;
  jwt: string | null;
  isAdmin: boolean;
  dateFilter: DateFilter;
  operators: { id: string; email: string; role: "admin" | "ops"; created_at: string }[];
  initialize: (jwtToken?: string | null) => Promise<void>;
  refreshData: (filter?: DateFilter) => Promise<void>;
  setDateFilter: (filter: DateFilter) => Promise<void>;
  runSync: () => Promise<void>;
  acknowledge: (id: string, actor?: string) => Promise<void>;
  resolve: (id: string, actor?: string, notes?: string) => Promise<void>;
  escalate: (id: string, actor?: string) => Promise<void>;
  createOrderManually: (id: string, actor?: string) => Promise<void>;
  forceSync: (id: string, actor?: string) => Promise<void>;
  contactCustomer: (id: string, actor?: string) => Promise<void>;
  validatePayment: (id: string, actor?: string) => Promise<void>;
  addNote: (id: string, notes: string, actor?: string) => Promise<void>;
  fetchOperators: () => Promise<void>;
  createOperator: (email: string, role: "admin" | "ops", password?: string) => Promise<void>;
  updateOperatorRole: (userId: string, role: "admin" | "ops") => Promise<void>;
  deleteOperator: (userId: string) => Promise<void>;
}

// Generate alarm sound using browser Web Audio API (no external assets needed)
function playAlertSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 (chord)

    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(audioCtx.currentTime + 0.8);
    osc2.stop(audioCtx.currentTime + 0.8);
  } catch (err) {
    console.error("Failed to play alert sound:", err);
  }
}

// Map database schema to frontend client models
function mapDbIncident(dbInc: any): Incident {
  return {
    id: dbInc.id,
    payment_id: dbInc.payment_id,
    severity: dbInc.severity,
    status: dbInc.status,
    assigned_to: dbInc.assigned_to || undefined,
    created_at: dbInc.created_at,
    resolved_at: dbInc.resolved_at || undefined,
    events: (dbInc.events || [])
      .map((e: any) => ({
        id: e.id,
        at: e.at || e.created_at,
        actor: e.actor,
        action: e.action,
        notes: e.notes || undefined,
      }))
      .sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime()),
  };
}

let realtimeSubscribed = false;

function filterToSince(filter: DateFilter): string | undefined {
  if (filter === "today") return new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  if (filter === "7d") return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (filter === "30d") return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return undefined; // "all"
}

export const useOpsStore = create<OpsState>((set, get) => ({
  payments: [],
  orders: [],
  incidents: [],
  kpis: {
    verifiedPayments: 0,
    createdOrders: 0,
    anomaliesDetected: 0,
    activeIncidents: 0,
    avgDetectionTimeMin: 0,
  },
  operators: [],
  isAdmin: false,
  dateFilter: "today" as DateFilter,
  lastSyncAt: new Date().toISOString(),
  syncing: false,
  loading: false,
  jwt: null,

  initialize: async (jwtToken = null) => {
    set({ jwt: jwtToken });
    set({ loading: true });

    // Check if user is admin
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("id", user.id)
          .single();
        set({ isAdmin: roleData?.role === "admin" });
      } else {
        set({ isAdmin: false });
      }
    } catch (err) {
      console.error("Failed to determine admin status:", err);
      set({ isAdmin: false });
    }

    await get().refreshData();
    set({ loading: false });

    // Enable realtime channel
    if (!realtimeSubscribed) {
      realtimeSubscribed = true;
      supabase
        .channel("ops-floor-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "incidents" },
          async (payload) => {
            if (payload.eventType === "INSERT") {
              const newInc = payload.new as any;
              if (newInc.status === "open") {
                playAlertSound();
              }
            }
            await get().refreshData();
          },
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, async () => {
          await get().refreshData();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async () => {
          await get().refreshData();
        })
        .subscribe();
    }
  },

  refreshData: async (filter?: DateFilter) => {
    const { jwt, dateFilter } = get();
    const activeFilter = filter ?? dateFilter;
    const since = filterToSince(activeFilter);
    try {
      // 1. Fetch tables
      const data = await getDashboardDataServer({ data: { jwt: jwt || undefined, since } });

      // 2. Fetch KPIs
      const kpis = await getOpsKpisServer({ data: { jwt: jwt || undefined } });

      set({
        payments: data.payments as any[],
        orders: data.orders as any[],
        incidents: (data.incidents || []).map(mapDbIncident),
        kpis,
        lastSyncAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error refreshing dashboard data:", error);
    }
  },

  setDateFilter: async (filter: DateFilter) => {
    set({ dateFilter: filter });
    await get().refreshData(filter);
  },

  runSync: async () => {
    const { jwt } = get();
    set({ syncing: true });
    try {
      const res = await runManualSyncServer({ data: { jwt: jwt || undefined } });
      if (res && (res as any).success === false) {
        toast.error(`Falha na sincronização: ${(res as any).error || "Erro desconhecido"}`);
      } else {
        toast.success("Sincronização concluída com sucesso!");
        await get().refreshData();
      }
    } catch (err: any) {
      console.error("Failed to run sync:", err);
      toast.error(`Erro ao executar sincronização: ${err.message || "Erro desconhecido"}`);
    } finally {
      set({ syncing: false });
    }
  },

  acknowledge: async (id, actor = "Você (OPS)") => {
    const { jwt } = get();
    try {
      await acknowledgeIncidentServer({ data: { id, actor, jwt: jwt || undefined } });
      await get().refreshData();
    } catch (err) {
      console.error("Acknowledge action failed:", err);
    }
  },

  resolve: async (id, actor = "Você (OPS)", notes) => {
    const { jwt } = get();
    try {
      await resolveIncidentServer({ data: { id, actor, notes, jwt: jwt || undefined } });
      await get().refreshData();
    } catch (err) {
      console.error("Resolve action failed:", err);
    }
  },

  escalate: async (id, actor = "Você (OPS)") => {
    const { jwt } = get();
    try {
      await escalateIncidentServer({ data: { id, actor, jwt: jwt || undefined } });
      await get().refreshData();
    } catch (err) {
      console.error("Escalate action failed:", err);
    }
  },

  createOrderManually: async (id, actor = "Você (OPS)") => {
    const { jwt } = get();
    try {
      await createOrderManuallyServer({ data: { incidentId: id, actor, jwt: jwt || undefined } });
      await get().refreshData();
    } catch (err) {
      console.error("Manual order creation failed:", err);
    }
  },

  forceSync: async (id, actor = "Você (OPS)") => {
    const { jwt } = get();
    try {
      await forceSyncServer({ data: { incidentId: id, actor, jwt: jwt || undefined } });
      await get().refreshData();
    } catch (err) {
      console.error("Force sync failed:", err);
    }
  },

  contactCustomer: async (id, actor = "Você (OPS)") => {
    const { jwt } = get();
    try {
      await contactCustomerServer({ data: { incidentId: id, actor, jwt: jwt || undefined } });
      await get().refreshData();
    } catch (err) {
      console.error("Contact customer action failed:", err);
    }
  },

  validatePayment: async (id, actor = "Você (OPS)") => {
    const { jwt } = get();
    try {
      await validatePaymentServer({ data: { incidentId: id, actor, jwt: jwt || undefined } });
      await get().refreshData();
    } catch (err) {
      console.error("Validate payment action failed:", err);
    }
  },

  addNote: async (id, notes, actor = "Você (OPS)") => {
    const { jwt } = get();
    try {
      await addNoteServer({ data: { incidentId: id, notes, actor, jwt: jwt || undefined } });
      await get().refreshData();
    } catch (err) {
      console.error("Add note action failed:", err);
    }
  },

  fetchOperators: async () => {
    const { jwt } = get();
    try {
      const users = await listUsersServer({ data: { jwt: jwt || undefined } });
      set({ operators: users as any[] });
    } catch (err) {
      console.error("Failed to fetch operators:", err);
    }
  },

  createOperator: async (email, role, password) => {
    const { jwt } = get();
    try {
      await createOperatorServer({ data: { email, role, password, jwt: jwt || undefined } });
      await get().fetchOperators();
    } catch (err) {
      console.error("Failed to create operator:", err);
      throw err;
    }
  },

  updateOperatorRole: async (userId, role) => {
    const { jwt } = get();
    try {
      await updateUserRoleServer({ data: { userId, role, jwt: jwt || undefined } });
      await get().fetchOperators();
    } catch (err) {
      console.error("Failed to update operator role:", err);
      throw err;
    }
  },

  deleteOperator: async (userId) => {
    const { jwt } = get();
    try {
      await deleteUserServer({ data: { userId, jwt: jwt || undefined } });
      await get().fetchOperators();
    } catch (err) {
      console.error("Failed to delete operator:", err);
      throw err;
    }
  },
}));
