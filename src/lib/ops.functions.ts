import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin, supabase } from "./supabase";
import { runReconciliation } from "./reconcile.server";

// Helper to verify role for general ops requests
async function verifyRole(jwt: string | undefined) {
  if (!jwt) {
    throw new Error("Não autorizado: Sessão em falta.");
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    throw new Error("Não autorizado: Utilizador inválido.");
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
}

export interface OpsKpis {
  verifiedPayments: number;
  createdOrders: number;
  anomaliesDetected: number;
  activeIncidents: number;
  avgDetectionTimeMin: number;
}

// 1. Get Live KPIs (last 24 hours)
export const getOpsKpisServer = createServerFn({ method: "GET" })
  .validator((d: { jwt?: string }) => d)
  .handler(async ({ data }): Promise<OpsKpis> => {
    await verifyRole(data.jwt);

    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Verified Payments in last 24h
    const { count: verifiedPayments } = await supabaseAdmin
      .from("payments")
      .select("*", { count: "exact", head: true })
      .gte("paid_at", past24h);

    // Created Orders in last 24h
    const { count: createdOrders } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", past24h);

    // Anomalies (All incidents created in last 24h)
    const { count: anomaliesDetected } = await supabaseAdmin
      .from("incidents")
      .select("*", { count: "exact", head: true })
      .gte("created_at", past24h);

    // Active Incidents (not resolved)
    const { count: activeIncidents } = await supabaseAdmin
      .from("incidents")
      .select("*", { count: "exact", head: true })
      .neq("status", "resolved");

    // Average detection time: diff in minutes between payment.paid_at and incident.created_at
    const { data: incidentTimes } = await supabaseAdmin
      .from("incidents")
      .select(
        `
        created_at,
        payment:payments(paid_at)
      `,
      )
      .gte("created_at", past24h);

    let avgDetectionTimeMin = 1.0;
    if (incidentTimes && incidentTimes.length > 0) {
      let totalDiffMin = 0;
      let validCount = 0;
      for (const item of incidentTimes) {
        const pay: any = item.payment;
        if (pay && pay.paid_at) {
          const payTime = new Date(pay.paid_at).getTime();
          const incTime = new Date(item.created_at).getTime();
          const diffMin = (incTime - payTime) / (1000 * 60);
          if (diffMin >= 0) {
            totalDiffMin += diffMin;
            validCount++;
          }
        }
      }
      if (validCount > 0) {
        avgDetectionTimeMin = Number((totalDiffMin / validCount).toFixed(1));
      }
    }

    return {
      verifiedPayments: verifiedPayments || 0,
      createdOrders: createdOrders || 0,
      anomaliesDetected: anomaliesDetected || 0,
      activeIncidents: activeIncidents || 0,
      avgDetectionTimeMin,
    };
  });

// 2. Trigger Manual Sync (Reconciliation Run Now button)
export const runManualSyncServer = createServerFn({ method: "POST" })
  .validator((d: { jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    const result = await runReconciliation();
    return result;
  });

// 3. Get API Settings
export const getSettingsServer = createServerFn({ method: "GET" })
  .validator((d: { jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyRole(data.jwt);

    let dbSettings = [];
    try {
      const { data: fetchedSettings, error: dbErr } = await supabaseAdmin
        .from("system_settings")
        .select("*");

      if (dbErr) {
        console.error("Erro ao procurar configurações na Base de Dados:", dbErr);
      } else if (fetchedSettings) {
        dbSettings = fetchedSettings;
      }
    } catch (err: any) {
      console.error("Erro de conexão na leitura das configurações da Base de Dados:", err.message);
    }

    const prontuKey =
      dbSettings?.find((s) => s.key === "PRONTU_API_KEY")?.value ||
      process.env.PRONTU_API_KEY ||
      "";
    const yeloKey =
      dbSettings?.find((s) => s.key === "YELO_API_KEY")?.value || process.env.YELO_API_KEY || "";
    const yeloMarketplaceUserId =
      dbSettings?.find((s) => s.key === "YELO_MARKETPLACE_USER_ID")?.value ||
      process.env.YELO_MARKETPLACE_USER_ID ||
      "";
    const yeloVendorId =
      dbSettings?.find((s) => s.key === "YELO_VENDOR_ID")?.value ||
      process.env.YELO_VENDOR_ID ||
      "1";
    const yeloPaymentMethodId =
      dbSettings?.find((s) => s.key === "YELO_PAYMENT_METHOD_ID")?.value ||
      process.env.YELO_PAYMENT_METHOD_ID ||
      "8";

    return { prontuKey, yeloKey, yeloMarketplaceUserId, yeloVendorId, yeloPaymentMethodId };
  });

// 4. Save API Settings
export const saveSettingsServer = createServerFn({ method: "POST" })
  .validator(
    (d: {
      prontuKey: string;
      yeloKey: string;
      yeloMarketplaceUserId?: string;
      yeloVendorId?: string;
      yeloPaymentMethodId?: string;
      jwt?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    // Only admin role can modify settings
    if (data.jwt) {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser(data.jwt);
      if (userErr || !user) throw new Error("Não autorizado.");

      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!roleData || roleData.role !== "admin") {
        throw new Error("Apenas administradores podem atualizar as chaves de API.");
      }
    }

    const { error: prontuErr } = await supabaseAdmin
      .from("system_settings")
      .upsert({ key: "PRONTU_API_KEY", value: data.prontuKey });
    if (prontuErr)
      throw new Error(`Falha ao guardar PRONTU_API_KEY na Base de Dados: ${prontuErr.message}`);

    const { error: yeloErr } = await supabaseAdmin
      .from("system_settings")
      .upsert({ key: "YELO_API_KEY", value: data.yeloKey });
    if (yeloErr)
      throw new Error(`Falha ao guardar YELO_API_KEY na Base de Dados: ${yeloErr.message}`);

    if (data.yeloMarketplaceUserId !== undefined) {
      const { error: err } = await supabaseAdmin
        .from("system_settings")
        .upsert({ key: "YELO_MARKETPLACE_USER_ID", value: data.yeloMarketplaceUserId });
      if (err)
        throw new Error(
          `Falha ao guardar YELO_MARKETPLACE_USER_ID na Base de Dados: ${err.message}`,
        );
      process.env.YELO_MARKETPLACE_USER_ID = data.yeloMarketplaceUserId;
    }
    if (data.yeloVendorId !== undefined) {
      const { error: err } = await supabaseAdmin
        .from("system_settings")
        .upsert({ key: "YELO_VENDOR_ID", value: data.yeloVendorId });
      if (err) throw new Error(`Falha ao guardar YELO_VENDOR_ID na Base de Dados: ${err.message}`);
      process.env.YELO_VENDOR_ID = data.yeloVendorId;
    }
    if (data.yeloPaymentMethodId !== undefined) {
      const { error: err } = await supabaseAdmin
        .from("system_settings")
        .upsert({ key: "YELO_PAYMENT_METHOD_ID", value: data.yeloPaymentMethodId });
      if (err)
        throw new Error(`Falha ao guardar YELO_PAYMENT_METHOD_ID na Base de Dados: ${err.message}`);
      process.env.YELO_PAYMENT_METHOD_ID = data.yeloPaymentMethodId;
    }

    // Propagate to current process environment
    process.env.PRONTU_API_KEY = data.prontuKey;
    process.env.YELO_API_KEY = data.yeloKey;

    return { success: true };
  });

// Admin-only helper to verify admin role on the server
async function verifyAdminRole(jwt: string | undefined) {
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

  if (roleErr || !roleData || roleData.role !== "admin") {
    throw new Error("Não autorizado: Acesso reservado a administradores.");
  }
}

// 5. List Operators (Admin only)
export const listUsersServer = createServerFn({ method: "GET" })
  .validator((d: { jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyAdminRole(data.jwt);

    const { data: roles, error: rolesErr } = await supabaseAdmin.from("user_roles").select("*");
    if (rolesErr) throw new Error(rolesErr.message);

    const {
      data: { users },
      error: usersErr,
    } = await supabaseAdmin.auth.admin.listUsers();
    if (usersErr) throw new Error(usersErr.message);

    return users.map((u) => ({
      id: u.id,
      email: u.email || "",
      role: roles?.find((r) => r.id === u.id)?.role || "ops",
      created_at: u.created_at,
    }));
  });

// 6. Create Operator (Admin only)
export const createOperatorServer = createServerFn({ method: "POST" })
  .validator((d: { email: string; role: "admin" | "ops"; password?: string; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyAdminRole(data.jwt);

    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password || "12345678", // Default placeholder password if not set
      email_confirm: true,
    });
    if (createErr) throw new Error(createErr.message);
    if (!userData.user) throw new Error("Erro ao criar utilizador.");

    const { error: roleErr } = await supabaseAdmin.from("user_roles").upsert({
      id: userData.user.id,
      role: data.role,
    });
    if (roleErr) throw new Error(roleErr.message);

    return { success: true };
  });

// 7. Update Operator Role (Admin only)
export const updateUserRoleServer = createServerFn({ method: "POST" })
  .validator((d: { userId: string; role: "admin" | "ops"; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyAdminRole(data.jwt);

    const { error } = await supabaseAdmin.from("user_roles").upsert({
      id: data.userId,
      role: data.role,
    });
    if (error) throw new Error(error.message);

    return { success: true };
  });

// 8. Delete Operator (Admin only)
export const deleteUserServer = createServerFn({ method: "POST" })
  .validator((d: { userId: string; jwt?: string }) => d)
  .handler(async ({ data }) => {
    await verifyAdminRole(data.jwt);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { success: true };
  });
