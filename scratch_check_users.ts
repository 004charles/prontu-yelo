import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Read .env manually to avoid dependency issues
const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join("=").trim();
    env[key] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Erro: Credenciais do Supabase ausentes no ficheiro .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main() {
  console.log("=== LISTAGEM DE UTILIZADORES NO SUPABASE ===");
  try {
    const {
      data: { users },
      error: authErr,
    } = await supabase.auth.admin.listUsers();
    if (authErr) {
      console.error("Erro ao listar utilizadores do Auth:", authErr.message);
    } else {
      console.log(`Total no Auth: ${users.length} utilizador(es).`);
      users.forEach((u, i) => {
        console.log(`[${i + 1}] Email: ${u.email}`);
        console.log(`    ID: ${u.id}`);
        console.log(
          `    Confirmado: ${u.email_confirmed_at ? "Sim, em " + u.email_confirmed_at : "Não (Pendente)"}`,
        );
        console.log(`    Criado em: ${u.created_at}`);
      });
    }
  } catch (err: any) {
    console.error("Falha ao comunicar com o Supabase Auth:", err.message);
  }

  console.log("\n=== LISTAGEM DE CARGOS NA TABELA PUBLIC.USER_ROLES ===");
  try {
    const { data: roles, error: rolesErr } = await supabase.from("user_roles").select("*");
    if (rolesErr) {
      console.error("Erro ao listar public.user_roles:", rolesErr.message);
    } else {
      console.log(`Total em user_roles: ${roles?.length || 0} entrada(s).`);
      roles?.forEach((r, i) => {
        console.log(`[${i + 1}] ID: ${r.id} -> Cargo: ${r.role}`);
      });
    }
  } catch (err: any) {
    console.error("Falha ao consultar tabela public.user_roles:", err.message);
  }
}

main();
