import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useOpsStore } from "../lib/ops-store";
import { LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { TupucaLogo } from "../components/ui/TupucaLogo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar · Sala OPS" },
      {
        name: "description",
        content: "Autenticação de operador para a Sala de Operações Tupuca × Prontu",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const store = useOpsStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        store.initialize(session.access_token);
        navigate({ to: "/" });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        store.initialize(session.access_token);
        navigate({ to: "/" });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, store]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Por favor, preencha todos os campos.");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Sessão iniciada com sucesso!");
        if (data.session) {
          store.initialize(data.session.access_token);
          navigate({ to: "/" });
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique o seu e-mail para confirmação.");
        setIsLogin(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocorreu um erro ao processar a solicitação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#09090b] text-foreground flex items-center justify-center p-4 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      <div
        className="absolute -top-[40%] left-[20%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none animate-pulse"
        style={{ animationDuration: "10s" }}
      />
      <div className="absolute -bottom-[30%] right-[10%] w-[500px] h-[500px] rounded-full bg-critical/5 blur-[100px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

      <div className="relative w-full max-w-[440px] z-10 space-y-6">
        <header className="text-center space-y-4 animate-fade-in">
          <TupucaLogo size={60} className="mx-auto justify-center" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sala de Operações</h1>
            <p className="text-sm text-muted-foreground mt-1">Reconciliação Contínua Tupuca × Prontu</p>
          </div>
        </header>

        <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
          <div className="flex border-b border-border/40 mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setErrorMsg(null);
              }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] ${
                isLogin
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Iniciar Sessão
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setErrorMsg(null);
              }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] ${
                !isLogin
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Criar Conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="size-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <span className="flex-1 leading-relaxed">{errorMsg}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail Corporativo</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-surface-2 border-border/60 text-sm h-10 focus-visible:ring-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Palavra-passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-surface-2 border-border/60 text-sm h-10 focus-visible:ring-primary/50"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/20 gap-2 transition-all mt-6"
            >
              {loading ? (
                <span className="size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn className="size-4" /> Entrar na Sala
                </>
              ) : (
                <>
                  <UserPlus className="size-4" /> Registar Operador
                </>
              )}
            </Button>
          </form>
        </div>

        <footer className="text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Sala OPS · Tupuca Angola</p>
        </footer>
      </div>
    </div>
  );
}
