import { getProntuPayments } from "./prontu.server";
import { getYeloOrders } from "./yelo.server";
import { supabaseAdmin } from "./supabase";
import { reconcileMatch, isExactMatch } from "./matching";

export async function runReconciliation() {
  // Fetch latest keys and marketplaceUserId from database
  const { data: dbSettings } = await supabaseAdmin.from("system_settings").select("*");
  const settings: Record<string, string> = {};
  if (dbSettings) {
    for (const s of dbSettings) {
      settings[s.key] = s.value;
    }
  }

  const prontuKey = settings.PRONTU_API_KEY || process.env.PRONTU_API_KEY || "mock_key";
  const yeloKey = settings.YELO_API_KEY || process.env.YELO_API_KEY || "mock_key";
  const marketplaceUserId =
    settings.YELO_MARKETPLACE_USER_ID || process.env.YELO_MARKETPLACE_USER_ID || "";

  let payments = [];
  try {
    payments = await getProntuPayments(prontuKey);
  } catch (error: any) {
    console.error("Failed to fetch Prontu payments:", error);
    throw new Error(`Erro ao obter pagamentos da Prontu: ${error.message}`);
  }

  let orders = [];
  try {
    orders = await getYeloOrders(yeloKey, marketplaceUserId);
  } catch (error: any) {
    console.error("Failed to fetch Yelo orders:", error);
    throw new Error(`Erro ao obter pedidos do Yelo: ${error.message}`);
  }

  // 3. Upsert Payments to Supabase
  for (const p of payments) {
    const { error: pErr } = await supabaseAdmin.from("payments").upsert(
      {
        prontu_payment_id: p.prontu_payment_id,
        reference: p.reference,
        customer_name: p.customer_name,
        customer_contact: p.customer_contact,
        amount: p.amount,
        currency: p.currency,
        paid_at: p.paid_at,
        raw: p.raw,
      },
      { onConflict: "prontu_payment_id" },
    );

    if (pErr) {
      console.error(`Error upserting payment ${p.prontu_payment_id}:`, pErr);
    }
  }

  // 4. Upsert Orders to Supabase
  for (const o of orders) {
    const { error: oErr } = await supabaseAdmin.from("orders").upsert(
      {
        yelo_order_id: o.yelo_order_id,
        reference: o.reference,
        payment_ref: o.payment_ref,
        status: o.status,
        created_at: o.created_at,
        raw: o.raw,
      },
      { onConflict: "yelo_order_id" },
    );

    if (oErr) {
      console.error(`Error upserting order ${o.yelo_order_id}:`, oErr);
    }
  }

  // 5. Reconciliation Diff
  // Get all payments from the database
  const { data: dbPayments, error: dbPErr } = await supabaseAdmin.from("payments").select("*");

  if (dbPErr || !dbPayments) {
    console.error("Failed to fetch database payments:", dbPErr);
    return { success: false, error: "Failed to fetch db payments" };
  }

  // Get all orders from the database
  const { data: dbOrders, error: dbOErr } = await supabaseAdmin.from("orders").select("*");

  if (dbOErr) {
    console.error("Failed to fetch database orders:", dbOErr);
  }

  for (const p of dbPayments) {
    let matchedOrder = null;

    // Pass 1: Tenta correspondência exata primeiro
    if (dbOrders) {
      for (const o of dbOrders) {
        if (isExactMatch(p, o)) {
          matchedOrder = o;
          break;
        }
      }
    }

    // Pass 2: Tenta correspondência aproximada (fuzzy) se não encontrou exata
    if (!matchedOrder && dbOrders) {
      for (const o of dbOrders) {
        const matchResult = reconcileMatch(p, o);
        if (matchResult.matched) {
          matchedOrder = o;
          break;
        }
      }
    }

    const hasOrder = !!matchedOrder;

    // Check if incident exists for this payment_id
    const { data: existingIncidents, error: incQueryErr } = await supabaseAdmin
      .from("incidents")
      .select("*")
      .eq("payment_id", p.id);

    if (incQueryErr) {
      console.error(`Error querying incidents for payment ${p.id}:`, incQueryErr);
      continue;
    }

    const hasIncident = existingIncidents && existingIncidents.length > 0;
    const activeIncident = existingIncidents?.find((i) => i.status !== "resolved");

    if (!hasOrder) {
      // Create a new incident if none exists
      if (!hasIncident) {
        const { data: newInc, error: incErr } = await supabaseAdmin
          .from("incidents")
          .insert({
            payment_id: p.id,
            severity: "high",
            status: "open",
            notes: "Pagamento confirmado na Prontu sem pedido correspondente no Yelo.",
          })
          .select()
          .single();

        if (incErr) {
          console.error(`Error inserting incident for payment ${p.id}:`, incErr);
        } else if (newInc) {
          await supabaseAdmin.from("incident_events").insert({
            incident_id: newInc.id,
            actor: "system",
            action: "incident.created",
            notes: "Pagamento sem pedido correspondente detectado.",
          });
        }
      }
    } else {
      // If there is an order and an active incident exists, auto-resolve it
      if (activeIncident) {
        await supabaseAdmin
          .from("incidents")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
          })
          .eq("id", activeIncident.id);

        await supabaseAdmin.from("incident_events").insert({
          incident_id: activeIncident.id,
          actor: "system",
          action: "incident.resolved",
          notes: "Pedido correspondente encontrado. Incidente resolvido automaticamente.",
        });
      }
    }
  }

  return { success: true, mode: "database", processedPaymentsCount: payments.length };
}
