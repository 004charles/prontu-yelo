import { Link, useRouter, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertOctagon,
  ArrowLeftRight,
  LayoutDashboard,
  RefreshCw,
  LogOut,
  Settings,
  Database,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { useOpsStore } from "../../lib/ops-store";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { TupucaLogo } from "../ui/TupucaLogo";

export function OpsShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const { lastSyncAt, syncing, runSync, incidents, jwt, initialize, isAdmin } = useOpsStore();
  const [mounted, setMounted] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => force((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (jwt) {
      supabase.auth.getUser().then(({ data }: any) => {
        const user = data?.user;
        if (user) {
          setUserEmail(user.email || "Operador");
        }
      });
    }
  }, [jwt]);

  const openCount = incidents.filter((i: any) => i.status === "open").length;
  const pathname = router.state.location.pathname;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    initialize(null);
    toast.success("Sessão terminada com sucesso.");
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-foreground">
      <header className="border-b border-border/40 bg-surface/40 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-[1400px] px-6 py-3 flex items-center gap-6">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <TupucaLogo size={32} showText={true} />
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            <NavItem
              to="/"
              active={pathname === "/"}
              icon={<LayoutDashboard className="size-3.5" />}
            >
              Dashboard
            </NavItem>
            <NavItem
              to="/transactions"
              active={pathname === "/transactions"}
              icon={<ArrowLeftRight className="size-3.5" />}
            >
              Transações
            </NavItem>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                pathname.startsWith("/incidents")
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <AlertOctagon className="size-3.5" />
              Incidentes
              {openCount > 0 && (
                <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-critical text-critical-foreground">
                  {openCount}
                </span>
              )}
            </div>
            {isAdmin && (
              <NavItem
                to="/admin"
                active={pathname === "/admin"}
                icon={<Settings className="size-3.5" />}
              >
                Administração
              </NavItem>
            )}
          </nav>

          {/* Database Mode Indicators */}
          <div className="hidden lg:flex items-center gap-2 ml-4">
            <span className="inline-flex items-center gap-1 text-[10px] bg-success/15 text-success border border-success/20 px-2 py-0.5 rounded-full font-medium">
              <Database className="size-3" /> Supabase Realtime
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" />
                <span className="relative rounded-full bg-success size-2" />
              </span>
              <span className="font-mono" suppressHydrationWarning>
                Última sync ·{" "}
                {mounted ? new Date(lastSyncAt).toLocaleTimeString("pt-PT") : "--:--:--"}
              </span>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => runSync()}
              disabled={syncing}
              className="gap-2 border-border/60"
            >
              <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando" : "Run now"}
            </Button>

            {userEmail && (
              <div className="flex items-center gap-3 pl-3 border-l border-border/40">
                <div className="hidden xl:block text-right">
                  <div className="text-xs font-medium text-foreground max-w-[150px] truncate">
                    {userEmail}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    Operador OPS
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleLogout}
                  title="Sair da sessão"
                  className="size-8 rounded-full border border-border/40 hover:bg-critical/10 hover:text-critical"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 bg-[#09090b]">{children}</main>

      <footer className="border-t border-border/40 bg-surface/40">
        <div className="mx-auto max-w-[1400px] px-6 py-3 text-[11px] text-muted-foreground font-mono flex justify-between">
          <span>OPS Reconciliation Engine · v1.0 (cloud)</span>
          <span>Cron: a cada 60s (público /api/public/reconcile)</span>
        </div>
      </footer>
    </div>
  );
}

function NavItem({
  to,
  active,
  icon,
  badge,
  children,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? "bg-accent text-accent-foreground border border-border/30"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      }`}
    >
      {icon}
      {children}
      {badge && badge > 0 ? (
        <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-critical text-critical-foreground">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
