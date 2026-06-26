import { createClient } from "@supabase/supabase-js";

// Fetch values safely on both client (Vite env) and server (Node/Bun process.env)
const supabaseUrl =
  (typeof window !== "undefined"
    ? (window as any).env?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
    : undefined) ||
  (typeof process !== "undefined"
    ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    : undefined) ||
  "";

const supabaseAnonKey =
  (typeof window !== "undefined"
    ? (window as any).env?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
    : undefined) ||
  (typeof process !== "undefined"
    ? process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    : undefined) ||
  "";

const supabaseServiceKey =
  typeof window === "undefined" && typeof process !== "undefined"
    ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    : undefined;

// Create client
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "AVISO: Credenciais do Supabase (VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY) não configuradas no ficheiro .env!",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Admin client using service role key (only on server side)
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey || "",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
