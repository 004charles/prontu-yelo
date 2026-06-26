import { createServerFn } from "@tanstack/react-start";
import { supabase, supabaseAdmin } from "./supabase";
import { createYeloOrder } from "./yelo.server";
import { runReconciliation } from "./reconcile.server";
import { reconcileMatch, isExactMatch } from "./matching";

// Helper to verify user's role on the server
async function verifyRole(jwt: string | undefined) {
  if (!jwt) {
    throw new Error("Não autorizado: Sessão em falta.");
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    throw new Error("Não autorizado: Utilizador inválido ou sessão expirada.");
  }

  const { data: roleData, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (roleErr || !roleData || (roleData.role !== "admin" && roleData.role !== "ops")) {
    throw new Error(
      "Não autorizado: Acesso reservado a administradores ou operadores de sala (OPS).",
    );
  }
  return user;
}

// 1. Fetch Incidents, Payments and Orders (for Dashboard — filtered by date)
export const getDashboardDataServer = createServerFn({ method: "GET" })
  .validator((d: { jwt?: string; since?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    // Default: start of today. If 'since' is provided, use that date.
    const since = data.since
      ? new Date(data.since).toISOString()
      : new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    const { data: incidents } = await supabaseAdmin
      .from("incidents")
      .select(
        `
        *,
        events: incident_events(*)
      `,
      )
      .order("created_at", { ascending: false });

    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("*")
      .gte("paid_at", since)
      .order("paid_at", { ascending: false });

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    return {
      incidents: incidents || [],
      payments: payments || [],
      orders: orders || [],
    };
  });

// 1b. Fetch All Transactions (FULL OUTER JOIN: payments + orders) for the Transactions page
export const getTransactionsServer = createServerFn({ method: "GET" })
  .validator((d: { jwt?: string; since?: string; until?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    let paymentsQuery = supabaseAdmin
      .from("payments")
      .select("*")
      .order("paid_at", { ascending: false });

    if (data.since) {
      paymentsQuery = paymentsQuery.gte("paid_at", new Date(data.since).toISOString());
    }
    if (data.until) {
      paymentsQuery = paymentsQuery.lte("paid_at", new Date(data.until).toISOString());
    }

    const { data: payments } = await paymentsQuery;
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    const paymentsList = payments || [];
    const ordersList = orders || [];

    const rows: any[] = [];
    const matchedOrders = new Set<string>();
    const matchedPayments = new Set<string>();

    // Pass 1: Correspondências exatas
    for (const p of paymentsList) {
      for (const o of ordersList) {
        if (isExactMatch(p, o)) {
          rows.push({
            payment: p,
            order: o,
            matched: true,
            matchType: "exact",
            matchReason: "Referência/ID exata",
            side: "payment",
          });
          matchedOrders.add(o.yelo_order_id);
          matchedPayments.add(p.prontu_payment_id);
          break;
        }
      }
    }

    // Pass 2: Correspondências aproximadas (fuzzy) para pagamentos restantes
    for (const p of paymentsList) {
      if (matchedPayments.has(p.prontu_payment_id)) continue;

      let fuzzyMatched = false;
      for (const o of ordersList) {
        if (matchedOrders.has(o.yelo_order_id)) continue;

        const matchResult = reconcileMatch(p, o);
        if (matchResult.matched) {
          rows.push({
            payment: p,
            order: o,
            matched: true,
            matchType: "fuzzy",
            matchReason: matchResult.reason,
            side: "payment",
          });
          matchedOrders.add(o.yelo_order_id);
          matchedPayments.add(p.prontu_payment_id);
          fuzzyMatched = true;
          break;
        }
      }

      if (!fuzzyMatched) {
        // Pagamento sem pedido correspondente
        rows.push({
          payment: p,
          order: null,
          matched: false,
          matchType: "none",
          side: "payment",
        });
      }
    }

    // Pass 3: Adicionar pedidos órfãos restantes (que não foram associados a nenhum pagamento)
    for (const o of ordersList) {
      if (!matchedOrders.has(o.yelo_order_id)) {
        rows.push({
          payment: null,
          order: o,
          matched: false,
          matchType: "none",
          side: "order",
        });
      }
    }

    return { rows };
  });

// 2. Acknowledge Incident
export const acknowledgeIncidentServer = createServerFn({ method: "POST" })
  .validator((d: { id: string; actor: string; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    const { error: updateErr } = await supabaseAdmin
      .from("incidents")
      .update({
        status: "acknowledged",
        assigned_to: data.actor,
      })
      .eq("id", data.id);

    if (updateErr) throw new Error(updateErr.message);

    await supabaseAdmin.from("incident_events").insert({
      incident_id: data.id,
      actor: data.actor,
      action: "incident.acknowledged",
      notes: `Incidente reconhecido por ${data.actor}`,
    });

    return { success: true };
  });

// 3. Resolve Incident
export const resolveIncidentServer = createServerFn({ method: "POST" })
  .validator((d: { id: string; actor: string; notes?: string; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    const { error: updateErr } = await supabaseAdmin
      .from("incidents")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        notes: data.notes,
      })
      .eq("id", data.id);

    if (updateErr) throw new Error(updateErr.message);

    await supabaseAdmin.from("incident_events").insert({
      incident_id: data.id,
      actor: data.actor,
      action: "incident.resolved",
      notes: data.notes || "Incidente resolvido manualmente.",
    });

    return { success: true };
  });

// 4. Escalate Incident
export const escalateIncidentServer = createServerFn({ method: "POST" })
  .validator((d: { id: string; actor: string; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    const { error: updateErr } = await supabaseAdmin
      .from("incidents")
      .update({
        status: "escalated",
        severity: "high",
        assigned_to: "Equipa de Engenharia / Suporte Técnico",
      })
      .eq("id", data.id);

    if (updateErr) throw new Error(updateErr.message);

    await supabaseAdmin.from("incident_events").insert({
      incident_id: data.id,
      actor: data.actor,
      action: "incident.escalated",
      notes: "Escalado para a equipa técnica para análise de logs adicionais.",
    });

    return { success: true };
  });

// 5. Create Order Manually in Yelo
export const createOrderManuallyServer = createServerFn({ method: "POST" })
  .validator((d: { incidentId: string; actor: string; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    // Get incident details
    const { data: incident, error: incErr } = await supabaseAdmin
      .from("incidents")
      .select("*, payment:payments(*)")
      .eq("id", data.incidentId)
      .single();

    if (incErr || !incident) {
      throw new Error("Incidente não encontrado.");
    }

    const payment = incident.payment;
    if (!payment) {
      throw new Error("Pagamento associado ao incidente não encontrado.");
    }

    // Fetch latest keys and details from database
    const { data: dbSettings } = await supabaseAdmin.from("system_settings").select("*");
    const settings: Record<string, string> = {};
    if (dbSettings) {
      for (const s of dbSettings) {
        settings[s.key] = s.value;
      }
    }

    const yeloKey = settings.YELO_API_KEY || process.env.YELO_API_KEY || "mock_key";
    const vendorId = settings.YELO_VENDOR_ID || process.env.YELO_VENDOR_ID || undefined;
    const paymentMethodId =
      settings.YELO_PAYMENT_METHOD_ID || process.env.YELO_PAYMENT_METHOD_ID || undefined;

    // Call Yelo API to create the order
    const yeloResult = await createYeloOrder(
      yeloKey,
      {
        reference: payment.reference,
        payment_ref: payment.prontu_payment_id,
        customer_name: payment.customer_name,
        customer_contact: payment.customer_contact,
        amount: Number(payment.amount),
      },
      {
        vendorId,
        paymentMethodId,
      },
    );

    if (!yeloResult.success) {
      throw new Error("Falha ao criar o pedido no Yelo.");
    }

    // Save the new order in Supabase
    const { error: orderErr } = await supabaseAdmin.from("orders").insert({
      yelo_order_id: yeloResult.yelo_order_id,
      reference: payment.reference,
      payment_ref: payment.prontu_payment_id,
      status: "CREATED",
      raw: yeloResult.raw,
    });

    if (orderErr) {
      console.error("Manual order inserted in Yelo, but failed to save in DB:", orderErr);
    }

    // Resolve the incident
    const notes = `Pedido ${yeloResult.yelo_order_id} criado manualmente no Yelo a partir dos dados do pagamento.`;
    await supabaseAdmin
      .from("incidents")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        notes,
      })
      .eq("id", data.incidentId);

    await supabaseAdmin.from("incident_events").insert({
      incident_id: data.incidentId,
      actor: data.actor,
      action: "order.created_manually",
      notes,
    });

    return { success: true, yelo_order_id: yeloResult.yelo_order_id };
  });

// 6. Force Sync (Trigger a specific reconciliation)
export const forceSyncServer = createServerFn({ method: "POST" })
  .validator((d: { incidentId: string; actor: string; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    await supabaseAdmin.from("incident_events").insert({
      incident_id: data.incidentId,
      actor: data.actor,
      action: "sync.forced",
      notes: "Sincronização forçada iniciada pela sala de operações.",
    });

    // Run the reconciliation script
    await runReconciliation();

    return { success: true };
  });

// 7. Contact Customer Audit log
export const contactCustomerServer = createServerFn({ method: "POST" })
  .validator((d: { incidentId: string; actor: string; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    await supabaseAdmin.from("incident_events").insert({
      incident_id: data.incidentId,
      actor: data.actor,
      action: "customer.contacted",
      notes: "Cliente contactado pela equipa da sala de operações.",
    });

    return { success: true };
  });

// 8. Validate Payment manually
export const validatePaymentServer = createServerFn({ method: "POST" })
  .validator((d: { incidentId: string; actor: string; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    await supabaseAdmin.from("incident_events").insert({
      incident_id: data.incidentId,
      actor: data.actor,
      action: "payment.validated",
      notes: "Pagamento validado manualmente contra extrato da Prontu.",
    });

    return { success: true };
  });

// 9. Add custom note
export const addNoteServer = createServerFn({ method: "POST" })
  .validator((d: { incidentId: string; notes: string; actor: string; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    await supabaseAdmin.from("incident_events").insert({
      incident_id: data.incidentId,
      actor: data.actor,
      action: "note.added",
      notes: data.notes,
    });

    return { success: true };
  });
